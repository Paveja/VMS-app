import { randomUUID } from 'node:crypto';
import { conversionSchema, paymentSchema } from '@dealerflow/contracts';
import { one, rows, transaction, requireState } from './db.ts';
import { insert } from './stock.ts';
export async function convertBooking(recordId: string, body: unknown) {
  const amounts = conversionSchema.parse(body);
  return transaction(async (connection) => {
    const booking = await one(connection, 'SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [
      recordId,
    ]);
    requireState(
      booking.status === 'confirmed',
      'Booking is not confirmed or was already converted',
    );
    const vehicle = await one(connection, 'SELECT * FROM vehicles WHERE id=$1 FOR UPDATE', [
      booking.vehicle_id,
    ]);
    requireState(vehicle.status === 'reserved', 'VIN must remain reserved');
    const model = await one(connection, 'SELECT * FROM vehicle_models WHERE id=$1', [
      vehicle.model_id,
    ]);
    const customer = await one(
      connection,
      'SELECT id,name,phone,email,address FROM customers WHERE id=$1',
      [booking.customer_id],
    );
    const branch = await one(connection, 'SELECT * FROM branches WHERE id=$1', [vehicle.branch_id]);
    const total =
      BigInt(model.base_price_paise) + BigInt(amounts.extras_paise) + BigInt(amounts.tax_paise);
    const order = await insert(connection, 'orders', {
      booking_id: recordId,
      base_price_paise: model.base_price_paise,
      ...amounts,
      total_paise: total.toString(),
      snapshot: JSON.stringify({ model, customer, branch, vin: vehicle.vin, color: vehicle.color }),
    });
    await insert(connection, 'invoices', {
      order_id: order.id,
      invoice_ref: `DF-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 12).toUpperCase()}`,
      amount_paise: total.toString(),
    });
    await connection.query(
      "UPDATE bookings SET status='converted',converted_at=now() WHERE id=$1",
      [recordId],
    );
    return order;
  });
}
export async function orderDetail(recordId: string) {
  return transaction(async (connection) => {
    const order = await one(connection, 'SELECT * FROM order_facts WHERE id=$1', [recordId]);
    const payments = await rows(
      connection,
      'SELECT * FROM payment_requests WHERE order_id=$1 ORDER BY created_at DESC LIMIT 100',
      [recordId],
    );
    const documents = await rows(
      connection,
      'SELECT id,order_id,category,status,filename,mime,size,uploader_id,reviewer_id,replaces_id,reason,created_at,reviewed_at FROM documents WHERE order_id=$1 ORDER BY created_at DESC LIMIT 100',
      [recordId],
    );
    return { ...order, payments, documents };
  }, true);
}
export async function createPayment(orderId: string, body: unknown, employeeId: string) {
  const input = paymentSchema.parse(body);
  return transaction(async (connection) => {
    const order = await one(connection, 'SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    requireState(order.status === 'open', 'Delivered orders cannot accept payment requests');
    const reserved = await one(
      connection,
      'SELECT coalesce(sum(amount_paise),0)::text AS total FROM payment_requests WHERE order_id=$1',
      [orderId],
    );
    requireState(
      BigInt(reserved.total) + BigInt(input.amount_paise) <= BigInt(order.total_paise),
      'Request exceeds unrequested balance',
    );
    return insert(connection, 'payment_requests', {
      ...input,
      order_id: orderId,
      creator_id: employeeId,
    });
  });
}
export async function settlePayment(orderId: string, paymentId: string, employeeId: string) {
  return transaction(async (connection) => {
    const order = await one(connection, 'SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    const payment = await one(
      connection,
      'SELECT * FROM payment_requests WHERE id=$1 AND order_id=$2 FOR UPDATE',
      [paymentId, orderId],
    );
    requireState(
      order.status === 'open' && payment.status === 'pending',
      'Payment cannot be settled again or after delivery',
    );
    const paid = await one(
      connection,
      "SELECT coalesce(sum(amount_paise),0)::text AS total FROM payment_requests WHERE order_id=$1 AND status='paid'",
      [orderId],
    );
    requireState(
      BigInt(paid.total) + BigInt(payment.amount_paise) <= BigInt(order.total_paise),
      'Settlement exceeds order balance',
    );
    return one(
      connection,
      "UPDATE payment_requests SET status='paid',paid_at=now(),reviewer_id=$2 WHERE id=$1 RETURNING *",
      [paymentId, employeeId],
    );
  });
}
export async function deliverOrder(orderId: string, employeeId: string) {
  return transaction(async (connection) => {
    const order = await one(connection, 'SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId]);
    requireState(order.status === 'open', 'Order was already delivered');
    const facts = await one(connection, 'SELECT * FROM order_facts WHERE id=$1', [orderId]);
    const vehicle = await one(connection, 'SELECT * FROM vehicles WHERE id=$1 FOR UPDATE', [
      facts.vehicle_id,
    ]);
    requireState(
      facts.ready && vehicle.status === 'reserved',
      'Delivery needs full settlement, verified Identity and Address, and a reserved VIN',
    );
    await connection.query("UPDATE vehicles SET status='sold' WHERE id=$1", [facts.vehicle_id]);
    return one(
      connection,
      "UPDATE orders SET status='delivered',delivered_at=now(),delivered_by=$2 WHERE id=$1 RETURNING *",
      [orderId, employeeId],
    );
  });
}
