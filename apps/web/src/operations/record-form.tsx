import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { rupeesToPaise, type Employee, type Row } from '@dealerflow/contracts';
import { useAction, str, ApiError } from '../lib/api';
import { Card, Button, control, Select } from '../components/ui';
import { fields, Picker } from './form-fields';
export function RecordForm({
  resource,
  initial,
  employee,
}: {
  resource: string;
  initial: Row;
  employee: Employee;
}) {
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const pricePaise = BigInt(str(initial.base_price_paise, '0'));
    const basePrice = [pricePaise / 100n, (pricePaise % 100n).toString().padStart(2, '0')].join(
      '.',
    );
    return Object.fromEntries(
      (fields[resource] || []).map((field) => [
        field.name,
        field.name === 'base_price'
          ? basePrice
          : str(initial[field.name], field.options?.[0] || ''),
      ]),
    );
  });
  const [localError, setLocalError] = useState('');
  const action = useAction((row) => navigate(`/${resource}/${str(row.id)}`));
  const errors = action.error instanceof ApiError ? action.error.fields : {};
  function submit(event: FormEvent) {
    event.preventDefault();
    setLocalError('');
    try {
      const body: Record<string, unknown> = { ...values };
      if (resource === 'models') {
        body.base_price_paise = rupeesToPaise(values.base_price);
        delete body.base_price;
        body.active = initial.active ?? true;
      }
      if (resource === 'bookings') {
        if (values.booked_at)
          body.booked_at = new Date(`${values.booked_at}T12:00:00+05:30`).toISOString();
        else delete body.booked_at;
      }
      action.mutate({
        path: `/${resource === 'inventory' ? 'vehicles' : resource}${initial.id ? `/${str(initial.id)}` : ''}`,
        method: initial.id ? 'PATCH' : 'POST',
        body,
      });
    } catch (error) {
      setLocalError((error as Error).message);
    }
  }
  return (
    <Card className="max-w-2xl">
      <form onSubmit={submit} className="space-y-6 p-6">
        {resource === 'bookings' && (
          <p className="rounded-control bg-secondary p-4 text-sm text-primary">
            Salesperson: {employee.name}. Select one available VIN; its branch and model are
            preserved automatically.
          </p>
        )}
        {fields[resource].map((field) => (
          <div key={field.name}>
            {field.resource ? (
              <Picker
                field={field}
                value={values[field.name]}
                onChange={(value) => setValues({ ...values, [field.name]: value })}
              />
            ) : field.options ? (
              <Select
                label={field.label}
                value={values[field.name]}
                onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
              >
                {field.options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            ) : (
              <label className="grid gap-2 text-sm font-medium">
                {field.label}
                {field.required ? ' *' : ''}
                <input
                  name={field.name}
                  type={field.type || 'text'}
                  className={control}
                  required={field.required}
                  value={values[field.name]}
                  onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
                  aria-invalid={!!errors[field.name]}
                  aria-describedby={errors[field.name] ? `error-${field.name}` : undefined}
                />
              </label>
            )}
            {errors[field.name] && (
              <p id={`error-${field.name}`} role="alert" className="mt-2 text-xs text-destructive">
                {errors[field.name].join('. ')}
              </p>
            )}
          </div>
        ))}
        {(action.error || localError) && (
          <div role="alert" tabIndex={-1} className="text-sm text-destructive">
            {localError || action.error?.message}
            {Object.entries(errors).map(([field, messages]) => (
              <p key={field}>
                {field}: {messages.join('. ')}
              </p>
            ))}
          </div>
        )}
        <div className="flex justify-between gap-4 border-t border-border pt-6">
          <Link
            to={`/${resource}`}
            className="flex min-h-11 items-center text-sm text-muted-foreground"
          >
            Cancel
          </Link>
          <Button type="submit" disabled={action.isPending}>
            {action.isPending
              ? 'Saving…'
              : initial.id
                ? 'Save changes'
                : resource === 'bookings'
                  ? 'Reserve VIN'
                  : 'Create record'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
