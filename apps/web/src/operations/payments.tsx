import { useState } from 'react';
import { type Employee, type Row, can, formatMoney, rupeesToPaise } from '@dealerflow/contracts';
import { useAction, str, date } from '../lib/api';
import { Card, Badge, Button, control } from '../components/ui';
export function Payments({ order, employee }: { order: Row; employee: Employee }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const action = useAction(() => {
    setAmount('');
    setError('');
  });
  const payments = (order.payments || []) as Row[];
  const capacity =
    BigInt(str(order.total_paise, '0')) -
    BigInt(str(order.paid_paise, '0')) -
    BigInt(str(order.pending_paise, '0'));
  return (
    <Card
      title="Payment requests"
      aside={<span className="text-xs text-muted-foreground">Simulated settlement</span>}
    >
      <div className="divide-y divide-border">
        {payments.map((payment) => (
          <div
            key={str(payment.id)}
            className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
          >
            <div>
              <p className="text-sm font-semibold">{formatMoney(str(payment.amount_paise, '0'))}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {date(payment.paid_at ?? payment.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{str(payment.status)}</Badge>
              {payment.status === 'pending' &&
                can(employee.role, 'review') &&
                order.status === 'open' && (
                  <Button
                    secondary
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: `/orders/${str(order.id)}/payments/${str(payment.id)}/settle`,
                      })
                    }
                  >
                    Settle
                  </Button>
                )}
            </div>
          </div>
        ))}
        {!payments.length && (
          <p className="p-6 text-sm text-muted-foreground">No payment requests yet.</p>
        )}
      </div>
      {can(employee.role, 'sales') && order.status === 'open' && (
        <form
          className="space-y-3 border-t border-border p-6"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              setError('');
              action.mutate({
                path: `/orders/${str(order.id)}/payments`,
                body: { amount_paise: rupeesToPaise(amount) },
              });
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        >
          <p className="text-xs text-muted-foreground">
            Unrequested capacity: {formatMoney(capacity)}
          </p>
          <label className="grid gap-2 text-sm">
            New request amount (₹)
            <input
              className={control}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              required
              placeholder="0.00"
            />
          </label>
          <Button type="submit" disabled={action.isPending || capacity === 0n}>
            {action.isPending ? 'Saving…' : 'Create payment request'}
          </Button>
        </form>
      )}
      {(error || action.error) && (
        <p role="alert" className="p-6 text-sm text-destructive">
          {error || action.error?.message}
        </p>
      )}
    </Card>
  );
}
