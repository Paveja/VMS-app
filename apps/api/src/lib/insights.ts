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
