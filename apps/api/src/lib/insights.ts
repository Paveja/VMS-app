import { businessWindow, type Query } from '@dealerflow/contracts';
import { rows, transaction } from './db.ts';
import { metadata, scoped } from './analytics.ts';
export async function trends(query: Query) {
  return transaction(async (connection) => {
    const window = businessWindow(query.period === 'all' ? { ...query, period: '30d' } : query);
    const scope = scoped(query, 'v');
    scope.params.push(window.start, window.end);
    const start = `$${scope.params.length - 1}`;
    const end = `$${scope.params.length}`;
    const items = await rows(
      connection,
      `WITH events AS (
    SELECT b.booked_at AS at,'bookings' AS type,0::bigint AS amount FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id WHERE ${scope.where}
    UNION ALL SELECT o.created_at,'orders',0 FROM orders o JOIN bookings b ON b.id=o.booking_id JOIN vehicles v ON v.id=b.vehicle_id WHERE ${scope.where}
    UNION ALL SELECT p.paid_at,'payments',p.amount_paise FROM payment_requests p JOIN orders o ON o.id=p.order_id JOIN bookings b ON b.id=o.booking_id JOIN vehicles v ON v.id=b.vehicle_id WHERE p.status='paid' AND ${scope.where}
    UNION ALL SELECT o.delivered_at,'deliveries',0 FROM orders o JOIN bookings b ON b.id=o.booking_id JOIN vehicles v ON v.id=b.vehicle_id WHERE o.delivered_at IS NOT NULL AND ${scope.where}
  ), days AS (SELECT generate_series((${start}::timestamptz AT TIME ZONE 'Asia/Kolkata')::date,((${end}::timestamptz-interval '1 second') AT TIME ZONE 'Asia/Kolkata')::date,'1 day')::date AS day)
  SELECT to_char(d.day,'YYYY-MM-DD') AS day,count(e.at) FILTER(WHERE type='bookings')::int AS bookings,count(e.at) FILTER(WHERE type='orders')::int AS orders,count(e.at) FILTER(WHERE type='deliveries')::int AS deliveries,coalesce(sum(amount) FILTER(WHERE type='payments'),0)::text AS payments_paise FROM days d LEFT JOIN events e ON (e.at AT TIME ZONE 'Asia/Kolkata')::date=d.day AND e.at>=${start} AND e.at<${end} GROUP BY d.day ORDER BY d.day LIMIT 366`,
      scope.params,
    );
    return {
      ...metadata(query),
      items,
      explanation:
        'Actual stored event dates; zero means no recorded event. All-time selection shows the last 30 days in this bounded chart. Insufficient history for growth or cohort conversion claims.',
    };
  }, true);
}
export async function search(query: Query) {
  return transaction(async (connection) => {
    if (query.q.length < 2) return { ...metadata(query), items: [] };
    const filters = scoped(query, 'v');
    filters.params.push(`%${query.q}%`);
    const search = `$${filters.params.length}`;
    const vehicles = await rows(
      connection,
      `SELECT v.id,'VIN / model' AS type,concat(m.brand,' ',m.name,' · ',v.vin) AS label,'/inventory/'||v.id AS route FROM vehicles v JOIN vehicle_models m ON m.id=v.model_id WHERE ${filters.where} AND concat_ws(' ',v.vin,m.brand,m.name,m.variant) ILIKE ${search} ORDER BY v.created_at DESC LIMIT 5`,
      filters.params,
    );
    const orders = await rows(
      connection,
      `SELECT o.id,'Order / invoice' AS type,concat(o.invoice_ref,' · ',o.customer_name) AS label,'/orders/'||o.id AS route FROM order_facts o JOIN vehicles v ON v.id=o.vehicle_id WHERE ${filters.where} AND concat_ws(' ',o.id::text,o.invoice_ref,o.customer_name) ILIKE ${search} ORDER BY o.created_at DESC LIMIT 5`,
      filters.params,
    );
    const bookings = await rows(
      connection,
      `SELECT b.id,'Booking' AS type,concat(left(b.id::text,8),' · ',v.vin) AS label,'/bookings/'||b.id AS route FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id WHERE ${filters.where} AND b.id::text ILIKE ${search} ORDER BY b.booked_at DESC LIMIT 5`,
      filters.params,
    );
    const customers = await rows(
      connection,
      `SELECT c.id,'Customer' AS type,c.name AS label,'/customers/'||c.id AS route FROM customers c WHERE c.name ILIKE $1 ${query.branch_id || query.model_id ? `AND EXISTS(SELECT 1 FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id WHERE b.customer_id=c.id AND ${filters.where.replace(/\$(\d+)/g, (_match, index) => `$${Number(index) + 1}`)})` : ''} ORDER BY c.name LIMIT 5`,
      [`%${query.q}%`, ...filters.params.slice(0, -1)],
    );
    return { ...metadata(query), items: [...vehicles, ...orders, ...bookings, ...customers] };
  }, true);
}
export async function activity(query: Query) {
  return transaction(async (connection) => {
    const filters = scoped(query, 'f');
    const items = await rows(
      connection,
      `SELECT id,invoice_ref AS label,created_at AS at,'Order created' AS event,'/orders/'||id AS route FROM order_facts f WHERE ${filters.where} UNION ALL SELECT id,invoice_ref,delivered_at,'Vehicle delivered','/orders/'||id FROM order_facts f WHERE delivered_at IS NOT NULL AND ${filters.where} ORDER BY at DESC LIMIT 8`,
      filters.params,
    );
    return { ...metadata(query), items };
  }, true);
}
