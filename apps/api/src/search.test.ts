import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { SearchGroup, SearchResult } from '@dealerflow/contracts';

process.env.NODE_ENV = 'test';
if (
  !process.env.TEST_DATABASE_URL ||
  process.env.TEST_DATABASE_URL === process.env.DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')
) {
  throw new Error('A separate *_test PostgreSQL database is required');
}
const testUrl = new URL(process.env.TEST_DATABASE_URL);
testUrl.searchParams.set('options', '-c search_path=dealerflow_search_test');
process.env.DATABASE_URL = testUrl.toString();
const { pool } = await import('./lib/db.ts');
const { migrate } = await import('../../../scripts/migrate.ts');
const { app } = await import('./app.ts');
const { hashPassword, tokenHash } = await import('./lib/auth.ts');
const tokens: Record<string, string> = {};
const fixture = {
  branch: randomUUID(),
  otherBranch: randomUUID(),
  model: randomUUID(),
  otherModel: randomUUID(),
  vehicle: randomUUID(),
  customer: randomUUID(),
  booking: randomUUID(),
  order: randomUUID(),
};
const auth = (role = 'admin') => ({ Authorization: `Bearer ${tokens[role]}` });
const search = (q: string, extra: object = {}, role = 'admin') =>
  request(app)
    .get('/api/analytics/search')
    .set(auth(role))
    .query({ q, ...extra });
const group = (body: SearchResult, type: SearchGroup['type']) => {
  const found = body.groups.find((entry) => entry.type === type);
  expect(found).toBeDefined();
  return found!;
};

beforeAll(async () => {
  await pool.query('CREATE SCHEMA dealerflow_search_test');
  await migrate();
  const hash = await hashPassword('Search-test-only-password-42');
  for (const role of ['admin', 'sales', 'inventory', 'manager']) {
    await pool.query('INSERT INTO employees(name,email,password_hash,role) VALUES($1,$2,$3,$1)', [
      role,
      `${role}@search.test`,
      hash,
    ]);
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: `${role}@search.test`, password: 'Search-test-only-password-42' });
    expect(response.status).toBe(200);
    tokens[role] = response.body.token;
  }
  await pool.query(
    "INSERT INTO branches(id,name,city) VALUES($1,'Chennai','Chennai'),($2,'Pune','Pune')",
    [fixture.branch, fixture.otherBranch],
  );
  await pool.query(
    `INSERT INTO vehicle_models(id,brand,name,variant,fuel,transmission,base_price_paise)
    VALUES($1,'Maruti','Baleno','Zeta','Petrol','Manual',100000),
    ($2,'Maruti','Baleno','Alpha','Petrol','Manual',100000)`,
    [fixture.model, fixture.otherModel],
  );
  await pool.query(
    `INSERT INTO vehicles(id,vin,model_id,branch_id,color,status)
    VALUES($1,'SEARCHVIN12345678',$2,$3,'Blue','reserved')`,
    [fixture.vehicle, fixture.model, fixture.branch],
  );
  await pool.query(
    `INSERT INTO vehicles(vin,model_id,branch_id,color,status)
    SELECT 'SEARCHVINBATCH'||n,$1,$2,'White','available' FROM generate_series(1,7) n`,
    [fixture.otherModel, fixture.otherBranch],
  );
  await pool.query(
    `INSERT INTO customers(id,name,phone,email,address)
    VALUES($1,'Search Buyer','9876543210','private@search.test','Private address')`,
    [fixture.customer],
  );
  await pool.query(`INSERT INTO customers(name,phone)
    SELECT 'Search Buyer','9876543210' FROM generate_series(1,7)`);
  await pool.query("INSERT INTO customers(name,phone) VALUES('Literal_% Buyer','9876543210')");
  await pool.query(
    `INSERT INTO bookings(id,customer_id,vehicle_id,employee_id,status)
    SELECT $1,$2,$3,id,'converted' FROM employees WHERE role='admin'`,
    [fixture.booking, fixture.customer, fixture.vehicle],
  );
  await pool.query(
    `INSERT INTO orders(id,booking_id,base_price_paise,extras_paise,tax_paise,total_paise,snapshot)
    VALUES($1,$2,100000,0,0,100000,'{}')`,
    [fixture.order, fixture.booking],
  );
  await pool.query(
    "INSERT INTO invoices(order_id,invoice_ref,amount_paise) VALUES($1,'INV-SEARCH-2026',100000)",
    [fixture.order],
  );
});
afterAll(async () => {
  await pool.query('DROP SCHEMA dealerflow_search_test CASCADE');
  await pool.end();
});

