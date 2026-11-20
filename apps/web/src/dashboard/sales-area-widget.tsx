import { MapPin, Trophy } from 'lucide-react';
import type { SalesAreas } from '@dealerflow/contracts';
import { Empty, State } from '../components/ui';
import { useApi } from '../lib/api';

export function SalesAreaWidget({ scope }: { scope: string }) {
  const result = useApi<SalesAreas>(`/analytics/sales-areas?${scope}`);
  return (
    <State query={result}>
      {(data) =>
        data.items.length ? (
          <div className="space-y-4 p-6">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cities ranked by completed vehicle deliveries in the selected period.
            </p>
            <ol
              aria-label="Cities ranked by completed deliveries"
              className="divide-y divide-border"
            >
              {data.items.map((area) => (
                <li key={area.city} className="flex min-w-0 items-center gap-3 py-3">
                  <span
                    aria-label={`Rank ${area.rank}`}
                    className="grid size-8 shrink-0 place-items-center rounded-control bg-secondary text-xs font-semibold text-primary"
                  >
                    {area.rank === 1 ? <Trophy size={16} aria-hidden="true" /> : area.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span title={area.city} className="block truncate text-sm font-semibold">
                      {area.city}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={12} aria-hidden="true" />
                      City total
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-base font-semibold tabular-nums sm:text-lg">
                      {area.deliveries.toLocaleString('en-IN')}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {area.deliveries === 1 ? 'delivery' : 'deliveries'}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {data.totalDeliveries.toLocaleString('en-IN')} completed{' '}
              {data.totalDeliveries === 1 ? 'delivery' : 'deliveries'} across{' '}
              {data.totalAreas.toLocaleString('en-IN')} {data.totalAreas === 1 ? 'city' : 'cities'}.
              {data.totalAreas > data.items.length &&
                ` Showing the top ${data.items.length} cities.`}{' '}
              Equal delivery counts share a rank.
            </p>
          </div>
        ) : (
          <Empty text="No completed deliveries in this period and scope." />
        )
      }
    </State>
  );
}
