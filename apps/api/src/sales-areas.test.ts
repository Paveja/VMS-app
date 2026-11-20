import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
process.env.NODE_ENV = 'test';
if (
  !process.env.TEST_DATABASE_URL ||
  process.env.TEST_DATABASE_URL === process.env.DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')
)
  throw new Error('A separate *_test PostgreSQL database is required');
const url = new URL(process.env.TEST_DATABASE_URL);
url.searchParams.set('options', '-c search_path=dealerflow_sales_areas_test');
process.env.DATABASE_URL = url.toString();
const { pool } = await import('./lib/db.ts');
const { migrate } = await import('../../../scripts/migrate.ts');
const { hashPassword, tokenHash } = await import('./lib/auth.ts');
const { app } = await import('./app.ts');
const tokens: Record<string, string> = {};
const branch = randomUUID();
const otherBranch = randomUUID();
const model = randomUUID();
const otherModel = randomUUID();
const customer = randomUUID();
let employee: string;
const period = { period: 'custom', start: '2026-11-20', end: '2026-11-20' };
const auth = (role = 'admin') => ({ Authorization: `Bearer ${tokens[role]}` });
const get = (extra: object = {}, role = 'admin') =>
  request(app)
    .get('/api/analytics/sales-areas')
    .set(auth(role))
    .query({ ...period, ...extra });
