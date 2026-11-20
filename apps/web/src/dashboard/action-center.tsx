import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CircleAlert, ChevronRight } from 'lucide-react';
import type { Employee } from '@dealerflow/contracts';
import { formatMoney } from '@dealerflow/contracts';
import { useApi, type List, str } from '../lib/api';
import { Button, Badge, Card, State, Empty } from '../components/ui';
import { scopedLink } from './types';
import { JourneyDrawer } from './journey-drawer';
export function ActionCenter({ scope, employee }: { scope: string; employee: Employee }) {
  const [selected, setSelected] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const query = useApi<List>(
    `/analytics/exceptions?${scope}&limit=5&page=${page}${filter ? `&metric=${filter}` : ''}&direction=asc`,
  );
  return (
    <Card
      title="Action Center"
      aside={
        <Link
          to={scopedLink('/orders?metric=open_orders', scope)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary"
        >
          All orders
          <ArrowUpRight size={14} />
        </Link>
      }
    >
      <div className="flex flex-wrap gap-2 px-6 py-4" aria-label="Action filters">
        {[
          ['', 'All actions'],
          ['ready', 'Ready'],
          ['pending', 'Settlements'],
          ['combined', 'Combined'],
          ['payment', 'Payment'],
          ['documents', 'Documents'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => {
              setFilter(value);
              setPage(1);
            }}
            className={`min-h-11 rounded-control px-3 text-xs font-medium ${filter === value ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted'}`}
          >
            {label}
          </button>
        ))}
        <Link
          className="flex min-h-11 items-center px-3 text-xs text-muted-foreground"
          to={scopedLink('/inventory?metric=aged', scope)}
        >
          Aged stock ↗
        </Link>
      </div>
      <State query={query}>
        {(data) => (
          <>
            {data.items.length === 0 ? (
              <Empty text="No urgent actions found." />
            ) : (
              <div className="divide-y divide-border">
                {data.items.map((order) => (
                  <div key={str(order.id)} className="flex items-start gap-3 px-6 py-4">
                    <span
                      className={`mt-1 rounded-control p-2 ${order.ready ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}
                    >
                      <CircleAlert size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setSelected(str(order.id))}
                          className="min-h-6 text-left text-sm font-semibold hover:text-primary"
                        >
                          {str(order.model_name)} · {str(order.customer_name)}
                        </button>
                        <Badge>
                          {order.ready
                            ? 'ready'
                            : str(order.pending_paise) !== '0'
                              ? 'pending'
                              : 'open'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{str(order.reason)}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {str(order.branch_name)} · {str(order.invoice_ref)} · Due{' '}
                        {formatMoney(str(order.outstanding_paise, '0'))}
                      </p>
                      <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                        {str(order.vin)}
                      </p>
                      <Link
                        className="mt-2 inline-flex min-h-6 items-center gap-1 text-xs font-medium text-primary"
                        to={scopedLink(`/orders/${str(order.id)}`, scope)}
                      >
                        {order.ready && ['manager', 'admin'].includes(employee.role)
                          ? 'Complete delivery'
                          : ['manager', 'admin'].includes(employee.role)
                            ? 'Review & resolve'
                            : 'Open source order'}
                        <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border px-6 py-3 text-xs text-muted-foreground">
              <span>
                {data.total} actions · Page {page}
              </span>
              <div className="flex gap-2">
                <Button secondary disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button
                  secondary
                  disabled={page * 5 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </State>
      {selected && (
        <JourneyDrawer
          id={selected}
          employee={employee}
          scope={scope}
          onClose={() => setSelected('')}
        />
      )}
    </Card>
  );
}
