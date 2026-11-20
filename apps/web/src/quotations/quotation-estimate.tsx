import { formatMoney, type QuotationEstimate as Estimate } from '@dealerflow/contracts';
import type { RefObject } from 'react';
import { Button, Card, VehicleImage } from '../components/ui';
import { QuotationStock } from './quotation-stock';
export function QuotationEstimate({
  estimate,
  headingRef,
}: {
  estimate: Estimate;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const { vehicle, request } = estimate;
  return (
    <Card>
      <article data-print className="space-y-6 p-6">
        <header className="space-y-2">
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
            Your quotation estimate
          </h2>
          <p className="text-sm font-semibold text-warning">{estimate.disclosure}</p>
          <p className="text-sm text-muted-foreground">
            Illustrative charges only—not official tax rates or an insurer offer.
          </p>
        </header>
        <VehicleImage image={vehicle.image_key} />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            {vehicle.brand} {vehicle.name} · {vehicle.variant}
          </h3>
          <p className="text-sm text-muted-foreground">
            {vehicle.fuel} · {vehicle.transmission}
          </p>
          <p className="text-sm">
            Requested year {request.model_year} · {request.city} · Quantity {request.quantity}
          </p>
        </div>
        <section aria-label="Price breakdown" className="space-y-4 border-t border-border pt-6">
          <h3 className="font-semibold">Per-vehicle breakdown</h3>
          {estimate.components.length ? (
            <dl className="space-y-3 text-sm">
              {estimate.components.map((component) => (
                <div key={component.label} className="flex justify-between gap-4">
                  <dt>{component.label}</dt>
                  <dd className="shrink-0 tabular-nums">{formatMoney(component.paise)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              Price breakdown unavailable. Calculate again for an updated estimate.
            </p>
          )}
          <dl className="space-y-4">
            <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4 text-sm font-semibold">
              <dt>Estimated on-road / vehicle</dt>
              <dd className="tabular-nums">{formatMoney(estimate.unit_paise)}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-3 rounded-control bg-secondary p-4 text-primary">
              <dt className="font-semibold">
                Estimated total · {request.quantity}{' '}
                {request.quantity === 1 ? 'vehicle' : 'vehicles'}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">
                {formatMoney(estimate.total_paise)}
              </dd>
            </div>
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {estimate.source}. Checked{' '}
            {new Intl.DateTimeFormat('en-IN', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Kolkata',
            }).format(new Date(estimate.checked_at))}{' '}
            IST. Model year does not change the catalog price in this prototype. Optional extras,
            freight and discounts are excluded.
          </p>
        </section>
        <QuotationStock estimate={estimate} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Prototype estimate only—not a saved quotation, invoice, booking or shipment commitment.
          Final prices and dispatch require dealer confirmation.
        </p>
        <div data-no-print className="flex justify-end">
          <Button secondary onClick={() => window.print()}>
            Print / save PDF
          </Button>
        </div>
      </article>
    </Card>
  );
}
