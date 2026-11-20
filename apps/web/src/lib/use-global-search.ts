import { useEffect, useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { searchLimit, type SearchResult } from '@dealerflow/contracts';
import { api, queryClient } from './api';
import type { SearchAction } from './recent-searches';

export function useGlobalSearch(
  containerRef: RefObject<HTMLDivElement | null>,
  emptyActions: SearchAction[] = [],
) {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [params] = useSearchParams();
  const normalized = text.trim();
  const scope = new URLSearchParams();
  for (const key of ['branch_id', 'model_id']) {
    const value = params.get(key);
    if (value) scope.set(key, value);
  }
  const context = scope.toString();
  scope.set('q', normalized);
  scope.set('limitPerGroup', String(searchLimit));
  const path = `/analytics/search?${scope}`;
  const authenticated = !signedOut && !!sessionStorage.getItem('dealerflow.token');
  const ready = normalized.length >= 2 && normalized === term;
  const result = useQuery({
    queryKey: ['global-search', path],
    queryFn: ({ signal }) => api<SearchResult>(path, { signal }),
    enabled: open && authenticated && ready,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const groups =
    open &&
    authenticated &&
    ready &&
    !result.isError &&
    !result.isFetching &&
    result.data?.query === normalized
      ? result.data.groups
      : [];
  const items: SearchAction[] = normalized ? groups.flatMap((group) => group.items) : emptyActions;
  const active = items.find((item) => item.id === selectedId);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(normalized), 300);
    return () => clearTimeout(timer);
  }, [normalized]);
  useEffect(() => {
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target))
        setOpen(false);
    };
    const logout = () => {
      setSignedOut(true);
      setOpen(false);
      setText('');
      setTerm('');
      setSelectedId(null);
      void queryClient.cancelQueries({ queryKey: ['global-search'] });
      queryClient.removeQueries({ queryKey: ['global-search'] });
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    window.addEventListener('dealerflow:logout', logout);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
      window.removeEventListener('dealerflow:logout', logout);
    };
  }, [containerRef]);
  function change(value: string) {
    setText(value);
    setSelectedId(null);
    setOpen(true);
  }
  function move(direction: number) {
    if (!open) {
      setOpen(true);
      return;
    }
    if (!items.length) return;
    const index = items.findIndex((item) => item.id === selectedId);
    const next =
      index < 0
        ? direction > 0
          ? 0
          : items.length - 1
        : (index + direction + items.length) % items.length;
    setSelectedId(items[next].id);
  }
  return {
    text,
    normalized,
    open: open && authenticated,
    setOpen,
    change,
    move,
    active,
    selectedId,
    setSelectedId,
    groups,
    context,
    loading: normalized.length >= 2 && (!ready || result.isFetching || result.isPending),
    error: ready && result.isError,
    retry: () => void result.refetch(),
  };
}
