import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Circle, Printer } from 'lucide-react';
import { type Employee, can, formatMoney } from '@dealerflow/contracts';
import { useApi, useAction, str } from '../lib/api';
import { Card, State, Badge, Button, Dialog, VehicleImage } from '../components/ui';
import { Payments } from './payments';
import { Documents } from './documents';
import { Invoice } from './invoice';
export function OrderDetail({ employee }: { employee: Employee }) {
  const { id } = useParams();
  const location = useLocation();
  const result = useApi(`/orders/${id}`);
  const [confirm, setConfirm] = useState(false);
  const deliver = useAction(() => setConfirm(false));
  return (
    <>
      <Link to={`/orders${location.search}`} className="text-sm text-primary" data-no-print>
        ← Sales orders
      </Link>
      <State query={result}>
        {(order) => (
          <>
            <header data-no-print className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold">{str(order.invoice_ref)}</h1>
                  <Badge>{order.ready ? 'ready' : str(order.status)}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {str(order.customer_name)} · {str(order.branch_name)}
                </p>
              </div>
              <Link
                to={`/orders/${id}/invoice`}
                className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-card px-4 text-sm"
              >
                <Printer size={16} />
                View printable invoice
              </Link>
            </header>
            {location.pathname.endsWith('/invoice') ? (
              <Invoice order={order} />
            ) : (
              <>
                <div className="grid items-start gap-6 xl:grid-cols-3">
                  <Card className="overflow-hidden">
                    <VehicleImage image={str(order.image_key, 'suv')} />
                    <div className="space-y-3 p-6">
                      <h2 className="text-xl font-semibold">
                        {str(order.brand)} {str(order.model_name)}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {str(order.variant)} · {str(order.color)}
                      </p>
                      <p className="break-all font-mono text-xs">{str(order.vin)}</p>
                      <Link
                        className="inline-block py-2 text-sm text-primary"
                        to={`/inventory/${str(order.vehicle_id)}`}
                      >
                        View VIN history →
                      </Link>
                    </div>
                  </Card>
                  <Card title="Financial snapshot">
                    <dl className="space-y-4 p-6">
                      {[
                        ['Order value', order.total_paise],
                        ['Settled payments', order.paid_paise],
                        ['Pending requests', order.pending_paise],
                        ['Outstanding balance', order.outstanding_paise],
                      ].map(([label, value]) => (
                        <div
                          key={str(label)}
                          className="flex flex-wrap justify-between gap-2 text-sm"
                        >
                          <dt className="text-muted-foreground">{str(label)}</dt>
                          <dd className="font-semibold tabular-nums">
                            {formatMoney(str(value, '0'))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="border-t border-border p-4 text-xs text-muted-foreground">
                      Pending requests are not collected cash. Invoice value is not recognized
                      revenue.
                    </p>
                  </Card>
                  <Card title="Delivery readiness">
                    <div className="space-y-4 p-6">
                      {[
                        ['Payment settled', order.outstanding_paise === '0'],
                        ['Identity verified', order.identity_verified],
                        ['Address verified', order.address_verified],
                        ['VIN reserved', order.vehicle_status === 'reserved'],
                      ].map(([label, valid]) => (
                        <p
                          key={str(label)}
                          className={`flex items-center gap-3 text-sm ${valid ? 'text-success' : 'text-muted-foreground'}`}
                        >
                          {valid ? <CheckCircle2 size={18} /> : <Circle size={18} />} {str(label)}
                        </p>
                      ))}
                      {can(employee.role, 'review') && order.status === 'open' && (
                        <Button disabled={!order.ready} onClick={() => setConfirm(true)}>
                          Complete delivery
                        </Button>
                      )}
                      {order.status === 'delivered' && <Badge>delivered</Badge>}
                    </div>
                  </Card>
                </div>
                <div className="grid items-start gap-6 xl:grid-cols-2">
                  <Payments order={order} employee={employee} />
                  <Documents order={order} employee={employee} />
                </div>
              </>
            )}
            {confirm && (
              <Dialog title="Complete vehicle delivery?" onClose={() => setConfirm(false)}>
                <p className="mb-6 text-sm text-muted-foreground">
                  This marks VIN {str(order.vin)} Sold and completes the order. Payment and document
                  readiness will be rechecked on the server.
                </p>
                {deliver.error && (
                  <p role="alert" className="mb-4 text-destructive">
                    {deliver.error.message}
                  </p>
                )}
                <div className="flex justify-between">
                  <Button secondary onClick={() => setConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={deliver.isPending}
                    onClick={() => deliver.mutate({ path: `/orders/${id}/deliver` })}
                  >
                    {deliver.isPending ? 'Completing…' : 'Confirm delivery'}
                  </Button>
                </div>
              </Dialog>
            )}
          </>
        )}
      </State>
    </>
  );
}
