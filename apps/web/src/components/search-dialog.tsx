import { useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useRecentSearches, type SearchAction } from '../lib/recent-searches';
import { scopedLink } from '../dashboard/types';
import { useGlobalSearch } from '../lib/use-global-search';
import { searchOptionId } from './search-results';
import { SearchPopover } from './search-popover';

export function GlobalSearch({ employeeId }: { employeeId?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const recent = useRecentSearches(employeeId);
  const search = useGlobalSearch(containerRef, recent.actions);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const listId = `${id}-results`;
  const navigate = useNavigate();
  const count = search.groups.reduce((total, group) => total + group.items.length, 0);
  const hasResults = !search.normalized || (!search.loading && !search.error && count > 0);
  function open() {
    recent.refresh();
    search.setOpen(true);
  }
  function select(item: SearchAction) {
    if (item.term) {
      search.change(item.term);
      input.current?.focus();
      return;
    }
    recent.remember(search.normalized, search.groups);
    search.change('');
    search.setOpen(false);
    navigate(search.context ? scopedLink(item.href, search.context) : item.href);
  }
  return (
    <div
      ref={containerRef}
      role="search"
      aria-label="Global search"
      className="min-w-0 flex-1 sm:relative sm:max-w-md"
    >
      <label htmlFor={id} className="sr-only">
        Search VIN, customer, booking or order
      </label>
      <div className="relative min-w-0">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={input}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={search.open}
          aria-controls={search.open && hasResults ? listId : undefined}
          aria-describedby={search.open ? `${id}-status` : undefined}
          aria-activedescendant={
            search.open && search.active ? searchOptionId(listId, search.active.id) : undefined
          }
          placeholder="Search VIN, customer, booking or order…"
          maxLength={120}
          value={search.text}
          onChange={(event) => search.change(event.target.value)}
          onFocus={open}
          onClick={open}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              search.setOpen(false);
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              search.move(event.key === 'ArrowDown' ? 1 : -1);
            }
            if (event.key === 'Enter' && search.open) {
              event.preventDefault();
              if (search.active) select(search.active);
              else recent.remember(search.normalized, search.groups);
            }
          }}
          className="h-11 w-full min-w-0 truncate rounded-control border border-border bg-background
            pl-10 pr-12 text-sm text-foreground placeholder:text-muted-foreground
            focus:border-primary focus:outline-2 focus:outline-ring"
        />
        {search.text && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center
              rounded-control text-muted-foreground hover:bg-muted"
            onClick={() => {
              search.change('');
              input.current?.focus();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {search.open && (
        <SearchPopover
          search={search}
          id={id}
          emptyActions={recent.actions}
          onSelect={select}
          onClear={() => {
            recent.clear();
            input.current?.focus();
          }}
        />
      )}
    </div>
  );
}
