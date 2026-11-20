import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useApi } from '../lib/api';
import { State, Empty } from '../components/ui';
import { scopedLink, type Stock } from './types';
const statusColors: Record<string, string> = {
  available: 'var(--color-chart-1)',
  reserved: 'var(--color-chart-2)',
  sold: 'var(--color-chart-3)',
  in_transit: 'var(--color-chart-4)',
};
export function StockWidget({ scope }: { scope: string }) {
  const result = useApi<Stock>(`/analytics/stock?${scope}`);
  return (
    <State query={result}>
      {(data) =>
        data.distribution.length ? (
          <div className="grid items-center gap-4 p-6 sm:grid-cols-2">
            <div className="h-44 min-w-0" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.distribution}
                    dataKey="count"
                    nameKey="status"
                    innerRadius="65%"
                    outerRadius="95%"
                    paddingAngle={4}
                    isAnimationActive={false}
                  >
                    {data.distribution.map((item) => (
                      <Cell key={item.status} fill={statusColors[item.status]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              {data.distribution.map((item) => (
                <Link
                  key={item.status}
                  to={scopedLink(`/inventory?status=${item.status}`, scope)}
                  className="flex min-h-6 items-center justify-between gap-4 text-sm"
                >
                  <span className="flex items-center gap-2 capitalize">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: statusColors[item.status] }}
                    />
                    {item.status.replaceAll('_', ' ')}
                  </span>
                  <strong className="tabular-nums">{item.count}</strong>
                </Link>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">
                Current inventory · all recorded stock
              </p>
            </div>
          </div>
        ) : (
          <Empty text="No inventory in this scope." />
        )
      }
    </State>
  );
}
