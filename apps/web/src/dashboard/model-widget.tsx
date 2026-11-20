import { Link } from 'react-router-dom';
import { formatMoney } from '@dealerflow/contracts';
import { useApi, useDebouncedSearch, str, type List } from '../lib/api';
import { State, VehicleImage, Button, Empty, control } from '../components/ui';
import { scopedLink } from './types';
export function ModelWidget({ scope }: { scope: string }) {
  const { search, setSearch, term, page, setPage } = useDebouncedSearch();
  const result = useApi<List>(
    `/models?${scope}&limit=3&page=${page}&q=${encodeURIComponent(term)}`,
  );
  const stock = useApi<{ models: List }>(`/analytics/stock?${scope}&limit=100`);
  return (
    <div className="p-6">
      <label className="mb-4 grid max-w-sm gap-2 text-xs text-muted-foreground">
        Find a model
        <input
          className={control}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Search your lineup…"
        />
      </label>
      <State query={result}>
        {(data) => (
          <>
            {data.items.length ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {data.items.map((model) => {
                  const counts = stock.data?.models.items.find((item) => item.id === model.id);
                  return (
                    <Link
                      key={str(model.id)}
                      to={scopedLink(`/inventory?model_id=${str(model.id)}`, scope)}
                      className="min-w-0 overflow-hidden rounded-container border border-border transition hover:border-primary"
                    >
                      <VehicleImage image={str(model.image_key)} />
                      <div className="space-y-2 p-4">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">
                          {str(model.brand)}
                        </p>
                        <p className="truncate text-base font-semibold">
                          {str(model.name)}{' '}
                          <span className="text-xs font-normal text-muted-foreground">
                            {str(model.variant)}
                          </span>
                        </p>
                        <p className="text-sm font-semibold">
                          {formatMoney(str(model.base_price_paise, '0'))}
                        </p>
                        <p className="pt-2 text-xs text-muted-foreground">
                          {counts
                            ? `${str(counts.available)} available · ${str(counts.reserved)} reserved`
                            : 'Stock counts unavailable'}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Empty
                text={term || scope ? 'No matching models.' : 'No models in your lineup yet.'}
              />
            )}
            <div className="mt-4 flex justify-between">
              <Button secondary disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="self-center text-xs text-muted-foreground">
                Representative illustrations · fictional brands
              </span>
              <Button secondary disabled={page * 3 >= data.total} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </>
        )}
      </State>
    </div>
  );
}
