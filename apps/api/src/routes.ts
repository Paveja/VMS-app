import { Router, type Request, type RequestHandler } from 'express';
import multer from 'multer';
import { id, privileges, querySchema } from '@dealerflow/contracts';
import { pool, rows, one } from './lib/db.ts';
import { authenticate, authorize, type AuthRequest, login } from './lib/auth.ts';
import { listResource } from './lib/lists.ts';
import {
  saveModel,
  saveVehicle,
  saveCustomer,
  createBooking,
  cancelBooking,
  vehicleSelect,
  bookingSelect,
  customerDetail,
} from './lib/stock.ts';
import {
  convertBooking,
  orderDetail,
  createPayment,
  settlePayment,
  deliverOrder,
} from './lib/orders.ts';
import { uploadDocument, reviewDocument, documentPath } from './lib/documents.ts';
import * as analytics from './lib/analytics.ts';
import { trends, search, activity } from './lib/insights.ts';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4194304, files: 1, fields: 1 },
});
const wrap =
  (handler: (request: AuthRequest) => Promise<unknown>, status = 200): RequestHandler =>
  async (request, response, next) => {
    try {
      response.status(status).json(await handler(request as AuthRequest));
    } catch (error) {
      next(error);
    }
  };
const recordId = (request: Request, key = 'id') => id.parse(request.params[key]);
const query = (request: Request) => {
  const result = querySchema.parse(request.query);
  if (result.period !== 'all') analytics.metadata(result);
  return result;
};
export const api = Router();
api.post(
  '/auth/login',
  wrap((request) => login(request.body)),
);
api.use(authenticate);
api.get(
  '/auth/me',
  wrap(async (request) => request.employee),
);
api.post(
  '/auth/logout',
  wrap(async (request) => {
    await pool.query('DELETE FROM sessions WHERE token_hash=$1', [request.tokenHash]);
    return { ok: true };
  }),
);
api.get(
  '/branches',
  wrap(async () => ({ items: await rows(pool, 'SELECT * FROM branches ORDER BY name LIMIT 100') })),
);
api.get(
  '/employees',
  wrap(async () => ({
    items: await rows(
      pool,
      'SELECT id,name,role FROM employees WHERE active=true ORDER BY name LIMIT 100',
    ),
  })),
);
for (const resource of ['models', 'vehicles', 'customers', 'bookings', 'orders'] as const)
  api.get(
    `/${resource}`,
    wrap((request) => listResource(resource, query(request))),
  );
api.post(
  '/models',
  authorize(privileges.catalog),
  wrap((request) => saveModel(request.body), 201),
);
api.patch(
  '/models/:id',
  authorize(privileges.catalog),
  wrap((request) => saveModel(request.body, recordId(request))),
);
api.get(
  '/models/:id',
  wrap((request) => one(pool, 'SELECT * FROM vehicle_models WHERE id=$1', [recordId(request)])),
);
api.post(
  '/vehicles',
  authorize(privileges.catalog),
  wrap((request) => saveVehicle(request.body), 201),
);
api.patch(
  '/vehicles/:id',
  authorize(privileges.catalog),
  wrap((request) => saveVehicle(request.body, recordId(request))),
);
api.get(
  '/vehicles/:id',
  wrap(async (request) => ({
    ...(await one(pool, `${vehicleSelect} WHERE v.id=$1`, [recordId(request)])),
    bookings: await rows(
      pool,
      `${bookingSelect} WHERE v.id=$1 ORDER BY b.booked_at DESC LIMIT 100`,
      [recordId(request)],
    ),
  })),
);
api.post(
  '/customers',
  authorize(privileges.sales),
  wrap((request) => saveCustomer(request.body), 201),
);
api.patch(
  '/customers/:id',
  authorize(privileges.sales),
  wrap((request) => saveCustomer(request.body, recordId(request))),
);
api.get(
  '/customers/:id',
  wrap((request) => customerDetail(recordId(request))),
);
api.post(
  '/bookings',
  authorize(privileges.sales),
  wrap((request) => createBooking(request.body, request.employee.id), 201),
);
api.get(
  '/bookings/:id',
  wrap((request) => one(pool, `${bookingSelect} WHERE b.id=$1`, [recordId(request)])),
);
api.post(
  '/bookings/:id/cancel',
  authorize(privileges.sales),
  wrap((request) => cancelBooking(recordId(request))),
);
api.post(
  '/bookings/:id/convert',
  authorize(privileges.sales),
  wrap((request) => convertBooking(recordId(request), request.body), 201),
);
api.get(
  '/orders/:id',
  wrap((request) => orderDetail(recordId(request))),
);
api.get(
  '/orders/:id/invoice',
  wrap((request) => orderDetail(recordId(request))),
);
api.get(
  '/orders/:id/payments',
  wrap(async (request) => ({
    items: await rows(
      pool,
      'SELECT * FROM payment_requests WHERE order_id=$1 ORDER BY created_at DESC LIMIT 100',
      [recordId(request)],
    ),
  })),
);
api.post(
  '/orders/:id/payments',
  authorize(privileges.sales),
  wrap((request) => createPayment(recordId(request), request.body, request.employee.id), 201),
);
api.post(
  '/orders/:id/payments/:paymentId/settle',
  authorize(privileges.review),
  wrap((request) =>
    settlePayment(recordId(request), recordId(request, 'paymentId'), request.employee.id),
  ),
);
api.get(
  '/orders/:id/documents',
  wrap(async (request) => ({ items: (await orderDetail(recordId(request))).documents })),
);
api.post(
  '/orders/:id/documents',
  authorize(privileges.sales),
  upload.single('file'),
  wrap(
    (request) =>
      uploadDocument(recordId(request), request.body.category, request.file, request.employee.id),
    201,
  ),
);
api.post(
  '/orders/:id/documents/:documentId/review',
  authorize(privileges.review),
  wrap((request) =>
    reviewDocument(
      recordId(request),
      recordId(request, 'documentId'),
      request.body,
      request.employee.id,
    ),
  ),
);
api.get('/orders/:id/documents/:documentId/download', async (request, response, next) => {
  try {
    const document = await one(
      pool,
      'SELECT storage_key,filename,mime FROM documents WHERE id=$1 AND order_id=$2',
      [recordId(request, 'documentId'), recordId(request)],
    );
    response
      .type(document.mime)
      .download(
        documentPath(document.storage_key),
        document.filename,
        { dotfiles: 'allow' },
        (error) => {
          if (error) next(error);
        },
      );
  } catch (error) {
    next(error);
  }
});
api.post(
  '/orders/:id/deliver',
  authorize(privileges.review),
  wrap((request) => deliverOrder(recordId(request), request.employee.id)),
);
api.get(
  '/dashboard',
  wrap((request) => analytics.summary(query(request))),
);
for (const [route, handler] of Object.entries({
  summary: analytics.summary,
  stock: analytics.stock,
  exceptions: analytics.exceptions,
  trends,
  records: analytics.records,
  search,
  activity,
}))
  api.get(
    `/analytics/${route}`,
    wrap((request) => handler(query(request))),
  );
api.get(
  '/analytics/journeys/:id',
  wrap((request) => orderDetail(recordId(request))),
);
