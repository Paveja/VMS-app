import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { type Employee, type Row, can, formatMoney } from '@dealerflow/contracts';
import { useApi, useAction, str, date } from '../lib/api';
import { displayField } from '../lib/record';
import { Card, State, Badge, Button, VehicleImage } from '../components/ui';
import { BookingDialogs } from './booking-dialogs';
export function ResourceDetail({ resource, employee }: { resource: string; employee: Employee }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const result = useApi(`/${resource === 'inventory' ? 'vehicles' : resource}/${id}`);
  const [confirm, setConfirm] = useState(false);
  const [conversion, setConversion] = useState(false);
  const navigate = useNavigate();
  const action = useAction((row) => {
    setConfirm(false);
    setConversion(false);
    if (row.booking_id) navigate(`/orders/${str(row.id)}?${params}`);
  });
  return (
    <>
      <Link to={`/${resource}?${params}`} className="text-sm text-primary">
        ← Back to {resource}
      </Link>
      <State query={result}>
        {(data) => (
          <>
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">
                  {str(data.name ?? data.vin ?? data.customer_name)}
                </h1>
                <p className="mt-2 text-xs text-muted-foreground">
                  {resource === 'bookings' ? 'Booking' : 'Record'} · {str(data.id)}
                </p>
              </div>
              {resource !== 'bookings' &&
                can(employee.role, resource === 'customers' ? 'sales' : 'catalog') &&
                (!data.status || ['available', 'in_transit'].includes(str(data.status))) && (
                  <Link
                    to={`/${resource}/${id}/edit`}
                    className="rounded-control border border-border bg-card px-4 py-3 text-sm"
                  >
                    Edit record
                  </Link>
                )}
            </header>
            <div className="grid items-start gap-6 xl:grid-cols-3">
              <Card className="overflow-hidden xl:col-span-2">
                {resource !== 'customers' && <VehicleImage image={str(data.image_key, 'suv')} />}
                <dl className="grid gap-6 p-6 sm:grid-cols-2">
                  {Object.entries(data)
                    .filter(([key, value]) => displayField(key, value))
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt className="mb-2 text-xs capitalize text-muted-foreground">
                          {key.replaceAll('_', ' ').replace('paise', '')}
                        </dt>
                        <dd className="break-words text-sm font-medium">
                          {key === 'status' ? (
                            <Badge>{str(value)}</Badge>
                          ) : key.endsWith('_paise') ? (
                            formatMoney(str(value, '0'))
                          ) : key.endsWith('_at') ? (
                            date(value)
                          ) : (
                            str(value)
                          )}
                        </dd>
                      </div>
                    ))}
                </dl>
              </Card>
              <div className="space-y-6">
                <Card title="Next authorized action">
                  <div className="space-y-4 p-6">
                    {resource === 'inventory' &&
                    data.status === 'available' &&
                    can(employee.role, 'sales') ? (
                      <Link to="/bookings/new" className="text-sm font-medium text-primary">
                        Create booking for an available VIN →
                      </Link>
                    ) : resource === 'bookings' &&
                      data.status === 'confirmed' &&
                      can(employee.role, 'sales') ? (
                      <>
                        <Button onClick={() => setConversion(true)}>Convert to sales order</Button>
                        <Button secondary onClick={() => setConfirm(true)}>
                          Cancel booking
                        </Button>
                      </>
                    ) : resource === 'bookings' && data.order_id ? (
                      <Link
                        to={`/orders/${str(data.order_id)}?${params}`}
                        className="text-sm text-primary"
                      >
                        Open sales order →
                      </Link>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        This record has no pending action for your role.
                      </p>
                    )}
                    {action.error && (
                      <p role="alert" className="text-sm text-destructive">
                        {action.error.message}
                      </p>
                    )}
                  </div>
                </Card>
                {['bookings', 'orders'].map(
                  (key) =>
                    Array.isArray(data[key]) && (
                      <Card key={key} title={`Linked ${key}`}>
                        <div className="divide-y divide-border">
                          {(data[key] as Row[]).map((row) => (
                            <Link
                              key={str(row.id)}
                              to={`/${key}/${str(row.id)}?${params}`}
                              className="block p-4 text-sm text-primary"
                            >
                              {str(row.invoice_ref ?? row.customer_name ?? row.vin)} ·{' '}
                              {str(row.status)}
                            </Link>
                          ))}
                          {(data[key] as Row[]).length === 0 && (
                            <p className="p-4 text-sm text-muted-foreground">No linked {key}.</p>
                          )}
                        </div>
                      </Card>
                    ),
                )}
              </div>
            </div>
            <BookingDialogs
              id={id!}
              vin={str(data.vin)}
              confirm={confirm}
              conversion={conversion}
              closeConfirm={() => setConfirm(false)}
              closeConversion={() => setConversion(false)}
              action={action}
            />
          </>
        )}
      </State>
    </>
  );
}
