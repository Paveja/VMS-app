import request from 'supertest';
import { expect } from 'vitest';
import type { Express } from 'express';
import type { Pool } from 'pg';
export async function verifyReads(
  app: Express,
  tokens: Record<string, string>,
  ids: Record<string, string>,
  pool: Pool,
) {
  const token = tokens.admin;
  const { orderId, vehicleId, modelId, customerId, bookingId } = ids;
  const routes = [
    'branches',
    'employees',
    'models',
    'vehicles',
    'customers',
    'bookings',
    'orders',
    'dashboard',
    'analytics/summary',
    'analytics/stock',
    'analytics/exceptions',
    'analytics/trends',
    'analytics/records?metric=payments',
    'analytics/search?q=Test',
    'analytics/activity',
    `analytics/journeys/${orderId}`,
    `vehicles/${vehicleId}`,
    `models/${modelId}`,
    `customers/${customerId}`,
    `bookings/${bookingId}`,
    `orders/${orderId}/payments`,
    `orders/${orderId}/documents`,
  ];
  for (const route of routes) {
    expect((await request(app).get(`/api/${route}`)).status, `unauthenticated ${route}`).toBe(401);
    expect(
      (
        await request(app)
          .get(`/api/${route}`)
          .set({ Authorization: `Bearer ${token}` })
      ).status,
      route,
    ).toBe(200);
  }
  await verifyCustomerEdits(app, tokens, customerId, pool);
}
async function verifyCustomerEdits(
  app: Express,
  tokens: Record<string, string>,
  customerId: string,
  pool: Pool,
) {
  const endpoint = `/api/customers/${customerId}`;
  const payload = {
    name: 'Persisted contact',
    phone: '9123456789',
    email: 'contact@example.test',
    address: 'Fictional test address',
  };
  const before = (await pool.query('SELECT name,phone FROM customers WHERE id=$1', [customerId]))
    .rows[0];
  expect((await request(app).patch(endpoint).send(payload)).status).toBe(401);
  expect(
    (
      await request(app)
        .patch(endpoint)
        .set('Authorization', `Bearer ${tokens.inventory}`)
        .send(payload)
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .patch(endpoint)
        .set('Authorization', `Bearer ${tokens.sales}`)
        .send({ name: '', phone: 'invalid' })
    ).status,
  ).toBe(422);
  expect(
    (await pool.query('SELECT name,phone FROM customers WHERE id=$1', [customerId])).rows[0],
  ).toEqual(before);
  const updated = await request(app)
    .patch(endpoint)
    .set('Authorization', `Bearer ${tokens.sales}`)
    .send(payload);
  expect(updated.status).toBe(200);
  expect(
    (await pool.query('SELECT name,phone,email,address FROM customers WHERE id=$1', [customerId]))
      .rows[0],
  ).toEqual(payload);
  const detail = await request(app).get(endpoint).set('Authorization', `Bearer ${tokens.sales}`);
  expect(detail.status).toBe(200);
  expect(detail.body.name).toBe(payload.name);
  expect(
    (
      await request(app)
        .get('/api/customers/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${tokens.sales}`)
    ).status,
  ).toBe(404);
  expect(
    (await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: '' }))
      .status,
  ).toBe(422);
  expect(
    (
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.example', password: 'Definitely-incorrect-test-password' })
    ).status,
  ).toBe(401);
}
