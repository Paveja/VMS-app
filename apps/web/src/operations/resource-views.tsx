import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { type Row, formatMoney } from '@dealerflow/contracts';
import { str } from '../lib/api';
import { VehicleImage, Empty } from '../components/ui';
import { RecordRow } from './resource-row';
export function ResourceViews({
  resource,
  items,
  search,
}: {
  resource: string;
  items: Row[];
  search: string;
}) {
  if (!items.length)
    return <Empty text={search ? 'No records match your filters.' : 'No records yet.'} />;
  if (resource === 'models')
    return (
      <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((row) => (
          <Link
            key={str(row.id)}
            to={`/models/${str(row.id)}${search ? `?${search}` : ''}`}
            className="overflow-hidden rounded-container border border-border transition hover:border-primary"
          >
            <VehicleImage image={str(row.image_key)} />
            <div className="space-y-3 p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {str(row.brand)}
              </p>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">
                  {str(row.name)}{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    {str(row.variant)}
                  </span>
                </h2>
                <ArrowUpRight size={16} />
              </div>
              <p className="text-xs text-muted-foreground">
                {str(row.fuel)} · {str(row.transmission)}
              </p>
              <p className="font-semibold">{formatMoney(str(row.base_price_paise, '0'))}</p>
            </div>
          </Link>
        ))}
      </div>
    );
  const labels =
    resource === 'inventory'
      ? ['Vehicle / VIN', 'Branch', 'Color', 'Status']
      : resource === 'customers'
        ? ['Customer', 'Phone', 'Email', 'Created']
        : resource === 'bookings'
          ? ['Booking / customer', 'Vehicle', 'Branch', 'Status']
          : ['Invoice / customer', 'Vehicle / branch', 'Order value', 'Status'];
  return (
    <div className="overflow-x-auto" tabIndex={0} aria-label={`${resource} table, scrollable`}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{resource} records</caption>
        <thead className="bg-background text-xs text-muted-foreground">
          <tr>
            {labels.map((label) => (
              <th key={label} scope="col" className="whitespace-nowrap px-6 py-4 font-medium">
                {label}
              </th>
            ))}
            <th scope="col" className="px-6 py-4">
              <span className="sr-only">View</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((row) => (
            <RecordRow key={str(row.id)} resource={resource} row={row} search={search} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
