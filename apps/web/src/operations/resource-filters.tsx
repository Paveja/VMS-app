import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { stockStatuses, type Row } from '@dealerflow/contracts';
import { useApi, type List, str } from '../lib/api';
import { Select, control, Button } from '../components/ui';
import { CatalogFilters } from './catalog-filters';
export function ResourceFilters({ resource }: { resource: string }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const branches = useApi<{ items: Row[] }>('/branches');
  const models = useApi<List>('/models?limit=100');
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  }
  const scoped = ['inventory', 'bookings', 'orders'].includes(resource);
  return (
    <form onSubmit={(event) => event.preventDefault()} className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 flex-1 basis-48 gap-1 text-xs font-medium text-muted-foreground">
        Search {resource}
        <input
          className={control}
          value={search}
          placeholder={resource === 'inventory' ? 'VIN, brand, model or color…' : 'Search records…'}
          onChange={(event) => {
            setSearch(event.target.value);
            clearTimeout(timer.current);
            const value = event.target.value;
            timer.current = setTimeout(() => update('q', value), 300);
          }}
        />
      </label>
      {scoped && (
        <>
          <Select
            label="Branch"
            value={params.get('branch_id') || ''}
            onChange={(event) => update('branch_id', event.target.value)}
            className="w-44"
          >
            <option value="">All branches</option>
            {branches.data?.items.map((branch) => (
              <option key={str(branch.id)} value={str(branch.id)}>
                {str(branch.name)}
              </option>
            ))}
          </Select>
          <Select
            label="Model"
            className="w-44"
            value={params.get('model_id') || ''}
            onChange={(event) => update('model_id', event.target.value)}
          >
            <option value="">All models</option>
            {models.data?.items.map((model) => (
              <option key={str(model.id)} value={str(model.id)}>
                {str(model.brand)} {str(model.name)} {str(model.variant)}
              </option>
            ))}
          </Select>
          <Select
            label="Status"
            className="w-40"
            value={params.get('status') || ''}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {(resource === 'inventory'
              ? stockStatuses
              : resource === 'bookings'
                ? ['confirmed', 'cancelled', 'converted']
                : ['open', 'delivered']
            ).map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </Select>
        </>
      )}
      {['models', 'inventory'].includes(resource) && (
        <CatalogFilters inventory={resource === 'inventory'} params={params} update={update} />
      )}
      <Select
        label="Sort"
        className="w-40"
        value={params.get('sort') || 'created_at'}
        onChange={(event) => update('sort', event.target.value)}
      >
        <option value="created_at">Newest first</option>
        <option value="name">Name</option>
        {resource === 'orders' && <option value="total_paise">Order value</option>}
      </Select>
      <Button
        secondary
        onClick={() => {
          clearTimeout(timer.current);
          setSearch('');
          setParams({});
        }}
      >
        Clear
      </Button>
    </form>
  );
}
