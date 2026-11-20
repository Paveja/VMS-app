import { useEffect } from 'react';
import { FileText } from 'lucide-react';
import { quotationDisclosure } from '@dealerflow/contracts';
import { Card } from '../components/ui';
import { QuotationForm } from './quotation-form';
import { QuotationEstimate } from './quotation-estimate';
import { useQuotation } from './use-quotation';
export function QuotationPrototype() {
  const state = useQuotation();
  useEffect(() => {
    document.title = 'Quick quotation · DealerFlow';
  }, []);
  return (
    <div className="space-y-6">
      <header data-no-print className="space-y-2">
        <h1 className="text-balance text-2xl font-semibold">Quick quotation</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A quick estimate from your vehicle catalog, with real city stock and clearly labelled demo
          charges.
        </p>
        <p className="text-sm font-medium text-warning">{quotationDisclosure}</p>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section data-no-print aria-label="Quotation details">
          <QuotationForm state={state} />
        </section>
        <section aria-label="Quotation result" aria-busy={state.estimate.isPending}>
          {state.estimate.isPending ? (
            <Card>
              <div role="status" className="space-y-4 p-6">
                <p className="text-sm">Checking catalog prices and city stock…</p>
                {[1, 2, 3].map((row) => (
                  <div key={row} className="h-8 animate-pulse rounded-control bg-muted" />
                ))}
              </div>
            </Card>
          ) : state.estimate.data ? (
            <QuotationEstimate estimate={state.estimate.data} headingRef={state.estimateHeading} />
          ) : (
            <Card>
              <div role="status" className="space-y-4 p-8 text-center">
                <FileText aria-hidden size={32} className="mx-auto text-primary" />
                <h2 className="text-lg font-semibold">Your estimate will appear here</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Choose a vehicle, model year, quantity and registration city, then calculate an
                  estimate.
                </p>
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
