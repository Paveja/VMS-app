import { control } from '../components/ui';
import type { QuotationState } from './use-quotation';
export function QuotationNumbers({ state }: { state: QuotationState }) {
  const { values, errors, change, validate } = state;
  return (
    <>
      {(['model_year', 'quantity'] as const).map((field) => (
        <div key={field} className="grid gap-2 text-sm font-medium">
          <label htmlFor={`quotation-${field}`}>
            {field === 'model_year' ? 'Model year *' : 'Quantity *'}
          </label>
          <input
            id={`quotation-${field}`}
            type="number"
            step="1"
            required
            className={`${control} w-32`}
            min={field === 'model_year' ? 1900 : 1}
            max={field === 'model_year' ? new Date().getFullYear() + 1 : 999}
            value={values[field]}
            onChange={(event) => change(field, event.target.value)}
            onBlur={() => validate(field)}
            aria-invalid={!!errors[field]?.length}
            aria-describedby={errors[field]?.length ? `quotation-${field}-error` : undefined}
          />
          {!!errors[field]?.length && (
            <span id={`quotation-${field}-error`} role="alert" className="text-destructive">
              {field === 'quantity'
                ? 'Enter a whole quantity from 1 to 999.'
                : `Enter a year from 1900 to ${new Date().getFullYear() + 1}.`}
            </span>
          )}
        </div>
      ))}
    </>
  );
}
