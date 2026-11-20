import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import type { Row } from '@dealerflow/contracts';
import { useApi, str } from '../lib/api';
import { State, Button, Empty } from '../components/ui';
import { scopedLink } from './types';
export function TrendWidget({ scope }: { scope: string }) {
  const [event, setEvent] = useState('orders');
  const result = useApi<{ items: Row[]; explanation: string }>(`/analytics/trends?${scope}`);
  return (
    <>
      <div className="flex flex-wrap gap-1 px-4 pt-4">
        {['bookings', 'orders', 'deliveries', 'payments'].map((key) => (
          <Button
            key={key}
            secondary={event !== key}
            onClick={() => setEvent(key)}
            className="px-3 capitalize"
          >
            {key}
          </Button>
        ))}
      </div>
      <State query={result}>
        {(data) =>
          data.items.length ? (
            <div className="p-6">
              <p className="mb-4 text-xs text-muted-foreground">
                {event === 'payments'
                  ? 'Settled amount (₹, rounded chart axis; exact paise in table)'
                  : 'Recorded events per day · IST'}
              </p>
              <div className="h-44 min-w-0" aria-label={`${event} trend`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.items.map((item) => ({
                      ...item,
                      value:
                        event === 'payments'
                          ? Number(item.payments_paise) / 100
                          : Number(item[event]),
                    }))}
                    onClick={(state) => {
                      const index = Number(state?.activeTooltipIndex);
                      const day = data.items[index]?.day;
                      if (day) {
                        const url = scopedLink(
                          event === 'payments'
                            ? '/records?metric=payments'
                            : `/${event === 'deliveries' ? 'orders' : event}?event=${event}`,
                          scope,
                        );
                        const params = new URLSearchParams(url.split('?')[1]);
                        params.set('period', 'custom');
                        params.set('start', str(day));
                        params.set('end', str(day));
                        if (event === 'deliveries') params.set('metric', 'delivered');
                        window.location.assign(`${url.split('?')[0]}?${params}`);
                      }
                    }}
                  >
                    <CartesianGrid vertical={false} stroke="var(--color-border)" />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(value) => String(value).slice(5)}
                      tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
                    />
                    <YAxis
                      width={48}
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="value"
                      name={event === 'payments' ? 'INR' : event}
                      fill="var(--color-primary)"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details className="mt-4 text-xs text-muted-foreground">
                <summary className="cursor-pointer py-2">
                  Accessible event table & exact drilldowns
                </summary>
                <div className="max-h-60 overflow-auto">
                  <table className="w-full text-left">
                    <caption className="sr-only">Events by Asia/Kolkata business day</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="py-2">
                          Date
                        </th>
                        <th scope="col">Value</th>
                        <th scope="col">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) => {
                        const route =
                          event === 'payments'
                            ? '/records?metric=payments'
                            : `/${event === 'deliveries' ? 'orders' : event}?event=${event}${event === 'deliveries' ? '&metric=delivered' : ''}`;
                        return (
                          <tr key={str(item.day)}>
                            <td className="py-2">{str(item.day)}</td>
                            <td>
                              {str(event === 'payments' ? item.payments_paise : item[event])}
                              {event === 'payments' ? ' paise' : ''}
                            </td>
                            <td>
                              <Link
                                className="text-primary"
                                to={`${scopedLink(route, scope)}&period=custom&start=${str(item.day)}&end=${str(item.day)}`}
                              >
                                Open records
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {data.explanation}
              </p>
            </div>
          ) : (
            <Empty
              text={scope ? 'No trend records match your filters.' : 'No recorded history yet.'}
            />
          )
        }
      </State>
    </>
  );
}
