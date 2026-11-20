import {
  bookingSchema,
  customerSchema,
  modelSchema,
  vehicleSchema,
  type Query,
} from '@dealerflow/contracts';
import { pool, one, rows, transaction, requireState, type Connection } from './db.ts';
export const vehicleSelect = `SELECT v.*,m.brand,m.name AS model_name,m.variant,m.fuel,m.transmission,m.image_key,m.base_price_paise,br.name AS branch_name FROM vehicles v JOIN vehicle_models m ON m.id=v.model_id JOIN branches br ON br.id=v.branch_id`;
export const bookingSelect = `SELECT b.*,v.vin,v.branch_id,v.model_id,v.color,m.brand,m.name AS model_name,m.variant,m.image_key,c.name AS customer_name,br.name AS branch_name,e.name AS salesperson,o.id AS order_id FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id JOIN vehicle_models m ON m.id=v.model_id JOIN customers c ON c.id=b.customer_id JOIN branches br ON br.id=v.branch_id JOIN employees e ON e.id=b.employee_id LEFT JOIN orders o ON o.booking_id=b.id`;
export async function insert(
  connection: Connection,
  table: string,
  input: Record<string, unknown>,
) {
  const keys = Object.keys(input);
  return one(
    connection,
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *`,
    Object.values(input),
  );
}
export async function update(
  connection: Connection,
  table: string,
  recordId: string,
  input: Record<string, unknown>,
) {
  const keys = Object.keys(input);
  return one(
    connection,
    `UPDATE ${table} SET ${keys.map((key, index) => `${key}=$${index + 2}`).join(',')} WHERE id=$1 RETURNING *`,
    [recordId, ...Object.values(input)],
  );
}
export const saveModel = (body: unknown, recordId?: string) => {
  const input = modelSchema.parse(body);
  return recordId
    ? update(pool, 'vehicle_models', recordId, input)
    : insert(pool, 'vehicle_models', input);
};
export const saveCustomer = (body: unknown, recordId?: string) => {
  const input = customerSchema.parse(body);
  return recordId ? update(pool, 'customers', recordId, input) : insert(pool, 'customers', input);
};
export async function saveVehicle(body: unknown, recordId?: string) {
  const input = vehicleSchema.parse(body);
  return transaction(async (connection) => {
    if (recordId) {
      const current = await one(connection, 'SELECT * FROM vehicles WHERE id=$1 FOR UPDATE', [
        recordId,
      ]);
      requireState(
        ['available', 'in_transit'].includes(current.status),
        'Committed stock cannot be edited',
      );
      return update(connection, 'vehicles', recordId, input);
    }
    return insert(connection, 'vehicles', input);
  });
}
export async function createBooking(body: unknown, employeeId: string) {
  const input = bookingSchema.parse(body);
  return transaction(async (connection) => {
    const vehicle = await one(connection, 'SELECT * FROM vehicles WHERE id=$1 FOR UPDATE', [
      input.vehicle_id,
    ]);
    requireState(vehicle.status === 'available', 'VIN is no longer available');
    const booking = await insert(connection, 'bookings', {
      ...input,
      employee_id: employeeId,
      status: 'confirmed',
    });
    await connection.query("UPDATE vehicles SET status='reserved' WHERE id=$1", [vehicle.id]);
    return booking;
  });
}
export async function cancelBooking(recordId: string) {
  return transaction(async (connection) => {
    const booking = await one(connection, 'SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [
      recordId,
    ]);
    requireState(
      booking.status === 'confirmed',
      'Only confirmed, unconverted bookings can be cancelled',
    );
    const vehicle = await one(connection, 'SELECT * FROM vehicles WHERE id=$1 FOR UPDATE', [
      booking.vehicle_id,
    ]);
    requireState(vehicle.status === 'reserved', 'VIN reservation is inconsistent');
    await connection.query("UPDATE vehicles SET status='available' WHERE id=$1", [
      booking.vehicle_id,
    ]);
    return one(
      connection,
      "UPDATE bookings SET status='cancelled',cancelled_at=now() WHERE id=$1 RETURNING *",
      [recordId],
    );
  });
}
export async function customerDetail(recordId: string) {
  const customer = await one(pool, 'SELECT * FROM customers WHERE id=$1', [recordId]);
  const [bookings, orders] = await Promise.all([
    rows(pool, `${bookingSelect} WHERE b.customer_id=$1 ORDER BY b.booked_at DESC LIMIT 100`, [
      recordId,
    ]),
    rows(
      pool,
      'SELECT * FROM order_facts WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 100',
      [recordId],
    ),
  ]);
  return { ...customer, bookings, orders };
}
export function scope(query: Query, alias: string, params: unknown[] = []) {
  const conditions: string[] = [];
  for (const key of ['branch_id', 'model_id'] as const)
    if (query[key]) {
      params.push(query[key]);
      conditions.push(`${alias}.${key}=$${params.length}`);
    }
  return { params, conditions };
}
