import { Link } from 'react-router-dom';
import {
  CarFront,
  CalendarCheck,
  ClipboardList,
  IndianRupee,
  Wallet,
  KeyRound,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { formatMoney } from '@dealerflow/contracts';
import { State } from '../components/ui';
import { useApi } from '../lib/api';
import { metrics, scopedLink, type Summary } from './types';
const icons = [CarFront, CalendarCheck, ClipboardList, IndianRupee, Wallet, KeyRound];
export function Kpis({ scope }: { scope: string }) {
  const result = useApi<Summary>(`/analytics/summary?${scope}`);
  return (
    <State query={result}>
      {(summary) => (
        <section
          aria-label="Executive metrics"
          className="grid min-w-0 grid-cols-2 gap-4 xl:grid-cols-6"
        >
          {metrics.map((metric, index) => {
            const Icon = icons[index];
            const value = summary[metric.key];
            return (
              <article
                key={metric.key}
                className="relative min-w-0 rounded-container border border-border bg-card p-4 shadow-card"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className={`rounded-control p-2 ${metric.key === 'ready' ? 'bg-success-soft text-success' : 'bg-secondary text-primary'}`}
                  >
                    <Icon size={18} />
                  </span>
                  <ArrowUpRight className="text-muted-foreground" size={14} />
                </div>
                <Link className="block" to={scopedLink(metric.route, scope)}>
                  <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                  <p
                    className={`mt-2 break-words text-2xl font-semibold tracking-tight tabular-nums ${metric.key === 'ready' ? 'text-success' : ''}`}
                  >
                    {typeof value === 'string' ? formatMoney(value) : value.toLocaleString('en-IN')}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{metric.unit}</p>
                </Link>
                <details className="mt-3 text-xs text-muted-foreground">
                  <summary className="inline-flex min-h-6 cursor-pointer items-center gap-1">
                    <Info size={12} />
                    Definition & scope
                  </summary>
                  <p className="mt-2 leading-relaxed">
                    {summary.definitions[metric.key]} As of{' '}
                    {new Date(summary.asOf).toLocaleTimeString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                    })}{' '}
                    IST. Effective branch/model filters apply.
                  </p>
                </details>
              </article>
            );
          })}
        </section>
      )}
    </State>
  );
}
