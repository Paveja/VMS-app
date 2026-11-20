import { Link } from 'react-router-dom';
import { FileCheck2 } from 'lucide-react';
import type { Row } from '@dealerflow/contracts';
import { useApi, str, date } from '../lib/api';
import { State, Empty } from '../components/ui';
export function ActivityWidget({ scope }: { scope: string }) {
  const result = useApi<{ items: Row[] }>(`/analytics/activity?${scope}`);
  return (
    <State query={result}>
      {(data) => (
        <div className="divide-y divide-border">
          {data.items.map((item) => (
            <Link
              key={`${str(item.id)}-${str(item.event)}`}
              to={`${str(item.route)}?${scope}`}
              className="flex items-start gap-3 p-4 hover:bg-background"
            >
              <span className="rounded-full bg-secondary p-2 text-primary">
                <FileCheck2 size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{str(item.event)}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{str(item.label)}</p>
              </div>
              <span className="text-xs text-muted-foreground">{date(item.at)}</span>
            </Link>
          ))}
          {!data.items.length && <Empty text="No recorded activity in this scope." />}
          <p className="p-4 text-xs text-muted-foreground">
            Derived from stored order timestamps; not a comprehensive audit log.
          </p>
        </div>
      )}
    </State>
  );
}
