import { Link } from 'react-router-dom';
import { CarFront, ArrowUpRight } from 'lucide-react';
import { type Row, formatMoney } from '@dealerflow/contracts';
import { str, date } from '../lib/api';
import { Badge } from '../components/ui';
export function RecordRow({
  resource,
  row,
  search,
}: {
  resource: string;
  row: Row;
  search: string;
}) {
  const href = `/${resource}/${str(row.id)}${search ? `?${search}` : ''}`;
  const columnKeys =
    resource === 'inventory'
      ? ['vehicle', 'branch', 'color', 'status']
      : resource === 'customers'
        ? ['customer', 'phone', 'email', 'created']
        : resource === 'bookings'
          ? ['booking', 'vehicle', 'branch', 'status']
          : ['invoice', 'vehicle', 'value', 'status'];
  const cells =
    resource === 'inventory'
      ? [
          <>
            <div className="flex items-center gap-2">
              <CarFront size={16} className="text-primary" />
              {str(row.brand)} {str(row.model_name)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{str(row.vin)}</p>
          </>,
          str(row.branch_name),
          str(row.color),
          <Badge>{str(row.status)}</Badge>,
        ]
      : resource === 'customers'
        ? [
            <Link className="font-medium text-primary" to={href}>
              {str(row.name)}
            </Link>,
            str(row.phone),
            str(row.email),
            date(row.created_at),
          ]
        : resource === 'bookings'
          ? [
              <>
                <p className="font-medium">{str(row.customer_name)}</p>
                <p className="mt-1 text-xs text-muted-foreground">BK-{str(row.id).slice(0, 8)}</p>
              </>,
              <>
                {str(row.model_name)}
                <p className="mt-1 text-xs text-muted-foreground">{str(row.vin)}</p>
              </>,
              str(row.branch_name),
              <Badge>{str(row.status)}</Badge>,
            ]
          : [
              <>
                <p className="font-medium">{str(row.invoice_ref)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{str(row.customer_name)}</p>
              </>,
              <>
                {str(row.model_name)}
                <p className="mt-1 text-xs text-muted-foreground">{str(row.branch_name)}</p>
              </>,
              <span className="font-medium tabular-nums">
                {formatMoney(str(row.total_paise, '0'))}
              </span>,
              <Badge>{row.ready ? 'ready' : str(row.status)}</Badge>,
            ];
  return (
    <tr className="hover:bg-background">
      {cells.map((cell, index) => (
        <td key={`${str(row.id)}-${columnKeys[index]}`} className="whitespace-nowrap px-6 py-4">
          {cell}
        </td>
      ))}
      <td className="px-6 py-4">
        <Link
          to={href}
          className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary"
        >
          View
          <ArrowUpRight size={14} />
        </Link>
      </td>
    </tr>
  );
}
