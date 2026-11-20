import { Link } from 'react-router-dom';
import {
  CarFront,
  CalendarCheck,
  FileText,
  CreditCard,
  Files,
  Flag,
  ArrowRight,
  GitBranch,
} from 'lucide-react';
import { Card, State } from '../components/ui';
import { useApi } from '../lib/api';
import { scopedLink, type Summary } from './types';
export function Journey({ scope }: { scope: string }) {
  const query = useApi<Summary>(`/analytics/summary?${scope}`);
  return (
    <Card
      title="The connected journey"
      aside={
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <GitBranch size={14} />
          VIN to delivery
        </span>
      }
    >
      <State query={query}>
        {(data) => (
          <>
            <div className="grid gap-3 p-6 sm:grid-cols-3 xl:grid-cols-6">
              {[
                {
                  label: 'Available',
                  value: data.available,
                  icon: CarFront,
                  route: '/inventory?metric=available',
                },
                {
                  label: 'Booked',
                  value: data.active_bookings,
                  icon: CalendarCheck,
                  route: '/bookings?metric=active_bookings',
                },
                {
                  label: 'Order / invoice',
                  value: data.open_orders,
                  icon: FileText,
                  route: '/orders?metric=open_orders',
                },
                {
                  label: 'Payment blockers',
                  value: data.payment_only + data.combined,
                  icon: CreditCard,
                  route: '/orders?metric=payment',
                },
                {
                  label: 'Document blockers',
                  value: data.document_only + data.combined,
                  icon: Files,
                  route: '/orders?metric=documents',
                },
                {
                  label: 'Delivered',
                  value: data.sold,
                  icon: Flag,
                  route: '/orders?metric=delivered',
                },
              ].map(({ label, value, icon: Icon, route }, index) => (
                <Link
                  key={label}
                  to={scopedLink(route, scope)}
                  className="group relative rounded-container border border-border bg-background p-4 transition hover:border-primary hover:bg-secondary"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Icon size={20} className="text-primary" />
                    {index < 5 && <ArrowRight size={14} className="text-muted-foreground" />}
                  </div>
                  <p className="break-words text-base font-semibold leading-6 tabular-nums sm:text-lg">
                    {value}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{label}</p>
                </Link>
              ))}
            </div>
            <p className="px-6 pb-4 text-xs text-muted-foreground">
              Payment and document checks run in parallel; the same order can appear in both. This
              is a connected workflow, not a conversion funnel.
            </p>
          </>
        )}
      </State>
    </Card>
  );
}
