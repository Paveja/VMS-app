import { quotationCities } from '@dealerflow/contracts';
import { Button, Card, Select, State } from '../components/ui';
import { str } from '../lib/api';
import { QuotationModelPicker } from './quotation-model-picker';
import { QuotationNumbers } from './quotation-numbers';
import type { QuotationState } from './use-quotation';
export function QuotationForm({ state }: { state: QuotationState }) {
  const { values, errors, errorSummary, branches, estimate, change, submit } = state;
  const cities = [
    ...new Set(
      (branches.data?.items || [])
        .filter((branch) => branch.active && quotationCities.some((city) => city === branch.city))
        .map((branch) => str(branch.city)),
    ),
  ].sort();
  return (
    <Card title="Vehicle details">
      <form className="space-y-6 p-6" onSubmit={submit} noValidate>
        {Object.values(errors).some((messages) => messages.length > 0) && (
          <div
            role="alert"
            ref={errorSummary}
            tabIndex={-1}
            className="rounded-control bg-destructive-soft p-4 text-sm text-destructive"
          >
            <p className="font-semibold">Check the highlighted fields.</p>
          </div>
        )}
        <fieldset disabled={estimate.isPending} className="min-w-0 space-y-6">
          <QuotationModelPicker
            value={values.model_id}
            invalid={!!errors.model_id?.length}
            onChange={(value) => change('model_id', value)}
          />
          {!!errors.model_id?.length && (
            <p id="quotation-model-error" role="alert" className="text-sm text-destructive">
              Choose an active vehicle.
            </p>
          )}
          <QuotationNumbers state={state} />
          <State query={branches}>
            {() =>
              cities.length ? (
                <Select
                  label="Registration city *"
                  required
                  value={values.city}
                  onChange={(event) => change('city', event.target.value)}
                  aria-invalid={!!errors.city?.length}
                  aria-describedby={errors.city?.length ? 'quotation-city-error' : undefined}
                >
                  <option value="">Choose a city</option>
                  {cities.map((city) => (
                    <option key={city}>{city}</option>
                  ))}
                </Select>
              ) : (
                <p role="status" className="text-sm text-muted-foreground">
                  No active branch has supported demo city pricing.
                </p>
              )
            }
          </State>
          {!!errors.city?.length && (
            <p id="quotation-city-error" role="alert" className="text-sm text-destructive">
              Choose a supported registration city.
            </p>
          )}
          <Button
            type="submit"
            disabled={estimate.isPending || !cities.length || branches.isError}
            className="w-full"
          >
            {estimate.isPending ? 'Calculating estimate…' : 'Calculate estimate'}
          </Button>
        </fieldset>
        {estimate.isError && (
          <div
            role="alert"
            className="rounded-control bg-destructive-soft p-4 text-sm text-destructive"
          >
            {estimate.error.message} Your selections are retained. Calculate again to retry.
          </div>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          No booking is created and no stock is reserved. Estimates are not saved; refresh the page
          to start again.
        </p>
      </form>
    </Card>
  );
}
