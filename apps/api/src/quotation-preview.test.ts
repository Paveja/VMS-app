import 'dotenv/config';
import { randomUUID, randomBytes } from 'node:crypto';
import { beforeAll, afterAll, expect, it } from 'vitest';
import request from 'supertest';
process.env.NODE_ENV = 'test';
if (
  !process.env.TEST_DATABASE_URL ||
  process.env.TEST_DATABASE_URL === process.env.DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')
)
  throw new Error('A separate *_test PostgreSQL database is required');
const schema = `dealerflow_quote_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.TEST_DATABASE_URL);
url.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
const { pool } = await import('./lib/db.ts');
const { migrate } = await import('../../../scripts/migrate.ts');
const { hashPassword, tokenHash } = await import('./lib/auth.ts');
const { app } = await import('./app.ts');
const model = randomUUID();
const inactiveModel = randomUUID();
const branch = randomUUID();
const branchTwo = randomUUID();
const otherCity = randomUUID();
const inactiveBranch = randomUUID();
const tokens: Record<string, string> = {};
const input = { model_id: model, model_year: 2026, quantity: 3, city: 'Hyderabad' };
const preview = (body: object = input, role = 'sales') =>
  request(app)
    .post('/api/quotations/preview')
    .set('Authorization', `Bearer ${tokens[role]}`)
    .send(body);
beforeAll(async () => {
  await pool.query(`CREATE SCHEMA ${schema}`);
  await migrate();
  const hash = await hashPassword(randomUUID());
  const employees = await pool.query(
    `INSERT INTO employees(name,email,password_hash,role)
    SELECT role,role||'@prototype.test',$1,role FROM unnest($2::text[]) role RETURNING id,role`,
    [hash, ['sales', 'inventory']],
  );
  for (const employee of employees.rows) {
    const token = randomBytes(32).toString('base64url');
    tokens[employee.role] = token;
    await pool.query(
      `INSERT INTO sessions(token_hash,employee_id,expires_at)
      VALUES($1,$2,now()+interval '1 hour')`,
      [tokenHash(token), employee.id],
    );
  }
  await pool.query(
    `INSERT INTO vehicle_models(id,brand,name,variant,fuel,transmission,base_price_paise,active)
    VALUES($1,'Aster','Crest','VX','Petrol','Automatic',10000001,true),
      ($2,'Aster','Old','VX','Petrol','Manual',10000000,false)`,
    [model, inactiveModel],
  );
  await pool.query(
    `INSERT INTO branches(id,name,city,active)
    VALUES($1,'Banjara Hills','Hyderabad',true),($2,'Jubilee Hills','Hyderabad',true),
      ($3,'Whitefield','Bengaluru',true),($4,'Inactive','Hyderabad',false)`,
    [branch, branchTwo, otherCity, inactiveBranch],
  );
  await pool.query(
    `INSERT INTO vehicles(vin,model_id,branch_id,color,status,received_at) VALUES
    ('PROTOTYPE-001',$1,$2,'White','available',now()),
    ('PROTOTYPE-002',$1,$3,'White','available',NULL),
    ('PROTOTYPE-003',$1,$2,'White','in_transit',NULL),
    ('PROTOTYPE-004',$1,$2,'White','reserved',NULL),
    ('PROTOTYPE-005',$1,$2,'White','sold',NULL),
    ('PROTOTYPE-006',$1,$4,'White','available',NULL),
    ('PROTOTYPE-007',$1,$5,'White','available',now())`,
    [model, branch, branchTwo, otherCity, inactiveBranch],
  );
});
afterAll(async () => {
  await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
});
it('calculates exact-paise per-vehicle and quantity totals from the persisted catalog', async () => {
  const response = await preview();
  expect(response.status).toBe(200);
  expect(response.body.vehicle).toMatchObject({ brand: 'Aster', name: 'Crest', variant: 'VX' });
  expect(response.body.unit_paise).toBe('14700001');
  expect(response.body.total_paise).toBe('44100003');
  expect(response.body.components).toHaveLength(3);
  expect(response.body.disclosure).toBe('Demo estimate—not live market pricing');
  expect(response.body.source).toContain('simulated');
  expect(response.body.request.model_year).toBe(2026);
  expect(Number.isNaN(Date.parse(response.body.checked_at))).toBe(false);
  const other = await preview({ ...input, city: 'Bengaluru' });
  expect(other.body.unit_paise).toBe('15300001');
  expect(other.body.stock.available).toBe(1);
});
it('aggregates real stock across active city branches without treating reserved or sold stock as available', async () => {
  const response = await preview();
  expect(response.body.stock).toMatchObject({
    available: 2,
    in_transit: 1,
    received: 1,
    total_branches: 2,
  });
  expect(response.body.stock.branches).toHaveLength(2);
  expect(response.body.stock).not.toHaveProperty('ready');
  expect(response.body.stock).not.toHaveProperty('exact_year_available');
  const otherYear = await preview({ ...input, model_year: 2025 });
  expect(otherYear.body.stock).toEqual(response.body.stock);
  expect(otherYear.body.total_paise).toBe(response.body.total_paise);
});
it('does not reserve, mutate or manufacture inventory when calculating or repeating an estimate', async () => {
  const before = await pool.query('SELECT * FROM vehicles ORDER BY id');
  expect((await preview()).status).toBe(200);
  expect((await preview()).status).toBe(200);
  expect((await pool.query('SELECT * FROM vehicles ORDER BY id')).rows).toEqual(before.rows);
  await pool.query('UPDATE vehicle_models SET base_price_paise=20000000 WHERE id=$1', [model]);
  expect((await preview()).body.unit_paise).toBe('25900000');
  await pool.query('UPDATE vehicle_models SET base_price_paise=10000001 WHERE id=$1', [model]);
});
it('validates all requested fields and rejects client-provided prices and SQL-shaped identifiers', async () => {
  for (const extra of [
    { quantity: 0 },
    { quantity: 1.5 },
    { quantity: 1000 },
    { model_year: 0 },
    { model_year: 3000 },
    { city: 'Delhi' },
    { model_id: "' OR true --" },
    { total_paise: '1' },
    { unit_paise: '1' },
  ])
    expect((await preview({ ...input, ...extra })).status).toBe(422);
  expect((await preview({})).status).toBe(422);
  expect((await preview({ ...input, model_id: inactiveModel })).status).toBe(404);
  expect((await preview({ ...input, model_id: randomUUID() })).status).toBe(404);
});
it('keeps existing authenticated read access and rejects missing, invalid and expired sessions', async () => {
  expect((await preview(input, 'inventory')).status).toBe(200);
  expect((await request(app).post('/api/quotations/preview').send(input)).status).toBe(401);
  expect(
    (
      await request(app)
        .post('/api/quotations/preview')
        .set('Authorization', 'Bearer invalid')
        .send(input)
    ).status,
  ).toBe(401);
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO sessions(token_hash,employee_id,expires_at)
    SELECT $1,id,now()-interval '1 hour' FROM employees WHERE role='sales'`,
    [tokenHash(token)],
  );
  expect(
    (
      await request(app)
        .post('/api/quotations/preview')
        .set('Authorization', `Bearer ${token}`)
        .send(input)
    ).status,
  ).toBe(401);
});
it('returns zero stock honestly and rejects a city without an active branch', async () => {
  const empty = randomUUID();
  await pool.query(
    `INSERT INTO vehicle_models(id,brand,name,variant,fuel,transmission,base_price_paise)
    VALUES($1,'Meridian','Arc','Base','Petrol','Manual',10000000)`,
    [empty],
  );
  const response = await preview({ ...input, model_id: empty });
  expect(response.status).toBe(200);
  expect(response.body.stock).toMatchObject({ available: 0, in_transit: 0, received: 0 });
  await pool.query('UPDATE branches SET active=false WHERE id=$1', [otherCity]);
  expect((await preview({ ...input, city: 'Bengaluru' })).status).toBe(422);
});
it('bounds branch details while calculating totals over all matching stock', async () => {
  await pool.query(
    `WITH created AS (
      INSERT INTO branches(name,city) SELECT 'Extra '||number,'Hyderabad'
      FROM generate_series(1,21) number RETURNING id
    ) INSERT INTO vehicles(vin,model_id,branch_id,color,status)
      SELECT 'PROTOTYPE-'||id::text,$1,id,'White','available' FROM created`,
    [model],
  );
  const response = await preview();
  expect(response.body.stock.branches).toHaveLength(20);
  expect(response.body.stock.total_branches).toBe(23);
  expect(response.body.stock.available).toBe(23);
});