describe('standalone authenticated PostgreSQL global search', () => {
  it('finds persisted VIN, model and variant with minimal context and real detail routes', async () => {
    const response = await search('searchvin12345678');
    expect(response.status).toBe(200);
    expect(group(response.body, 'vehicles').items).toEqual([
      expect.objectContaining({
        id: fixture.vehicle,
        title: 'Maruti Baleno Zeta',
        href: `/inventory/${fixture.vehicle}`,
        status: 'reserved',
        subtitle: 'VIN ••••5678 · reserved · Chennai',
      }),
    ]);
    const modelMatches = group((await search('baleno')).body, 'vehicles');
    expect(modelMatches.items.length).toBe(5);
    expect(modelMatches.items.every((item) => item.title.includes('Baleno'))).toBe(true);
    expect(group((await search('zeta')).body, 'vehicles').items[0]?.id).toBe(fixture.vehicle);
    const detail = await request(app).get(`/api/vehicles/${fixture.vehicle}`).set(auth());
    expect(detail.status).toBe(200);
    expect(detail.body.vin).toBe('SEARCHVIN12345678');
  });
  it('finds customer names, displayed BK references, booking UUIDs and order/invoice references', async () => {
    const customer = await search('Search Buyer');
    expect(group(customer.body, 'customers').items.length).toBe(5);
    for (const term of [`BK-${fixture.booking.slice(0, 8)}`, fixture.booking]) {
      const response = await search(term);
      expect(group(response.body, 'bookings').items[0]?.href).toBe(`/bookings/${fixture.booking}`);
    }
    for (const term of [fixture.order, 'inv-search-2026']) {
      const response = await search(term);
      expect(group(response.body, 'orders').items[0]?.href).toBe(`/orders/${fixture.order}`);
    }
  });
  it('bounds groups, reports additional matches accurately and keeps stable legacy items', async () => {
    const first = await search('Baleno');
    const second = await search('Baleno');
    expect(first.body.groups).toEqual(second.body.groups);
    expect(group(first.body, 'vehicles').items).toHaveLength(5);
    expect(group(first.body, 'vehicles').hasMore).toBe(true);
    const limited = await search('Baleno', { limitPerGroup: 2 });
    expect(group(limited.body, 'vehicles').items).toHaveLength(2);
    expect(group(limited.body, 'vehicles').hasMore).toBe(true);
    expect(first.body.items).toHaveLength(5);
    expect(first.body.items[0]).toEqual({
      id: expect.any(String),
      type: 'VIN / model',
      label: expect.any(String),
      route: expect.stringMatching(/^\/inventory\//),
    });
    const exact = await search('Zeta');
    expect(group(exact.body, 'vehicles').hasMore).toBe(false);
  });
  it('preserves branch/model scope without inventing permissions or applying date windows', async () => {
    const response = await search('Baleno', {
      branch_id: fixture.branch,
      model_id: fixture.model,
      period: 'custom',
      start: '2000-01-01',
      end: '2000-01-02',
    });
    expect(response.status).toBe(200);
    expect(group(response.body, 'vehicles').items.map((item) => item.id)).toEqual([
      fixture.vehicle,
    ]);
    expect(
      group((await search('Search Buyer', { branch_id: fixture.branch })).body, 'customers').items,
    ).toHaveLength(1);
    expect(
      group((await search('Search Buyer', { model_id: fixture.otherModel })).body, 'customers')
        .items,
    ).toHaveLength(0);
    expect(
      group((await search('INV-SEARCH', { branch_id: fixture.otherBranch })).body, 'orders').items,
    ).toHaveLength(0);
    for (const role of ['sales', 'inventory', 'manager', 'admin']) {
      expect((await search('Search Buyer', {}, role)).status).toBe(200);
    }
  });
  it('handles neutral short queries, empty success, literal wildcards and injection safely', async () => {
    for (const term of ['', 'a', ' ']) {
      const response = await search(term);
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
    }
    for (const term of ['nonexistent-search-567', "' OR true --", '\\%', '__', '9876543210']) {
      const response = await search(term);
      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
    }
    const literal = await search('_%');
    expect(group(literal.body, 'customers').items.map((item) => item.title)).toEqual([
      'Literal_% Buyer',
    ]);
    expect((await search('  zeta  ')).body.query).toBe('zeta');
  });
  it('rejects invalid query parameters with consistent validation errors', async () => {
    for (const extra of [
      { limitPerGroup: 0 },
      { limitPerGroup: 6 },
      { limitPerGroup: 1.5 },
      { limitPerGroup: 'nope' },
      { branch_id: 'invalid' },
      { model_id: 'invalid' },
    ]) {
      const response = await search('Baleno', extra);
      expect(response.status).toBe(422);
      expect(response.body.error.fields).toBeDefined();
    }
    expect((await search('x'.repeat(121))).status).toBe(422);
    expect((await request(app).get('/api/analytics/search?q=ab&q=cd').set(auth())).status).toBe(
      422,
    );
  });
  it('omits private customer data and full VINs from search payloads', async () => {
    const response = await search('Search Buyer');
    const serialized = JSON.stringify(response.body);
    for (const secret of [
      '9876543210',
      'private@search.test',
      'Private address',
      'SEARCHVIN12345678',
      'password_hash',
      'token_hash',
      'storage_key',
    ])
      expect(serialized).not.toContain(secret);
    const item = group(response.body, 'customers').items[0];
    expect(Object.keys(item).sort()).toEqual(['href', 'id', 'subtitle', 'title']);
  });
  it('blocks missing, malformed, expired and logged-out sessions without returning records', async () => {
    expect((await request(app).get('/api/analytics/search?q=Baleno')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/analytics/search?q=Baleno')
          .set('Authorization', 'Bearer invalid')
      ).status,
    ).toBe(401);
    await pool.query(
      "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
      [tokenHash(tokens.inventory)],
    );
    const expired = await search('Baleno', {}, 'inventory');
    expect(expired.status).toBe(401);
    expect(expired.body.groups).toBeUndefined();
    expect((await request(app).post('/api/auth/logout').set(auth('sales'))).status).toBe(200);
    const loggedOut = await search('Baleno', {}, 'sales');
    expect(loggedOut.status).toBe(401);
    expect(loggedOut.body.items).toBeUndefined();
  });
});
