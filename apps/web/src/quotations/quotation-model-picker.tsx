import { useDebouncedSearch, str } from '../lib/api';
import { Button, control, Select, State } from '../components/ui';
import { useQuotationModels } from './use-quotation';
export function QuotationModelPicker({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (id: string) => void;
  invalid: boolean;
}) {
  const { search, setSearch, term, page, setPage } = useDebouncedSearch();
  const { models, selected } = useQuotationModels(term, page, value);
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium">Make, model & variant *</legend>
      <input
        aria-label="Search make, model or variant"
        className={control}
        value={search}
        placeholder="Search make, model or variant"
        onChange={(event) => setSearch(event.target.value)}
      />
      <State query={models}>
        {(data) => (
          <>
            <Select
              label="Vehicle *"
              value={value}
              required
              aria-invalid={invalid}
              aria-describedby={invalid ? 'quotation-model-error' : undefined}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">Choose a vehicle</option>
              {value && !data.items.some((model) => model.id === value) && (
                <option value={value}>
                  {selected.data
                    ? `${str(selected.data.brand)} · ${str(selected.data.name)} · ${str(selected.data.variant)}`
                    : 'Selected vehicle'}
                </option>
              )}
              {data.items.map((model) => (
                <option key={str(model.id)} value={str(model.id)} disabled={!model.active}>
                  {str(model.brand)} · {str(model.name)} · {str(model.variant)} ·{' '}
                  {str(model.transmission)}
                  {model.active ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
            {!data.items.length && (
              <div role="status" className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {term
                    ? 'No vehicles match your search.'
                    : 'No catalog models yet. Add a model in the Model catalog to begin.'}
                </p>
                {term && (
                  <Button secondary onClick={() => setSearch('')}>
                    Clear search
                  </Button>
                )}
              </div>
            )}
            {data.total > 20 && (
              <nav
                aria-label="Vehicle choices pagination"
                className="flex flex-wrap items-center gap-3"
              >
                <Button secondary disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="text-sm" aria-current="page">
                  Page {page} · {data.total} choices
                </span>
                <Button
                  secondary
                  disabled={page * 20 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )}
      </State>
    </fieldset>
  );
}
