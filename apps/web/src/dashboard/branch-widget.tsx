import { Link } from 'react-router-dom';
import { formatMoney } from '@dealerflow/contracts';
import { useApi, str } from '../lib/api';
import { State, Empty } from '../components/ui';
import { type Stock, scopedLink } from './types';
import { useState } from 'react';
export function BranchWidget({ scope }: { scope: string }) {
  const result = useApi<Stock>(`/analytics/stock?${scope}`);
  const [sort, setSort] = useState('name');
  return (
    <State query={result}>
      {(data) =>
        data.branches.length ? (
          <div className="overflow-x-auto" tabIndex={0} aria-label="Branch comparison, scrollable">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Branch snapshot and deliveries in selected period
              </caption>
              <thead className="bg-background text-xs text-muted-foreground">
                <tr>
                  {[
                    ['name', 'Branch'],
                    ['available', 'Available'],
                    ['active_bookings', 'Bookings'],
                    ['open_orders', 'Open orders'],
                    ['outstanding', 'Outstanding'],
                    ['ready', 'Ready'],
                    ['delivered', 'Period deliveries'],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      scope="col"
                      className="whitespace-nowrap px-6 py-4"
                      aria-sort={sort === key ? 'ascending' : 'none'}
                    >
                      <button className="min-h-6" onClick={() => setSort(key)}>
                        {label} ↕
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.branches
                  .map((branch) => ({
                    ...branch,
                    ...data.comparison.find((item) => item.branch_id === branch.id),
                  }))
                  .sort((left, right) =>
                    sort === 'name'
                      ? str(left.name).localeCompare(str(right.name))
                      : Number(BigInt(str(left[sort], '0')) - BigInt(str(right[sort], '0'))),
                  )
                  .map((branch) => (
                    <tr key={str(branch.id)}>
                      <th scope="row" className="whitespace-nowrap px-6 py-4 text-left font-medium">
                        <Link
                          to={scopedLink(`/inventory?branch_id=${str(branch.id)}`, scope)}
                          className="text-primary"
                        >
                          {str(branch.name)}
                        </Link>
                      </th>
                      {[
                        ['available', '/inventory?metric=available'],
                        ['active_bookings', '/bookings?metric=active_bookings'],
                        ['open_orders', '/orders?metric=open_orders'],
                        ['outstanding', '/orders?metric=outstanding'],
                        ['ready', '/orders?metric=ready'],
                        ['delivered', '/orders?metric=delivered&event=deliveries'],
                      ].map(([key, route]) => (
                        <td key={key} className="whitespace-nowrap px-6 py-4 tabular-nums">
                          <Link to={scopedLink(`${route}&branch_id=${str(branch.id)}`, scope)}>
                            {key === 'outstanding'
                              ? formatMoney(str(branch[key], '0'))
                              : str(branch[key], '0')}
                          </Link>
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text={scope ? 'No branches match your filters.' : 'No branches yet.'} />
        )
      }
    </State>
  );
}