async function addSale(
  branchId: string,
  modelId = model,
  at: string | null = '2026-11-20T06:00:00Z',
) {
  const vehicle = randomUUID();
  const booking = randomUUID();
  await pool.query(
    `INSERT INTO vehicles(id,vin,model_id,branch_id,color,status)
    VALUES($1,$2,$3,$4,'White',$5)`,
    [
      vehicle,
      randomUUID().replaceAll('-', '').slice(0, 17).toUpperCase(),
      modelId,
      branchId,
      at ? 'sold' : 'reserved',
    ],
  );
  await pool.query(
    `INSERT INTO bookings(id,customer_id,vehicle_id,employee_id,status)
    VALUES($1,$2,$3,$4,'converted')`,
    [booking, customer, vehicle, employee],
  );
  await pool.query(
    `INSERT INTO orders(booking_id,base_price_paise,extras_paise,tax_paise,total_paise,snapshot,status,delivered_at)
    VALUES($1,100000,0,0,100000,'{}',$2,$3)`,
    [booking, at ? 'delivered' : 'open', at],
  );
}
beforeAll(async () => {
  await pool.query('CREATE SCHEMA dealerflow_sales_areas_test');
  await migrate();
  const password = 'Isolated-area-test-password';
  const hash = await hashPassword(password);
  for (const role of ['admin', 'sales', 'inventory', 'manager']) {
    const result = await pool.query(
      'INSERT INTO employees(name,email,password_hash,role) VALUES($1,$2,$3,$1) RETURNING id',
      [role, `${role}@sales-areas.test`, hash],
    );
    if (role === 'admin') employee = result.rows[0].id;
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: `${role}@sales-areas.test`, password });
    expect(login.status).toBe(200);
    tokens[role] = login.body.token;
  }
  await pool.query(
    `INSERT INTO customers(id,name,phone) VALUES($1,'Area Test Buyer','9876543210')`,
    [customer],
  );
  await pool.query(
    `INSERT INTO vehicle_models(id,brand,name,variant,fuel,transmission,base_price_paise)
    VALUES($1,'Aster','Crest','ZX+','Petrol','Manual',100000),($2,'Meridian','Arc','Sport','Petrol','Manual',100000)`,
    [model, otherModel],
  );
  await pool.query(
    `INSERT INTO branches(id,name,city) VALUES($1,'Hyderabad A','Hyderabad'),($2,'Hyderabad B','Hyderabad')`,
    [branch, otherBranch],
  );
  await addSale(branch);
  await addSale(branch);
  await addSale(otherBranch, otherModel);
  for (const [city, count] of [
    ['Bengaluru', 2],
    ['Chennai', 2],
    ['Delhi', 1],
    ['Kochi', 1],
    ['Pune', 1],
    ['Surat', 1],
  ] as const) {
    const id = randomUUID();
    await pool.query('INSERT INTO branches(id,name,city) VALUES($1,$2,$2)', [id, city]);
    for (let index = 0; index < count; index++) await addSale(id);
  }
  const boundary = randomUUID();
  await pool.query("INSERT INTO branches(id,name,city) VALUES($1,'Faridabad','Faridabad')", [
    boundary,
  ]);
  await addSale(boundary, model, '2026-11-19T18:30:00Z');
  await addSale(boundary, model, '2026-11-20T18:30:00Z');
  await addSale(boundary, model, '2026-11-19T18:29:59Z');
  await addSale(branch, model, null);
});
afterAll(async () => {
  await pool.query('DROP SCHEMA dealerflow_sales_areas_test CASCADE');
  await pool.end();
});
describe('city sales ranking from persisted deliveries', () => {
  it('combines branches by city and ranks completed deliveries rather than open orders', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.body.items[0]).toEqual({ city: 'Hyderabad', deliveries: 3, rank: 1 });
    expect(response.body.items.slice(1, 3)).toEqual([
      { city: 'Bengaluru', deliveries: 2, rank: 2 },
      { city: 'Chennai', deliveries: 2, rank: 2 },
    ]);
    expect(response.body.totalDeliveries).toBe(12);
  });
  it('returns five stable rows but calculates totals across every matching city', async () => {
    const first = await get();
    const second = await get();
    expect(first.body.items).toEqual(second.body.items);
    expect(first.body.items).toHaveLength(5);
    expect(first.body.totalAreas).toBe(8);
    expect(
      first.body.items.reduce(
        (sum: number, item: { deliveries: number }) => sum + item.deliveries,
        0,
      ),
    ).toBe(9);
    expect(first.body.totalDeliveries).toBe(12);
    expect(Object.keys(first.body.items[0]).sort()).toEqual(['city', 'deliveries', 'rank']);
  });
  it('uses half-open Kolkata delivery dates and supports all-time tied leaders', async () => {
    const selected = await get();
    expect(
      selected.body.items.find((item: { city: string }) => item.city === 'Faridabad').deliveries,
    ).toBe(1);
    const all = await get({ period: 'all' });
    expect(all.body.items.slice(0, 2)).toEqual([
      { city: 'Faridabad', deliveries: 3, rank: 1 },
      { city: 'Hyderabad', deliveries: 3, rank: 1 },
    ]);
    expect(all.body.totalDeliveries).toBe(14);
  });
  it('honors branch/model scope and returns zero aggregates for no matching deliveries', async () => {
    const scoped = await get({ branch_id: branch });
    expect(scoped.body.items).toEqual([{ city: 'Hyderabad', deliveries: 2, rank: 1 }]);
    const other = await get({ model_id: otherModel });
    expect(other.body.items).toEqual([{ city: 'Hyderabad', deliveries: 1, rank: 1 }]);
    const none = await get({ branch_id: branch, model_id: otherModel });
    expect(none.body.items).toEqual([]);
    expect(none.body.totalDeliveries).toBe(0);
    expect(none.body.totalAreas).toBe(0);
    expect((await get({ start: '2000-01-01', end: '2000-01-01' })).body.items).toEqual([]);
  });
  it('preserves existing read access for all four employee roles and validates filters', async () => {
    for (const role of ['admin', 'sales', 'inventory', 'manager'])
      expect((await get({}, role)).status).toBe(200);
    for (const extra of [
      { branch_id: 'bad' },
      { model_id: "' OR true --" },
      { start: 'invalid' },
      { start: '2026-11-21', end: '2026-11-20' },
      { period: 'invalid' },
    ]) {
      const response = await get(extra);
      expect(response.status).toBe(422);
      expect(response.body.error).toBeDefined();
    }
  });
  it('rejects unauthenticated, malformed and expired sessions without returning figures', async () => {
    expect((await request(app).get('/api/analytics/sales-areas')).status).toBe(401);
    expect(
      (await request(app).get('/api/analytics/sales-areas').set('Authorization', 'Bearer invalid'))
        .status,
    ).toBe(401);
    await pool.query(
      "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [tokenHash(tokens.manager)],
    );
    const expired = await get({}, 'manager');
    expect(expired.status).toBe(401);
    expect(expired.body.items).toBeUndefined();
  });
});
