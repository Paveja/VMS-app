import { LoaderCircle } from 'lucide-react';
import type { useGlobalSearch } from '../lib/use-global-search';
import type { SearchAction } from '../lib/recent-searches';
import { SearchResults } from './search-results';
import { SearchEmpty } from './search-empty';
import { Button } from './ui';
export function SearchPopover({
  search,
  id,
  emptyActions,
  onSelect,
  onClear,
}: {
  search: ReturnType<typeof useGlobalSearch>;
  id: string;
  emptyActions: SearchAction[];
  onSelect: (item: SearchAction) => void;
  onClear: () => void;
}) {
  const count = search.groups.reduce((total, group) => total + group.items.length, 0);
  return (
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
        {!search.normalized ? (
          'Choose a recent search or quick access.'
        ) : search.normalized.length < 2 ? (
          'Enter at least 2 characters to search.'
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
      {!search.normalized ? (
        <SearchEmpty
          id={`${id}-results`}
          actions={emptyActions}
          activeId={search.active?.id}
          onHighlight={search.setSelectedId}
          onSelect={onSelect}
          onClear={onClear}
        />
      ) : (
        <>
          {search.error && (
            <div className="px-4 pb-3">
              <Button secondary onClick={search.retry}>
                Retry search
              </Button>
            </div>
          )}
          {!search.loading && !search.error && count > 0 && (
            <SearchResults
              id={`${id}-results`}
              groups={search.groups}
              query={search.normalized}
              activeId={search.active?.id}
              onHighlight={search.setSelectedId}
              onSelect={onSelect}
            />
          )}
        </>
      )}
    </div>
  );
}
