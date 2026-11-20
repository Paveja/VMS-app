import { useRef, useEffect, useId, type ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { Button } from './ui';
export function State<T>({
  query,
  children,
}: {
  query: UseQueryResult<T, Error>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending)
    return (
      <div className="space-y-3 p-6" role="status" aria-label="Loading records">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-8 animate-pulse rounded-control bg-muted" />
        ))}
      </div>
    );
  return (
    <>
      {query.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 p-4 text-sm text-destructive"
        >
          <AlertCircle size={16} />
          {query.data ? 'Refresh failed. Showing stale data. ' : ''}
          {query.error.message}
          <Button secondary onClick={() => void query.refetch()}>
            <RefreshCw size={14} />
            Retry
          </Button>
        </div>
      )}
      {query.isFetching && query.data && (
        <p role="status" className="px-4 text-xs text-muted-foreground">
          Refreshing…
        </p>
      )}
      {query.data && children(query.data)}
    </>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  drawer = false,
  'aria-labelledby': labelledBy,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
  'aria-labelledby'?: string;
}) {
  const generatedTitleId = useId();
  const titleId = labelledBy ?? generatedTitleId;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className={`fixed max-h-dvh w-full max-w-xl overflow-y-auto border border-border bg-card p-6 text-foreground shadow-popover backdrop:bg-foreground/30 ${drawer ? 'left-auto right-0 top-0 m-0 h-dvh rounded-l-container' : 'm-auto max-h-[90dvh] rounded-container'}`}
    >
      <header className="mb-6 flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-xl font-semibold">
          {title}
        </h2>
        <Button secondary aria-label="Close" onClick={() => ref.current?.close()}>
          <X size={18} />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
