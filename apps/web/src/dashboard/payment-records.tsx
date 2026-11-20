import { Link, useSearchParams } from 'react-router-dom';
import { formatMoney } from '@dealerflow/contracts';
import { useApi, str, type List, date } from '../lib/api';
import { Card, State, Empty, Button } from '../components/ui';
export function PaymentRecords() {
  const [params, setParams] = useSearchParams();
  const query = new URLSearchParams(params);
  query.set('metric', 'payments');
  const result = useApi<List>(`/analytics/records?${query}`);
  return (
    <>
      <h1 className="text-2xl font-semibold">Recorded payments</h1>
      <p className="text-sm text-muted-foreground">
        Settled requests in the selected event period. Pending requests are excluded.
      </p>
      <Card>
        <State query={result}>
          {(data) => (
            <>
              {data.items.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Settled payments</caption>
                    <thead>
                      <tr>
                        {['Invoice', 'Branch', 'Settled', 'Amount'].map((label) => (
                          <th scope="col" key={label} className="p-4">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item) => (
                        <tr key={str(item.id)} className="border-t border-border">
                          <td className="p-4">
                            <Link
                              className="text-primary"
                              to={`/orders/${str(item.order_id)}?${params}`}
                            >
                              {str(item.invoice_ref)}
                            </Link>
                          </td>
                          <td className="p-4">{str(item.branch_name)}</td>
                          <td className="p-4">{date(item.paid_at)}</td>
                          <td className="p-4">{formatMoney(str(item.amount_paise, '0'))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  text={
                    params.size
                      ? 'No settled payments match your filters.'
                      : 'No settled payments recorded yet.'
                  }
                />
              )}
              <div className="flex justify-between border-t border-border p-4">
                <Button
                  secondary
                  disabled={data.page === 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(data.page - 1));
                    setParams(next);
                  }}
                >
                  Previous
                </Button>
                <span className="self-center text-xs">{data.total} records</span>
                <Button
                  secondary
                  disabled={data.page * data.limit >= data.total}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', String(data.page + 1));
                    setParams(next);
                  }}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </State>
      </Card>
    </>
  );
}
