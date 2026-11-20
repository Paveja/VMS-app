import 'dotenv/config';
import pg, { type PoolClient, type QueryResultRow } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
const connectionString = process.env.DATABASE_URL;
if (!connectionString || !/^postgres(ql)?:\/\//.test(connectionString))
  throw new Error('A PostgreSQL DATABASE_URL is required');
export const pool = new pg.Pool({
  connectionString,
  ssl: false,
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});
pool.on('error', (error) => console.error('PostgreSQL pool error', error.message));
export const database = drizzle(pool);
export async function health() {
  await database.execute(sql`SELECT 1`);
}
export type Connection = Pick<PoolClient, 'query'>;
export async function rows<T extends QueryResultRow = QueryResultRow>(
  connection: Connection,
  query: string,
  params: unknown[] = [],
) {
  return (await connection.query<T>(query, params)).rows;
}
export async function one<T extends QueryResultRow = QueryResultRow>(
  connection: Connection,
  query: string,
  params: unknown[] = [],
) {
  const result = await rows<T>(connection, query, params);
  if (!result[0]) throw new HttpError(404, 'Record not found');
  return result[0];
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireState(condition: unknown, message: string) {
  if (!condition) throw new HttpError(409, message);
}
export async function transaction<T>(
  run: (connection: PoolClient) => Promise<T>,
  readOnly = false,
) {
  const connection = await pool.connect();
  try {
    await connection.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const result = await run(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}
