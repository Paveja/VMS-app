import { type Query, businessWindow } from '@dealerflow/contracts';
import { rows, one, pool, type Connection } from './db.ts';
import { vehicleSelect, bookingSelect, scope } from './stock.ts';
export type Resource = 'models' | 'vehicles' | 'customers' | 'bookings' | 'orders';
const definitions = {
  models: {
    select: 'SELECT m.* FROM vehicle_models m',
    alias: 'm',
    search: "concat_ws(' ',m.brand,m.name,m.variant,m.fuel,m.transmission)",
    date: 'm.created_at',
  },
  vehicles: {
    select: vehicleSelect,
    alias: 'v',
    search: "concat_ws(' ',v.vin,v.color,m.brand,m.name,m.variant)",
    date: 'v.created_at',
  },
  customers: {
    select: 'SELECT c.* FROM customers c',
    alias: 'c',
    search: "concat_ws(' ',c.name,c.phone,c.email)",
    date: 'c.created_at',
  },
  bookings: {
    select: bookingSelect,
    alias: 'b',
    search: "concat_ws(' ',b.id::text,v.vin,c.name,m.name)",
    date: 'b.booked_at',
  },
  orders: {
    select: 'SELECT f.* FROM order_facts f',
    alias: 'f',
    search: "concat_ws(' ',f.id::text,f.invoice_ref,f.vin,f.customer_name,f.model_name)",
    date: 'f.created_at',
  },
};
export async function paginate(
  connection: Connection,
  select: string,
  params: unknown[],
  query: Query,
  sort: string,
) {
  const count = await one(
    connection,
    `SELECT count(*)::int AS total FROM (${select}) records`,
    params,
  );
  const items = await rows(
    connection,
    `${select} ORDER BY ${sort} ${query.direction.toUpperCase()},id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, query.limit, (query.page - 1) * query.limit],
  );
  return { items, total: count.total, page: query.page, limit: query.limit };
}
export async function listResource(
  resource: Resource,
  query: Query,
  connection: Connection = pool,
) {
  const definition = definitions[resource];
  const params: unknown[] = [];
  const conditions: string[] = [];
  const add = (expression: string, value: unknown) => {
    params.push(value);
    conditions.push(`${expression}$${params.length}`);
  };
  if (query.q) add(`${definition.search} ILIKE `, `%${query.q}%`);
  if (['vehicles', 'bookings', 'orders'].includes(resource)) {
    const scoped = scope(query, resource === 'orders' ? 'f' : 'v', params);
    conditions.push(...scoped.conditions);
    if (query.status) add(`${definition.alias}.status=`, query.status);
  }
  if (resource === 'models' || resource === 'vehicles') {
    for (const key of ['brand', 'variant', 'fuel', 'transmission'] as const)
      if (query[key]) add(`m.${key}=`, query[key]);
    if (query.model_id && resource === 'models') add('m.id=', query.model_id);
    if (resource === 'vehicles' && query.color) add('v.color=', query.color);
  }
  if (query.metric === 'available' && resource === 'vehicles')
    conditions.push("v.status='available'");
  if (query.metric === 'in_transit' && resource === 'vehicles')
    conditions.push("v.status='in_transit'");
  if (query.metric === 'aged' && resource === 'vehicles')
    conditions.push("v.status='available' AND v.created_at < now()-interval '30 days'");
  if (query.metric === 'active_bookings' && resource === 'bookings')
    conditions.push("b.status='confirmed' AND v.status='reserved'");
  if (resource === 'orders') {
    if (
      [
        'open_orders',
        'outstanding',
        'ready',
        'payment',
        'documents',
        'combined',
        'pending',
      ].includes(query.metric ?? '')
    )
      conditions.push("f.status='open'");
    if (query.metric === 'ready') conditions.push('f.ready');
    if (query.metric === 'outstanding' || query.metric === 'payment')
      conditions.push('f.outstanding_paise::bigint>0');
    if (query.metric === 'documents')
      conditions.push('NOT(f.identity_verified AND f.address_verified)');
    if (query.metric === 'combined')
      conditions.push(
        'f.outstanding_paise::bigint>0 AND NOT(f.identity_verified AND f.address_verified)',
      );
    if (query.metric === 'pending') conditions.push('f.pending_paise::bigint>0');
    if (query.metric === 'delivered') conditions.push("f.status='delivered'");
  }
  if (query.event && query.period !== 'all') {
    const window = businessWindow(query);
    const date =
      query.event === 'deliveries' && resource === 'orders' ? 'f.delivered_at' : definition.date;
    add(`${date}>=`, window.start);
    add(`${date}<`, window.end);
  }
  const select = `${definition.select}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`;
  const sorts: Record<string, string> = {
    created_at: definition.date,
    name:
      resource === 'models'
        ? 'm.name'
        : resource === 'customers'
          ? 'c.name'
          : resource === 'orders'
            ? 'f.customer_name'
            : resource === 'vehicles'
              ? 'm.name'
              : 'c.name',
    status: ['models', 'customers'].includes(resource)
      ? definition.date
      : `${definition.alias}.status`,
    vin:
      resource === 'orders'
        ? 'f.vin'
        : ['vehicles', 'bookings'].includes(resource)
          ? 'v.vin'
          : definition.date,
    total_paise: resource === 'orders' ? 'f.total_paise' : definition.date,
  };
  return paginate(connection, select, params, query, sorts[query.sort]);
}
