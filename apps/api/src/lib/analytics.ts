import { businessWindow, type Query } from '@dealerflow/contracts';
import { one, rows, transaction, type Connection } from './db.ts';
import { scope } from './stock.ts';
import { listResource, paginate } from './lists.ts';
export function metadata(query: Query) {
  return {
    asOf: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    effectiveFilters: query,
    units: { money: 'INR paise', counts: 'records' },
    calculationVersion: '2.0',
    historyNote:
      'Derived from stored event timestamps; not a complete audit log. No historical inventory snapshots.',
    window: query.period === 'all' ? null : businessWindow(query),
  };
}
export function scoped(query: Query, alias: string) {
  const result = scope(query, alias);
  return { ...result, where: result.conditions.length ? result.conditions.join(' AND ') : 'true' };
}
export async function summary(query: Query) {
  return transaction(async (connection) => {
    const inventory = scoped(query, 'v');
    const orders = scoped(query, 'f');
    const stock = await one(
      connection,
      `SELECT count(*) FILTER(WHERE status='available')::int AS available,count(*) FILTER(WHERE status='in_transit')::int AS in_transit,count(*) FILTER(WHERE status='reserved')::int AS reserved,count(*) FILTER(WHERE status='sold')::int AS sold FROM vehicles v WHERE ${inventory.where}`,
      inventory.params,
    );
    const booking = await one(
      connection,
      `SELECT count(*)::int AS active_bookings FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id WHERE b.status='confirmed' AND v.status='reserved' AND ${inventory.where}`,
      inventory.params,
    );
    const order = await one(
      connection,
      `SELECT count(*) FILTER(WHERE status='open')::int AS open_orders,coalesce(sum(outstanding_paise::bigint) FILTER(WHERE status='open'),0)::text AS outstanding,count(*) FILTER(WHERE ready)::int AS ready,count(*) FILTER(WHERE status='open' AND outstanding_paise::bigint>0 AND identity_verified AND address_verified)::int AS payment_only,count(*) FILTER(WHERE status='open' AND outstanding_paise::bigint=0 AND NOT(identity_verified AND address_verified))::int AS document_only,count(*) FILTER(WHERE status='open' AND outstanding_paise::bigint>0 AND NOT(identity_verified AND address_verified))::int AS combined,coalesce(sum(total_paise),0)::text AS invoiced_value FROM order_facts f WHERE ${orders.where}`,
      orders.params,
    );
    const payments = await paymentRecords(connection, query, true);
    return {
      ...metadata(query),
      ...stock,
      ...booking,
      ...order,
      payments: 'total_paise' in payments ? payments.total_paise : '0',
      definitions: {
        available: 'Current available VINs; event dates do not apply.',
        active_bookings: 'Confirmed bookings with a reserved VIN; current snapshot.',
        open_orders: 'Orders not yet delivered; current snapshot.',
        payments:
          'Settled payment requests with paid_at in the selected event window; not recognized revenue.',
        outstanding:
          'Open order totals minus settled payments. Pending requests do not reduce outstanding.',
        ready:
          'Open order, reserved VIN, zero outstanding, latest verified Identity and Address documents.',
      },
    };
  }, true);
}
export async function paymentRecords(connection: Connection, query: Query, aggregate = false) {
  const filters = scoped(query, 'f');
  const conditions = [filters.where, "p.status='paid'"];
  if (query.period !== 'all') {
    const window = businessWindow(query);
    filters.params.push(window.start, window.end);
    conditions.push(
      `p.paid_at >= $${filters.params.length - 1} AND p.paid_at < $${filters.params.length}`,
    );
  }
  const select = `SELECT p.*,f.invoice_ref,f.vin,f.branch_name,f.model_name FROM payment_requests p JOIN order_facts f ON f.id=p.order_id WHERE ${conditions.join(' AND ')}`;
  if (aggregate)
    return one(
      connection,
      `SELECT coalesce(sum(amount_paise),0)::text AS total_paise FROM (${select}) paid`,
      filters.params,
    );
  return paginate(connection, select, filters.params, query, 'paid_at');
}
export async function records(query: Query) {
  return transaction(async (connection) => {
    const metric = query.metric ?? 'open_orders';
    const result =
      metric === 'payments'
        ? await paymentRecords(connection, query)
        : await listResource(
            ['available', 'in_transit', 'aged'].includes(metric)
              ? 'vehicles'
              : metric === 'active_bookings'
                ? 'bookings'
                : 'orders',
            query,
            connection,
          );
    return { ...metadata(query), ...result };
  }, true);
}
export async function stock(query: Query) {
  return transaction(async (connection) => {
    const filters = scoped(query, 'v');
    const distribution = await rows(
      connection,
      `SELECT status,count(*)::int AS count FROM vehicles v WHERE ${filters.where} GROUP BY status ORDER BY status`,
      filters.params,
    );
    const branches = await rows(
      connection,
      `SELECT br.id,br.name,count(v.id) FILTER(WHERE v.status='available')::int AS available,count(v.id) FILTER(WHERE v.status='reserved')::int AS reserved,count(v.id) FILTER(WHERE EXISTS(SELECT 1 FROM bookings b WHERE b.vehicle_id=v.id AND b.status='confirmed'))::int AS active_bookings FROM branches br LEFT JOIN vehicles v ON v.branch_id=br.id AND ${filters.where} GROUP BY br.id ORDER BY br.name LIMIT 100`,
      filters.params,
    );
    const models = await paginate(
      connection,
      `SELECT m.*,count(v.id) FILTER(WHERE v.status='available')::int AS available,count(v.id) FILTER(WHERE v.status='reserved')::int AS reserved FROM vehicle_models m LEFT JOIN vehicles v ON v.model_id=m.id AND ${filters.where} ${query.model_id ? `WHERE m.id=$${filters.params.length}` : ''} GROUP BY m.id`,
      filters.params,
      query,
      'created_at',
    );
    const comparisonParams = [...filters.params];
    const eventWindow =
      query.period === 'all'
        ? ''
        : (() => {
            const window = businessWindow(query);
            comparisonParams.push(window.start, window.end);
            return ` AND delivered_at >= $${comparisonParams.length - 1} AND delivered_at < $${comparisonParams.length}`;
          })();
    const comparison = await rows(
      connection,
      `SELECT branch_id,branch_name,count(*) FILTER(WHERE status='open')::int AS open_orders,coalesce(sum(outstanding_paise::bigint) FILTER(WHERE status='open'),0)::text AS outstanding,count(*) FILTER(WHERE ready)::int AS ready,count(*) FILTER(WHERE status='delivered'${eventWindow})::int AS delivered FROM order_facts f WHERE ${scoped(query, 'f').where} GROUP BY branch_id,branch_name ORDER BY branch_name LIMIT 100`,
      comparisonParams,
    );
    return { ...metadata(query), distribution, branches, models, comparison };
  }, true);
}
export async function exceptions(query: Query) {
  return transaction(async (connection) => {
    const filters = scoped(query, 'f');
    const select = `SELECT f.*,CASE WHEN ready THEN 'Ready for handover' WHEN outstanding_paise::bigint>0 AND NOT(identity_verified AND address_verified) THEN 'Payment and documents required' WHEN outstanding_paise::bigint>0 THEN 'Payment settlement required' ELSE 'Document verification required' END AS reason,CASE WHEN ready THEN 0 WHEN pending_paise::bigint>0 THEN 1 ELSE 2 END AS priority FROM order_facts f WHERE status='open' AND ${filters.where}${query.metric === 'ready' ? ' AND ready' : query.metric === 'pending' ? ' AND pending_paise::bigint>0' : query.metric === 'combined' ? ' AND outstanding_paise::bigint>0 AND NOT(identity_verified AND address_verified)' : query.metric === 'payment' ? ' AND outstanding_paise::bigint>0' : query.metric === 'documents' ? ' AND NOT(identity_verified AND address_verified)' : ''}`;
    return {
      ...metadata(query),
      ...(await paginate(connection, select, filters.params, query, 'priority')),
    };
  }, true);
}
