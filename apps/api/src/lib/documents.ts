import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { documentCategories, reviewSchema } from '@dealerflow/contracts';
import { z } from 'zod';
import { transaction, one, requireState, HttpError } from './db.ts';
import { insert } from './stock.ts';
export const storageRoot = path.resolve(process.env.DOCUMENT_ROOT || '.data/documents');
const fileTypes = [
  {
    mime: 'application/pdf',
    extensions: ['.pdf'],
    test: (bytes: Buffer) => bytes.subarray(0, 5).toString() === '%PDF-',
  },
  {
    mime: 'image/png',
    extensions: ['.png'],
    test: (bytes: Buffer) =>
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    mime: 'image/jpeg',
    extensions: ['.jpg', '.jpeg'],
    test: (bytes: Buffer) => bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
  },
];
export async function uploadDocument(
  orderId: string,
  category: unknown,
  file: Express.Multer.File | undefined,
  employeeId: string,
) {
  const type = z.enum(documentCategories).parse(category);
  if (!file || file.size === 0) throw new HttpError(422, 'Choose a PDF, JPEG or PNG document');
  if (file.size > 4 * 1024 * 1024) throw new HttpError(413, 'Document exceeds 4 MB');
  const format = fileTypes.find(
    (format) =>
      format.mime === file.mimetype &&
      format.extensions.includes(path.extname(file.originalname).toLowerCase()) &&
      format.test(file.buffer),
  );
  if (!format) throw new HttpError(422, 'File extension, MIME and content must agree');
  const storageKey = randomUUID();
  const filename =
    path
      .basename(file.originalname.replaceAll('\\', '/'))
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
      .slice(0, 120) || 'document';
  await mkdir(storageRoot, { recursive: true, mode: 0o700 });
  let written = false;
  try {
    return await transaction(async (connection) => {
      const order = await one(connection, 'SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
      requireState(order.status === 'open', 'Documents cannot change after delivery');
      const previous = await connection.query(
        'SELECT id FROM documents WHERE order_id=$1 AND category=$2 ORDER BY created_at DESC,id DESC LIMIT 1',
        [orderId, type],
      );
      await writeFile(path.join(storageRoot, storageKey), file.buffer, { flag: 'wx', mode: 0o600 });
      written = true;
      const document = await insert(connection, 'documents', {
        order_id: orderId,
        category: type,
        storage_key: storageKey,
        filename,
        mime: format.mime,
        size: file.size,
        uploader_id: employeeId,
        replaces_id: previous.rows[0]?.id ?? null,
      });
      delete document.storage_key;
      return document;
    });
  } catch (error) {
    if (written)
      await unlink(path.join(storageRoot, storageKey)).catch((cleanupError) =>
        console.error('Orphan cleanup failed', cleanupError.code),
      );
    throw error;
  }
}
export async function reviewDocument(
  orderId: string,
  documentId: string,
  body: unknown,
  employeeId: string,
) {
  const input = reviewSchema.parse(body);
  return transaction(async (connection) => {
    const order = await one(connection, 'SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    requireState(order.status === 'open', 'Documents cannot change after delivery');
    const document = await one(
      connection,
      'SELECT d.*,EXISTS(SELECT 1 FROM documents n WHERE n.replaces_id=d.id) AS superseded FROM documents d WHERE d.id=$1 AND d.order_id=$2 FOR UPDATE',
      [documentId, orderId],
    );
    requireState(
      !document.superseded && document.status === 'pending',
      'Only the latest pending document can be reviewed',
    );
    return one(
      connection,
      'UPDATE documents SET status=$2,reason=$3,reviewer_id=$4,reviewed_at=now() WHERE id=$1 RETURNING id,category,status,reason,reviewed_at',
      [documentId, input.status, input.reason, employeeId],
    );
  });
}
export function documentPath(storageKey: string) {
  return path.join(storageRoot, z.string().uuid().parse(storageKey));
}
