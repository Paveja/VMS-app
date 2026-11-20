import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { can, type Employee } from '@dealerflow/contracts';
import { useApi, type List } from '../lib/api';
import { Card, State, Empty, Button } from '../components/ui';
import { ResourceFilters } from './resource-filters';
import { ResourceViews } from './resource-views';
export const titles: Record<string, string> = {
  models: 'Model catalog',
  inventory: 'Vehicle inventory',
  customers: 'Customers',
  bookings: 'Bookings',
  orders: 'Sales orders',
};
export function ResourceList({ resource, employee }: { resource: string; employee: Employee }) {
  const [params, setParams] = useSearchParams();
  const result = useApi<List>(`/${resource === 'inventory' ? 'vehicles' : resource}?${params}`);
  const allowed =
    resource !== 'orders' &&
    can(employee.role, ['models', 'inventory'].includes(resource) ? 'catalog' : 'sales');
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{titles[resource]}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {resource === 'inventory'
              ? 'Every VIN, with a clear place in your journey.'
              : resource === 'models'
                ? 'Your lineup. Ready for the next conversation.'
                : 'Connected dealership records, from source to next action.'}
          </p>
        </div>
        {allowed && (
          <Link
            to={`/${resource}/new`}
            className="inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} />
            Add{' '}
            {resource === 'inventory'
              ? 'vehicle'
              : resource === 'models'
                ? 'model'
                : resource === 'customers'
                  ? 'customer'
                  : 'booking'}
          </Link>
        )}
      </header>
      <Card>
        <div className="border-b border-border p-4">
          <ResourceFilters resource={resource} />
        </div>
        <State query={result}>
          {(data) => (
            <>
              {!data.items.length ? (
                <Empty
                  text={
                    params.size
                      ? 'No records match these filters. Clear the filters to see all records.'
                      : 'No records yet. Create the first record to get started.'
                  }
                />
              ) : (
                <ResourceViews resource={resource} items={data.items} search={params.toString()} />
              )}
              <nav
                aria-label="Pagination"
                className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 text-xs text-muted-foreground"
              >
                <span>
                  {data.total.toLocaleString('en-IN')} records · Page {data.page} of{' '}
                  {Math.max(1, Math.ceil(data.total / data.limit))}
                </span>
                <div className="flex gap-2">
                  {[-1, 1].map((delta) => (
                    <Button
                      key={delta}
                      secondary
                      disabled={delta < 0 ? data.page <= 1 : data.page * data.limit >= data.total}
                      onClick={() => {
                        const next = new URLSearchParams(params);
                        next.set('page', String(data.page + delta));
                        setParams(next);
                      }}
                    >
                      {delta < 0 ? 'Previous' : 'Next'}
                    </Button>
                  ))}
                </div>
              </nav>
            </>
          )}
        </State>
      </Card>
    </>
  );
}
