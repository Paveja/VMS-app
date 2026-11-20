import { fuels, transmissions } from '@dealerflow/contracts';
import { Select, control } from '../components/ui';
export function CatalogFilters({
  inventory,
  params,
  update,
}: {
  inventory: boolean;
  params: URLSearchParams;
  update: (key: string, value: string) => void;
}) {
  return (
    <>
      {['brand', 'variant', ...(inventory ? ['color'] : [])].map((key) => (
        <label
          key={`${key}-${params.get(key) || ''}`}
          className="grid w-32 gap-1 text-xs capitalize text-muted-foreground"
        >
          {key}
          <input
            className={control}
            defaultValue={params.get(key) || ''}
            onBlur={(event) => update(key, event.target.value)}
          />
        </label>
      ))}
      {[
        ['fuel', fuels],
        ['transmission', transmissions],
      ].map(([name, options]) => (
        <Select
          key={String(name)}
          label={String(name)}
          className="w-36"
          value={params.get(String(name)) || ''}
          onChange={(event) => update(String(name), event.target.value)}
        >
          <option value="">All {String(name)} types</option>
          {(options as readonly string[]).map((option) => (
            <option key={option}>{option}</option>
          ))}
        </Select>
      ))}
    </>
  );
}
