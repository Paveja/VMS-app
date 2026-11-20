import { useSearchParams } from 'react-router-dom';
import type { Row } from '@dealerflow/contracts';
import { useApi, type List, str } from '../lib/api';
import { Button, Select, control } from '../components/ui';
export function ScopeFilters() {
  const [params, setParams] = useSearchParams();
  const branches = useApi<{ items: Row[] }>('/branches');
  const models = useApi<List>('/models?limit=100');
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    if (key === 'period' && value === 'custom') {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      next.set('start', today);
      next.set('end', today);
    }
    setParams(next);
  }
  return (
    <div className="grid min-w-0 items-end gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <Select
        label="Branch scope"
        value={params.get('branch_id') || ''}
        onChange={(event) => update('branch_id', event.target.value)}
      >
        <option value="">All branches</option>
        {branches.data?.items.map((branch) => (
          <option key={str(branch.id)} value={str(branch.id)}>
            {str(branch.name)}
          </option>
        ))}
      </Select>
      <Select
        label="Model scope"
        value={params.get('model_id') || ''}
        onChange={(event) => update('model_id', event.target.value)}
      >
        <option value="">All vehicle models</option>
        {models.data?.items.map((model) => (
          <option key={str(model.id)} value={str(model.id)}>
            {str(model.brand)} {str(model.name)} · {str(model.variant)}
          </option>
        ))}
      </Select>
      <Select
        label="Event period · IST"
        value={params.get('period') || '30d'}
        onChange={(event) => update('period', event.target.value)}
      >
        <option value="today">Today</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="all">All recorded events</option>
        <option value="custom">Custom dates</option>
      </Select>
      <Button secondary onClick={() => setParams({})}>
        Clear filters
      </Button>
      {params.get('period') === 'custom' && (
        <div className="col-span-full flex flex-wrap gap-4">
          {['start', 'end'].map((key) => (
            <label key={key} className="grid gap-1 text-xs capitalize text-muted-foreground">
              {key} date (inclusive)
              <input
                type="date"
                className={control}
                value={params.get(key) || ''}
                onChange={(event) => update(key, event.target.value)}
              />
            </label>
          ))}
        </div>
      )}
      <p className="col-span-full text-xs text-muted-foreground">
        Current stock & open blockers are live snapshots. Dates apply to recorded events only.
      </p>
    </div>
  );
}
