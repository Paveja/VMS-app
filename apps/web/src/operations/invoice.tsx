import type { Row } from '@dealerflow/contracts';
import { formatMoney } from '@dealerflow/contracts';
import { str, date } from '../lib/api';
import { Button, Card } from '../components/ui';
export function Invoice({ order }: { order: Row }) {
  const snapshot = order.snapshot as {
    customer: Row;
    model: Row;
    branch: Row;
    vin: string;
    color: string;
  };
  return (
    <Card className="mx-auto max-w-3xl">
      <article data-print className="space-y-8 p-8">
        <header className="flex flex-wrap justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">DealerFlow</h1>
            <p className="mt-2 text-sm text-muted-foreground">Fictional demonstration invoice</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">{str(order.invoice_ref)}</p>
            <p className="mt-2">Issued {date(order.issued_at)}</p>
          </div>
        </header>
        <div className="grid gap-6 sm:grid-cols-2">
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
              Bill to (snapshot)
            </h2>
            <p className="font-medium">{str(snapshot.customer.name)}</p>
            <p className="mt-2 text-sm">{str(snapshot.customer.address)}</p>
            <p className="mt-2 text-sm">{str(snapshot.customer.phone)}</p>
          </section>
          <section>
            <h2 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
              Vehicle
            </h2>
            <p className="font-medium">
              {str(snapshot.model.brand)} {str(snapshot.model.name)} {str(snapshot.model.variant)}
            </p>
            <p className="mt-2 break-all text-sm">VIN: {snapshot.vin}</p>
            <p className="mt-2 text-sm">
              {str(snapshot.branch.name)} · {snapshot.color}
            </p>
          </section>
        </div>
        <table className="w-full text-sm">
          <caption className="sr-only">Immutable invoice breakdown in INR</caption>
          <thead className="border-y border-border text-left">
            <tr>
              <th scope="col" className="py-4">
                Description
              </th>
              <th scope="col" className="py-4 text-right">
                Amount (INR)
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Snapshotted base price', order.base_price_paise],
              ['Demo extras', order.extras_paise],
              ['Explicit demo tax', order.tax_paise],
              ['Invoice total', order.total_paise],
            ].map(([label, value]) => (
              <tr key={str(label)} className="border-b border-border">
                <th scope="row" className="py-4 text-left font-medium">
                  {str(label)}
                </th>
                <td className="py-4 text-right tabular-nums">{formatMoney(str(value, '0'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs leading-relaxed text-muted-foreground">
          This is a fictional reference-application invoice, not a tax invoice or evidence of
          recognized revenue. Amounts are immutable order snapshots. Use your browser’s Print → Save
          as PDF.
        </p>
        <div data-no-print>
          <Button onClick={() => window.print()}>Print / Save as PDF</Button>
        </div>
      </article>
    </Card>
  );
}
