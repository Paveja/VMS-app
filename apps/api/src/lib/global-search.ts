import type { SearchGroup, SearchItem, SearchQuery } from '@dealerflow/contracts';
import { rows, transaction } from './db.ts';
import { metadata, scoped } from './analytics.ts';

type SearchRow = SearchItem & { category: SearchGroup['type'] };
const categories = ['vehicles', 'customers', 'bookings', 'orders'] as const;
const legacyTypes = {
  vehicles: 'VIN / model',
  customers: 'Customer',
  bookings: 'Booking',
  orders: 'Order / invoice',
};

export async function search(query: SearchQuery) {
  const meta = metadata({ ...query, period: 'all' });
  if (query.q.length < 2) return { ...meta, query: query.q, groups: [], items: [] };
  return transaction(async (connection) => {
    const filters = scoped(query, 'v');
    // Treat PostgreSQL LIKE metacharacters as literal text, never a wildcard request.
    filters.params.push(`%${query.q.replace(/[\\%_]/g, '\\$&')}%`);
    const term = `$${filters.params.length}`;
    filters.params.push(query.limitPerGroup + 1);
    const limit = `$${filters.params.length}`;
    const matches = await rows<SearchRow>(
      connection,
      `WITH vehicle_matches AS (
        SELECT v.id, 'vehicles' AS category,
          concat_ws(' ',m.brand,m.name,m.variant) AS title,
          concat('VIN ••••',right(v.vin,4),' · ',replace(v.status,'_',' '),' · ',br.name) AS subtitle,
          '/inventory/'||v.id AS href, v.status
        FROM vehicles v JOIN vehicle_models m ON m.id=v.model_id
          JOIN branches br ON br.id=v.branch_id
        WHERE ${filters.where} AND (
          v.vin ILIKE ${term} OR concat_ws(' ',m.brand,m.name,m.variant) ILIKE ${term})
        ORDER BY title,v.id LIMIT ${limit}
      ), customer_matches AS (
        SELECT c.id, 'customers' AS category, c.name AS title,
          'Customer record' AS subtitle, '/customers/'||c.id AS href, NULL::text AS status
        FROM customers c WHERE c.name ILIKE ${term}
          ${query.branch_id || query.model_id ? `AND EXISTS(SELECT 1 FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id WHERE b.customer_id=c.id AND ${filters.where})` : ''}
        ORDER BY c.name,c.id LIMIT ${limit}
      ), booking_matches AS (
        SELECT b.id, 'bookings' AS category, 'BK-'||left(b.id::text,8) AS title,
          concat(c.name,' · VIN ••••',right(v.vin,4),' · ',br.name) AS subtitle,
          '/bookings/'||b.id AS href, b.status
        FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id
          JOIN customers c ON c.id=b.customer_id JOIN branches br ON br.id=v.branch_id
        WHERE ${filters.where} AND (
          b.id::text ILIKE ${term} OR ('BK-'||left(b.id::text,8)) ILIKE ${term})
        ORDER BY title,b.id LIMIT ${limit}
      ), order_matches AS (
        SELECT o.id, 'orders' AS category, i.invoice_ref AS title,
          concat(c.name,' · VIN ••••',right(v.vin,4),' · ',br.name) AS subtitle,
          '/orders/'||o.id AS href, o.status
        FROM orders o JOIN invoices i ON i.order_id=o.id
          JOIN bookings b ON b.id=o.booking_id JOIN vehicles v ON v.id=b.vehicle_id
          JOIN customers c ON c.id=b.customer_id JOIN branches br ON br.id=v.branch_id
        WHERE ${filters.where} AND (o.id::text ILIKE ${term} OR i.invoice_ref ILIKE ${term}
          OR c.name ILIKE ${term})
        ORDER BY title,o.id LIMIT ${limit}
      )
      SELECT * FROM vehicle_matches UNION ALL SELECT * FROM customer_matches
      UNION ALL SELECT * FROM booking_matches UNION ALL SELECT * FROM order_matches
      ORDER BY category,title,id`,
      filters.params,
    );
    const groups: SearchGroup[] = categories.map((type) => {
      const found = matches.filter((item) => item.category === type);
      return {
        type,
        hasMore: found.length > query.limitPerGroup,
        items: found.slice(0, query.limitPerGroup).map(({ id, title, subtitle, href, status }) => ({
          id,
          title,
          subtitle,
          href,
          ...(status ? { status } : {}),
        })),
      };
    });
    return {
      ...meta,
      query: query.q,
      groups,
      items: groups.flatMap((group) =>
        group.items.map((item) => ({
          id: item.id,
          type: legacyTypes[group.type],
          label: `${item.title} · ${item.subtitle}`,
          route: item.href,
        })),
      ),
    };
  }, true);
}
