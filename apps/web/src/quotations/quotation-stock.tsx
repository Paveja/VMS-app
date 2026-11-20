import type { QuotationEstimate } from '@dealerflow/contracts';
import { Badge } from '../components/ui';
export function QuotationStock({ estimate }: { estimate: QuotationEstimate }) {
  const { stock, request } = estimate;
  return (
    <section aria-label="Stock availability" className="space-y-4 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Stock in {request.city}</h3>
        <Badge>Verification needed</Badge>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {stock.available} available · {stock.received} physically received · {stock.in_transit} in
        transit.
      </p>
      {!stock.available && (
        <p role="status" className="text-sm text-muted-foreground">
          No available stock for this vehicle in the selected city.
        </p>
      )}
      {stock.available > 0 && stock.available < request.quantity && (
        <p className="text-sm text-warning">
          Available stock is {request.quantity - stock.available} below the requested quantity,
          before year verification.
        </p>
      )}
      {stock.branches.length ? (
        <ul aria-label="Branch availability" className="divide-y divide-border text-sm">
          {stock.branches.map((branch) => (
            <li key={branch.id} className="flex flex-wrap justify-between gap-2 py-3">
              <span className="font-medium">{branch.name}</span>
              <span>
                {branch.available} available · {branch.in_transit} in transit
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          No branch stock details are available.
        </p>
      )}
      {stock.total_branches > stock.branches.length && (
        <p className="text-xs text-muted-foreground">
          Showing {stock.branches.length} of {stock.total_branches} branches; totals include all
          matching branches.
        </p>
      )}
      <p className="rounded-control bg-warning-soft p-4 text-sm leading-relaxed text-warning">
        Counts cover all model years. Exact-year availability and shipment readiness are unverified:
        inventory has no recorded model year or dispatch clearance. Physical receipt alone is not
        dispatch approval.
      </p>
    </section>
  );
}
