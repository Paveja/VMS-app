import { useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LoaderCircle, X } from 'lucide-react';
import type { SearchItem } from '@dealerflow/contracts';
import { useGlobalSearch } from '../lib/use-global-search';
import { SearchResults, searchOptionId } from './search-results';
import { Button } from './ui';

export function GlobalSearch() {
  const containerRef = useRef<HTMLDivElement>(null);
  const search = useGlobalSearch(containerRef);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const listId = `${id}-results`;
  const navigate = useNavigate();
  const count = search.groups.reduce((total, group) => total + group.items.length, 0);
  const hasResults = !search.loading && !search.error && count > 0;
  function select(item: SearchItem) {
    search.change('');
    search.setOpen(false);
    navigate(`${item.href}${search.context ? `?${search.context}` : ''}`);
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
          onFocus={() => search.setOpen(true)}
          onClick={() => search.setOpen(true)}
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
        <div
          className="absolute inset-x-4 top-full z-50 mt-2 min-w-0 overflow-hidden rounded-container
            border border-border bg-card shadow-popover sm:inset-x-0"
        >
          <div
            id={`${id}-status`}
            role={search.error ? 'alert' : 'status'}
            aria-live="polite"
            className="px-4 py-3 text-sm text-muted-foreground"
          >
            {search.normalized.length < 2 ? (
              search.normalized ? (
                'Enter at least 2 characters to search.'
              ) : (
                'Type at least 2 characters to find a record.'
              )
            ) : search.error ? (
              'Search temporarily unavailable'
            ) : search.loading ? (
              <span className="flex items-center gap-2">
                <LoaderCircle size={16} aria-hidden="true" className="motion-safe:animate-spin" />
                Searching…
              </span>
            ) : count ? (
              `${count} ${count === 1 ? 'result' : 'results'} shown. Use ↑ ↓ to choose and Enter to open.`
            ) : (
              'No matches found'
            )}
          </div>
          {search.error && (
            <div className="px-4 pb-3">
              <Button secondary onClick={search.retry}>
                Retry search
              </Button>
            </div>
          )}
          {hasResults && (
            <SearchResults
              id={listId}
              groups={search.groups}
              query={search.normalized}
              activeId={search.active?.id}
              onHighlight={search.setSelectedId}
              onSelect={select}
            />
          )}
        </div>
      )}
    </div>
  );
}
