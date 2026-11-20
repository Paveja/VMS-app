import { Link } from 'react-router-dom';
import { Check, Circle } from 'lucide-react';
import { formatMoney, type Employee } from '@dealerflow/contracts';
import { useApi, str, date } from '../lib/api';
import { Dialog, State, VehicleImage, Badge } from '../components/ui';
import { scopedLink } from './types';
export function JourneyDrawer({
  id,
  scope,
  onClose,
  employee,
}: {
  id: string;
  scope: string;
  onClose: () => void;
  employee: Employee;
}) {
  const query = useApi(`/analytics/journeys/${id}`);
  return (
    <Dialog title="VIN journey" drawer onClose={onClose}>
      <State query={query}>
        {(order) => (
          <div className="space-y-6">
            <VehicleImage image={str(order.image_key, 'suv')} />
            <div>
              <Badge>{order.ready ? 'ready' : str(order.status)}</Badge>
              <h3 className="mt-3 text-xl font-semibold">
                {str(order.brand)} {str(order.model_name)}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {str(order.variant)} · {str(order.branch_name)}
              </p>
              <p className="mt-2 break-all font-mono text-xs">{str(order.vin)}</p>
              <p className="mt-3 text-sm">{str(order.customer_name)}</p>
            </div>
            <dl className="space-y-3 border-y border-border py-6">
              {[
                ['Invoice', order.invoice_ref],
                ['Immutable order price', formatMoney(str(order.total_paise, '0'))],
                ['Settled', formatMoney(str(order.paid_paise, '0'))],
                ['Pending', formatMoney(str(order.pending_paise, '0'))],
                ['Outstanding', formatMoney(str(order.outstanding_paise, '0'))],
              ].map(([label, value]) => (
                <div key={str(label)} className="flex flex-wrap justify-between gap-2 text-sm">
                  <dt className="text-muted-foreground">{str(label)}</dt>
                  <dd className="font-medium">{str(value)}</dd>
                </div>
              ))}
            </dl>
            <section>
              <h3 className="mb-4 text-sm font-semibold">Required document checks</h3>
              {[
                ['Identity', order.identity_verified],
                ['Address', order.address_verified],
              ].map(([label, valid]) => (
                <p key={str(label)} className="mb-3 flex items-center gap-2 text-sm">
                  {valid ? (
                    <Check size={16} className="text-success" />
                  ) : (
                    <Circle size={16} className="text-warning" />
                  )}
                  {str(label)} · {valid ? 'Verified' : 'Not verified'}
                </p>
              ))}
            </section>
            <section>
              <h3 className="mb-4 text-sm font-semibold">Recorded milestones</h3>
              <ol className="space-y-4 border-l border-border pl-4">
                {[
                  ['VIN reserved / booked', order.booked_at],
                  ['Order / invoice issued', order.created_at],
                  ['Delivered', order.delivered_at],
                ].map(([label, value]) => (
                  <li key={str(label)} className="text-sm">
                    <p>{str(label)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {value ? date(value) : 'Not yet recorded'}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
            <Link
              to={scopedLink(`/orders/${id}`, scope)}
              onClick={onClose}
              className="flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {order.ready && ['manager', 'admin'].includes(employee.role)
                ? 'Open delivery action'
                : 'Open order & permitted actions'}
            </Link>
          </div>
        )}
      </State>
    </Dialog>
  );
}
