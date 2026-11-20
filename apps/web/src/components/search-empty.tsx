import { useEffect } from 'react';
import { History, CarFront, CalendarCheck, IndianRupee } from 'lucide-react';
import type { SearchAction } from '../lib/recent-searches';
import { searchOptionId } from './search-results';
const icons = {
  'quick-inventory': CarFront,
  'quick-bookings': CalendarCheck,
  'quick-payments': IndianRupee,
};
export function SearchEmpty({
  id,
  actions,
  activeId,
  onHighlight,
  onSelect,
  onClear,
}: {
  id: string;
  actions: SearchAction[];
  activeId?: string;
  onHighlight: (id: string) => void;
  onSelect: (item: SearchAction) => void;
  onClear: () => void;
}) {
  const recent = actions.filter((item) => item.term);
  const shortcuts = actions.filter((item) => !item.term);
  useEffect(() => {
    if (activeId)
      document.getElementById(searchOptionId(id, activeId))?.scrollIntoView?.({ block: 'nearest' });
  }, [id, activeId]);
  return (
    <div className="max-h-[60dvh] overflow-y-auto overscroll-contain p-2">
      <div className="flex min-h-11 items-center justify-between gap-3 px-3">
        <h2 id={`${id}-recent`} className="text-xs font-semibold text-muted-foreground">
          Recent Searches
        </h2>
        {recent.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="min-h-11 rounded-control px-2 text-xs font-medium text-primary hover:bg-secondary"
          >
            Clear recent
          </button>
        )}
      </div>
      <div id={id} role="listbox" aria-label="Recent Searches and Quick Access">
        {[
          { label: 'Recent Searches', id: 'recent', items: recent },
          { label: 'Quick Access', id: 'quick', items: shortcuts },
        ].map((group) => (
          <div role="group" aria-labelledby={`${id}-${group.id}`} key={group.id}>
            {group.id === 'quick' && (
              <h2
                id={`${id}-quick`}
                className="px-3 py-3 text-xs font-semibold text-muted-foreground"
              >
                Quick Access
              </h2>
            )}
            {!group.items.length && (
              <p className="px-3 py-3 text-sm text-muted-foreground">No recent searches</p>
            )}
            {group.items.map((item) => {
              const Icon = item.term ? History : icons[item.id as keyof typeof icons];
              return (
                <div
                  key={item.id}
                  id={searchOptionId(id, item.id)}
                  role="option"
                  aria-selected={activeId === item.id}
                  aria-label={item.title}
                  title={item.title}
                  onPointerMove={() => onHighlight(item.id)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(item)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-3 text-sm ${
                    activeId === item.id
                      ? 'bg-secondary ring-2 ring-inset ring-ring'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Icon size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">{item.title}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
