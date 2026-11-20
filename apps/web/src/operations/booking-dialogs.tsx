import { useState, useId } from 'react';
import { rupeesToPaise } from '@dealerflow/contracts';
import { type useAction } from '../lib/api';
import { Button, Dialog, control } from '../components/ui';
export function BookingDialogs({
  id,
  vin,
  confirm,
  conversion,
  closeConfirm,
  closeConversion,
  action,
}: {
  id: string;
  vin: string;
  confirm: boolean;
  conversion: boolean;
  closeConfirm: () => void;
  closeConversion: () => void;
  action: ReturnType<typeof useAction>;
}) {
  const dialogId = useId();
  const cancelTitleId = `${dialogId}-cancel-title`;
  const conversionTitleId = `${dialogId}-conversion-title`;
  const [error, setError] = useState('');
  return (
    <>
      {confirm && (
        <Dialog title="Cancel this booking?" aria-labelledby={cancelTitleId} onClose={closeConfirm}>
          <p className="mb-6 text-sm text-muted-foreground">
            This releases VIN {vin} back to available inventory. Converted bookings cannot be
            cancelled.
          </p>
          <div className="flex justify-between">
            <Button secondary onClick={closeConfirm}>
              Keep booking
            </Button>
            <Button
              disabled={action.isPending}
              onClick={() => action.mutate({ path: `/bookings/${id}/cancel` })}
            >
              Confirm cancellation
            </Button>
          </div>
          {action.error && <p role="alert">{action.error.message}</p>}
        </Dialog>
      )}
      {conversion && (
        <Dialog
          title="Create sales order"
          aria-labelledby={conversionTitleId}
          onClose={closeConversion}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              const form = new FormData(event.currentTarget);
              try {
                action.mutate({
                  path: `/bookings/${id}/convert`,
                  body: {
                    extras_paise: rupeesToPaise(String(form.get('extras'))),
                    tax_paise: rupeesToPaise(String(form.get('tax'))),
                  },
                });
              } catch (cause) {
                setError((cause as Error).message);
              }
            }}
          >
            <p className="text-sm text-muted-foreground">
              The server snapshots the current catalog base price. Tax and extras are explicit demo
              amounts, not a compliance calculation.
            </p>
            {[
              ['extras', 'Extras (₹)'],
              ['tax', 'Demo tax (₹)'],
            ].map(([name, label]) => (
              <label key={name} className="grid gap-2 text-sm">
                {label}
                <input
                  className={control}
                  name={name}
                  defaultValue="0"
                  required
                  pattern="[0-9]+(\.[0-9]{1,2})?"
                />
              </label>
            ))}
            <p role="alert" className="text-sm text-destructive">
              {error || action.error?.message}
            </p>
            <Button type="submit" disabled={action.isPending}>
              {action.isPending ? 'Creating…' : 'Create order & invoice'}
            </Button>
          </form>
        </Dialog>
      )}
    </>
  );
}
