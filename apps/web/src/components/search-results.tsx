import { useEffect } from 'react';
import { CarFront, UserRound, CalendarCheck, Receipt } from 'lucide-react';
import type { SearchGroup, SearchItem } from '@dealerflow/contracts';
import { Badge } from './ui';
const categories = {
  vehicles: { label: 'Vehicles', icon: CarFront },
  customers: { label: 'Customers', icon: UserRound },
  bookings: { label: 'Bookings', icon: CalendarCheck },
  orders: { label: 'Orders', icon: Receipt },
};
function Highlight({ text, query }: { text: string; query: string }) {
  const start = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (start < 0 || !query) return <>{text}</>;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-secondary text-primary">
        {text.slice(start, start + query.length)}
      </mark>
      {text.slice(start + query.length)}
    </>
  );
}
export const searchOptionId = (listId: string, itemId: string) => `${listId}-${itemId}`;
export function SearchResults({
  id,
  groups,
  query,
  activeId,
  onSelect,
  onHighlight,
}: {
  id: string;
  groups: SearchGroup[];
  query: string;
  activeId?: string;
  onSelect: (item: SearchItem) => void;
  onHighlight: (id: string) => void;
}) {
  useEffect(() => {
    if (activeId)
      document.getElementById(searchOptionId(id, activeId))?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId, id]);
  return (
    <div
      id={id}
      role="listbox"
      aria-label="Search results"
      className="max-h-[60dvh] overflow-y-auto overscroll-contain p-2"
    >
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => {
          const { label, icon: Icon } = categories[group.type];
          const headingId = `${id}-${group.type}`;
          return (
            <div role="group" aria-labelledby={headingId} key={group.type}>
              <h2
                id={headingId}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                {label}
              </h2>
              {group.items.map((item) => (
                <div
                  id={searchOptionId(id, item.id)}
                  key={item.id}
                  role="option"
                  aria-selected={activeId === item.id}
                  aria-label={`${item.title}, ${item.subtitle}${item.status ? `, ${item.status.replaceAll('_', ' ')}` : ''}`}
                  title={`${item.title} — ${item.subtitle}`}
                  onPointerMove={() => onHighlight(item.id)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(item)}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-control
                    px-3 py-3 text-sm transition-colors ${
                      activeId === item.id
                        ? 'bg-secondary ring-2 ring-inset ring-ring'
                        : 'hover:bg-muted'
                    }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      <Highlight text={item.title} query={query} />
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      <Highlight text={item.subtitle} query={query} />
                    </span>
                  </span>
                  {item.status && (
                    <span className="shrink-0">
                      <Badge>{item.status}</Badge>
                    </span>
                  )}
                </div>
              ))}
              {group.hasMore && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  More {label.toLowerCase()} match. Refine your search.
                </p>
              )}
            </div>
          );
        })}
    </div>
  );
}
