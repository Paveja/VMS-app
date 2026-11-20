import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { verifyReads } from './test-reads.ts';
process.env.NODE_ENV = 'test';
if (
  !process.env.TEST_DATABASE_URL ||
  process.env.TEST_DATABASE_URL === process.env.DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')
)
  throw new Error('A separate *_test PostgreSQL database is required');
const testUrl = new URL(process.env.TEST_DATABASE_URL);
testUrl.searchParams.set('options', '-c search_path=dealerflow_test_suite');
process.env.DATABASE_URL = testUrl.toString();
process.env.DOCUMENT_ROOT = '.data/test-documents';
const { pool } = await import('./lib/db.ts');
const { migrate } = await import('../../../scripts/migrate.ts');
const { hashPassword } = await import('./lib/auth.ts');
const { app } = await import('./app.ts');
const password = 'Isolated-test-password-42';
const tokens: Record<string, string> = {};
let branchId: string;
let modelId: string;
let customerId: string;
let vehicleId: string;
let bookingId: string;
let orderId: string;
const auth = (role = 'admin') => ({ Authorization: `Bearer ${tokens[role]}` });
const post = (url: string, body: object = {}, role = 'admin') =>
  request(app).post(`/api${url}`).set(auth(role)).send(body);
beforeAll(async () => {
  await pool.query(
    'DROP SCHEMA IF EXISTS dealerflow_test_suite CASCADE; CREATE SCHEMA dealerflow_test_suite',
  );
  await migrate();
  const hash = await hashPassword(password);
  for (const role of ['admin', 'sales', 'inventory', 'manager']) {
    await pool.query('INSERT INTO employees(name,email,password_hash,role) VALUES($1,$2,$3,$1)', [
      role,
      `${role}@test.example`,
      hash,
    ]);
    const result = await request(app)
      .post('/api/auth/login')
      .send({ email: `${role}@test.example`, password });
    expect(result.status).toBe(200);
    tokens[role] = result.body.token;
  }
  branchId = (
    await pool.query(
      "INSERT INTO branches(name,city) VALUES('Test branch','Test city') RETURNING id",
    )
  ).rows[0].id;
});
afterAll(async () => {
  await pool.end();
  const { rm } = await import('node:fs/promises');
  await rm('.data/test-documents', { recursive: true, force: true });
});
describe('PostgreSQL VIN journey and security', () => {
  it('blocks missing/incorrect/expired auth and enforces all four role groups', async () => {
    expect((await request(app).get('/api/models')).status).toBe(401);
    expect(
      (await request(app).post('/api/auth/login').send({ email: 'missing@test.example', password }))
        .status,
    ).toBe(401);
    expect((await post('/models', {}, 'sales')).status).toBe(403);
    expect((await post('/customers', {}, 'inventory')).status).toBe(403);
    expect((await post('/models', {}, 'manager')).status).toBe(403);
    expect((await request(app).get('/api/auth/me').set(auth('sales'))).body.role).toBe('sales');
    const session = await pool.query('SELECT token_hash FROM sessions LIMIT 1');
    expect(session.rows[0].token_hash).toHaveLength(64);
  });
  it('creates persistent models, VINs and customers with validation and uniqueness', async () => {
    expect((await post('/models', {}, 'inventory')).status).toBe(422);
    const model = await post(
      '/models',
      {
        brand: 'Test',
        name: 'Road',
        variant: 'Plus',
        fuel: 'Petrol',
        transmission: 'Automatic',
        base_price_paise: '100000',
        image_key: 'suv',
      },
      'inventory',
    );
    expect(model.status).toBe(201);
    modelId = model.body.id;
    const vehicle = {
      vin: 'TESTVIN00000000001',
      model_id: modelId,
      branch_id: branchId,
      color: 'White',
      status: 'available',
    };
    const result = await post('/vehicles', vehicle, 'inventory');
    expect(result.status).toBe(201);
    vehicleId = result.body.id;
    expect((await post('/vehicles', vehicle)).status).toBe(409);
    const customer = await post(
      '/customers',
      {
        name: 'Test Buyer',
        phone: '+91 9876543210',
        email: 'buyer@example.test',
        address: 'Fictional address',
      },
      'sales',
    );
    expect(customer.status).toBe(201);
    customerId = customer.body.id;
    expect(
      (await pool.query('SELECT phone FROM customers WHERE id=$1', [customerId])).rows[0].phone,
    ).toBe('919876543210');
    expect(
      (
        await request(app)
          .patch(`/api/customers/${customerId}`)
          .set(auth('sales'))
          .send({ name: 'Updated Buyer', phone: '9876543210' })
      ).status,
    ).toBe(200);
  });
  it('commits exactly one concurrent VIN reservation and blocks committed stock edits', async () => {
    const results = await Promise.all([
      post('/bookings', { customer_id: customerId, vehicle_id: vehicleId }, 'sales'),
      post('/bookings', { customer_id: customerId, vehicle_id: vehicleId }, 'sales'),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    bookingId = results.find((result) => result.status === 201)!.body.id;
    expect(
      (
        await request(app).patch(`/api/vehicles/${vehicleId}`).set(auth('inventory')).send({
          vin: 'CHANGEDVIN00000001',
          model_id: modelId,
          branch_id: branchId,
          color: 'Blue',
          status: 'available',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await pool.query('SELECT count(*)::int AS count FROM bookings WHERE vehicle_id=$1', [
          vehicleId,
        ])
      ).rows[0].count,
    ).toBe(1);
  });
  it('converts once and preserves immutable invoice prices', async () => {
    expect((await post(`/bookings/${bookingId}/convert`, { total_paise: '1' })).status).toBe(422);
    const results = await Promise.all([
      post(`/bookings/${bookingId}/convert`, {}, 'sales'),
      post(`/bookings/${bookingId}/convert`, {}, 'sales'),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    orderId = results.find((result) => result.status === 201)!.body.id;
    expect((await post(`/bookings/${bookingId}/cancel`, {}, 'sales')).status).toBe(409);
    await pool.query("UPDATE vehicle_models SET base_price_paise='200000' WHERE id=$1", [modelId]);
    const invoice = await request(app).get(`/api/orders/${orderId}/invoice`).set(auth());
    expect(invoice.body.total_paise).toBe('100000');
    await expect(
      pool.query("UPDATE orders SET total_paise='1' WHERE id=$1", [orderId]),
    ).rejects.toThrow();
  });
  it('reserves payment capacity concurrently, does not count pending as cash and settles only once', async () => {
    expect((await post(`/orders/${orderId}/payments`, { amount_paise: '0' }, 'sales')).status).toBe(
      422,
    );
    expect(
      (await post(`/orders/${orderId}/payments`, { amount_paise: '100001' }, 'sales')).status,
    ).toBe(409);
    const results = await Promise.all([
      post(`/orders/${orderId}/payments`, { amount_paise: '100000' }, 'sales'),
      post(`/orders/${orderId}/payments`, { amount_paise: '100000' }, 'sales'),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const paymentId = results.find((result) => result.status === 201)!.body.id;
    expect(
      (await request(app).get(`/api/orders/${orderId}`).set(auth())).body.outstanding_paise,
    ).toBe('100000');
    expect(
      (await post(`/orders/${orderId}/payments/${paymentId}/settle`, {}, 'sales')).status,
    ).toBe(403);
    expect((await post(`/orders/${orderId}/deliver`, {}, 'manager')).status).toBe(409);
    const settlement = await Promise.all([
      post(`/orders/${orderId}/payments/${paymentId}/settle`, {}, 'manager'),
      post(`/orders/${orderId}/payments/${paymentId}/settle`, {}, 'manager'),
    ]);
    expect(settlement.map((result) => result.status).sort()).toEqual([200, 409]);
  });
  it('validates and protects documents, gates delivery, keeps lineage and sells atomically', async () => {
    const upload = (category: string, bytes = Buffer.from('%PDF-1.4\nFictional test\n%%EOF')) =>
      request(app)
        .post(`/api/orders/${orderId}/documents`)
        .set(auth('sales'))
        .field('category', category)
        .attach('file', bytes, { filename: 'test.pdf', contentType: 'application/pdf' });
    expect((await upload('identity', Buffer.from('not a pdf'))).status).toBe(422);
    expect((await upload('identity', Buffer.alloc(4194305))).status).toBe(413);
    const identity = await upload('identity');
    expect(identity.status).toBe(201);
    expect(
      (await request(app).get(`/api/orders/${orderId}/documents/${identity.body.id}/download`))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .get(`/api/orders/${orderId}/documents/${identity.body.id}/download`)
          .set(auth())
      ).status,
    ).toBe(200);
    expect(
      (
        await post(
          `/orders/${orderId}/documents/${identity.body.id}/review`,
          { status: 'verified' },
          'sales',
        )
      ).status,
    ).toBe(403);
    await post(
      `/orders/${orderId}/documents/${identity.body.id}/review`,
      { status: 'rejected', reason: 'Unreadable' },
      'manager',
    );
    expect((await post(`/orders/${orderId}/deliver`, {}, 'manager')).status).toBe(409);
    for (const category of ['identity', 'address']) {
      const document = await upload(category);
      expect(document.status).toBe(201);
      expect(
        (
          await post(
            `/orders/${orderId}/documents/${document.body.id}/review`,
            { status: 'verified' },
            'manager',
          )
        ).status,
      ).toBe(200);
    }
    const readiness = await request(app).get(`/api/orders/${orderId}`).set(auth());
    expect(readiness.body.ready).toBe(true);
    const summary = await request(app).get('/api/analytics/summary?period=all').set(auth());
    expect(summary.body.ready).toBe(1);
    expect(summary.body.payments).toBe('100000');
    const results = await Promise.all([
      post(`/orders/${orderId}/deliver`, {}, 'manager'),
      post(`/orders/${orderId}/deliver`, {}, 'manager'),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(
      (await pool.query('SELECT status FROM vehicles WHERE id=$1', [vehicleId])).rows[0].status,
    ).toBe('sold');
    expect((await upload('identity')).status).toBe(409);
    expect(
      (await post('/bookings', { customer_id: customerId, vehicle_id: vehicleId }, 'sales')).status,
    ).toBe(409);
  });
  it('cancels an unconverted booking once and releases its VIN', async () => {
    const vehicle = await post('/vehicles', {
      vin: 'CANCELVIN000000001',
      model_id: modelId,
      branch_id: branchId,
      color: 'Blue',
      status: 'available',
    });
    const booking = await post('/bookings', {
      customer_id: customerId,
      vehicle_id: vehicle.body.id,
    });
    expect((await post(`/bookings/${booking.body.id}/cancel`)).status).toBe(200);
    expect((await post(`/bookings/${booking.body.id}/cancel`)).status).toBe(409);
    expect(
      (await pool.query('SELECT status FROM vehicles WHERE id=$1', [vehicle.body.id])).rows[0]
        .status,
    ).toBe('available');
  });
  it('serves all bounded operational and analytics reads and rejects injection/invalid IDs', async () => {
    await verifyReads(app, tokens, { orderId, vehicleId, modelId, customerId, bookingId }, pool);
    expect(
      (await request(app).get('/api/models?sort=name;DROP%20TABLE%20models').set(auth())).status,
    ).toBe(422);
    expect((await request(app).get('/api/vehicles?branch_id=invalid').set(auth())).status).toBe(
      422,
    );
    const summary = await request(app).get('/api/analytics/summary').set(auth());
    const records = await request(app).get('/api/analytics/records?metric=available').set(auth());
    expect(summary.body.available).toBe(records.body.total);
  });
  it('logs out and invalidates persisted bearer token', async () => {
    expect((await post('/auth/logout', {}, 'sales')).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(auth('sales'))).status).toBe(401);
    await pool.query("UPDATE sessions SET expires_at=now()-interval '1 second'");
    expect((await request(app).get('/api/auth/me').set(auth())).status).toBe(401);
  });
});
