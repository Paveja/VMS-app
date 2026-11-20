import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { RequestHandler, Request } from 'express';
import { type Employee, type Role, loginSchema } from '@dealerflow/contracts';
import { pool, rows, HttpError } from './db.ts';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${((await scrypt(password, salt, 64)) as Buffer).toString('hex')}`;
}
const dummy = await hashPassword(randomBytes(32).toString('hex'));
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export type AuthRequest = Request & { employee: Employee; tokenHash: string };
export async function login(body: unknown) {
  const input = loginSchema.parse(body);
  const [employee] = await rows(pool, 'SELECT * FROM employees WHERE email=$1 AND active=true', [
    input.email,
  ]);
  const [salt, hash] = (employee?.password_hash ?? dummy).split(':');
  const candidate = (await scrypt(input.password, salt, 64)) as Buffer;
  const valid = timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
  if (!employee || !valid) {
    console.info('Sign-in rejected');
    throw new HttpError(401, 'Invalid credentials');
  }
  const token = randomBytes(32).toString('base64url');
  await pool.query('DELETE FROM sessions WHERE expires_at<=now()');
  await pool.query(
    "INSERT INTO sessions(token_hash,employee_id,expires_at) VALUES($1,$2,now()+interval '10 hours')",
    [tokenHash(token), employee.id],
  );
  console.info('Employee signed in', employee.id);
  return {
    token,
    employee: { id: employee.id, name: employee.name, role: employee.role, email: employee.email },
  };
}
export const authenticate: RequestHandler = async (request, _response, next) => {
  try {
    const token = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if (!token) throw new HttpError(401, 'Please sign in');
    const hash = tokenHash(token);
    const [employee] = await rows(
      pool,
      'SELECT e.id,e.name,e.email,e.role FROM sessions s JOIN employees e ON e.id=s.employee_id WHERE s.token_hash=$1 AND s.expires_at>now() AND e.active=true',
      [hash],
    );
    if (!employee) throw new HttpError(401, 'Session expired. Please sign in again');
    Object.assign(request, { employee, tokenHash: hash });
    next();
  } catch (error) {
    next(error);
  }
};
export function authorize(roles: readonly Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!roles.includes((request as AuthRequest).employee.role))
      next(new HttpError(403, 'Your role cannot perform this action'));
    else next();
  };
}
