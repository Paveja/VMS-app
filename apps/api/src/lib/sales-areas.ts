import { businessWindow, type Query, type SalesAreas } from '@dealerflow/contracts';
import { metadata, scoped } from './analytics.ts';
import { rows, transaction } from './db.ts';

type CitySalesRow = SalesAreas['items'][number] & {
  total_deliveries: number;
  total_areas: number;
};
export async function salesAreas(query: Query) {
  return transaction(async (connection) => {
    const filters = scoped(query, 'v');
    let period = '';
    if (query.period !== 'all') {
      const window = businessWindow(query);
      filters.params.push(window.start, window.end);
      period = `AND o.delivered_at >= $${filters.params.length - 1}
        AND o.delivered_at < $${filters.params.length}`;
    }
    const cities = await rows<CitySalesRow>(
      connection,
      `
      WITH city_sales AS (
        SELECT br.city, count(*)::int AS deliveries
        FROM orders o JOIN bookings b ON b.id=o.booking_id
          JOIN vehicles v ON v.id=b.vehicle_id JOIN branches br ON br.id=v.branch_id
        WHERE ${filters.where} AND o.status='delivered' ${period}
        GROUP BY br.city
      )
      SELECT city, deliveries,
        dense_rank() OVER(ORDER BY deliveries DESC)::int AS rank,
        sum(deliveries) OVER()::int AS total_deliveries,
        count(*) OVER()::int AS total_areas
      FROM city_sales ORDER BY deliveries DESC, city ASC LIMIT 5
    `,
      filters.params,
    );
    return {
      ...metadata(query),
      items: cities.map(({ city, deliveries, rank }) => ({ city, deliveries, rank })),
      totalDeliveries: cities[0]?.total_deliveries ?? 0,
      totalAreas: cities[0]?.total_areas ?? 0,
    };
  }, true);
}
