import { useApi, useDebouncedSearch, type List, str } from '../lib/api';
import { Button, control, Select, State } from '../components/ui';
export type Field = {
  name: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
  resource?: string;
};
export const fields: Record<string, Field[]> = {
  models: [
    { name: 'brand', label: 'Manufacturer', required: true },
    { name: 'name', label: 'Model name', required: true },
    { name: 'variant', label: 'Variant', required: true },
    { name: 'fuel', label: 'Fuel', options: ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'] },
    { name: 'transmission', label: 'Transmission', options: ['Manual', 'Automatic'] },
    { name: 'base_price', label: 'Base price (₹)', required: true },
    {
      name: 'image_key',
      label: 'Representative illustration',
      options: ['suv', 'sedan', 'hatchback', 'electric'],
    },
  ],
  inventory: [
    { name: 'vin', label: 'VIN / chassis identifier', required: true },
    { name: 'model_id', label: 'Model', resource: 'models' },
    { name: 'branch_id', label: 'Branch', resource: 'branches' },
    { name: 'color', label: 'Color', required: true },
    { name: 'status', label: 'Stock status', options: ['available', 'in_transit'] },
  ],
  customers: [
    { name: 'name', label: 'Full name', required: true },
    { name: 'phone', label: 'Phone', type: 'tel', required: true },
    { name: 'email', label: 'Email (optional)', type: 'email' },
    { name: 'address', label: 'Address (optional)' },
  ],
  bookings: [
    { name: 'customer_id', label: 'Customer', resource: 'customers' },
    { name: 'vehicle_id', label: 'Available VIN', resource: 'vehicles' },
    { name: 'booked_at', label: 'Booking date', type: 'date' },
    { name: 'notes', label: 'Notes (optional)' },
  ],
};
export function Picker({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const { search, setSearch, term, page, setPage } = useDebouncedSearch();
  const result = useApi<List>(
    `/${field.resource}?limit=20&page=${page}&q=${encodeURIComponent(term)}${field.resource === 'vehicles' ? '&status=available' : ''}`,
  );
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{field.label} *</legend>
      {field.resource !== 'branches' && (
        <input
          aria-label={`Search ${field.label}`}
          placeholder={`Search ${field.label.toLowerCase()}…`}
          className={control}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
      )}
      <State query={result}>
        {(data) => (
          <>
            <Select
              label={`Select ${field.label}`}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            >
              <option value="">Choose {field.label.toLowerCase()}</option>
              {!data.items.some((item) => item.id === value) && value && (
                <option value={value}>Current selection · {value.slice(0, 8)}</option>
              )}
              {data.items.map((item) => (
                <option key={str(item.id)} value={str(item.id)}>
                  {field.resource === 'vehicles'
                    ? `${str(item.model_name)} · ${str(item.vin)} · ${str(item.branch_name)}`
                    : `${str(item.name)}${item.variant ? ` · ${str(item.variant)}` : ''}`}
                </option>
              ))}
            </Select>
            {!data.items.length && (
              <p role="status" className="text-xs text-muted-foreground">
                {term ? 'No options match your search.' : 'No options available yet.'}
              </p>
            )}
            {data.total > 20 && (
              <div className="flex items-center justify-between text-xs">
                <Button secondary disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span>Page {page}</span>
                <Button
                  secondary
                  disabled={page * 20 >= data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </State>
    </fieldset>
  );
}
