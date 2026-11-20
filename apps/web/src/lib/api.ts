import { useState, useEffect } from 'react';
import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';
import type { Row, Page } from '@dealerflow/contracts';
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: false } },
});
export class ApiError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
export async function api<T = Row>(path: string, options: RequestInit = {}): Promise<T> {
  const token = sessionStorage.getItem('dealerflow.token');
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (response.status === 401 && !path.startsWith('/auth/login')) {
    sessionStorage.removeItem('dealerflow.token');
    queryClient.clear();
    window.dispatchEvent(new Event('dealerflow:logout'));
  }
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ error: { message: 'Unable to reach DealerFlow' } }));
    throw new ApiError(data.error?.message || 'Request failed', data.error?.fields);
  }
  return response.json() as Promise<T>;
}
export function useApi<T = Row>(path: string, enabled = true) {
  return useQuery({
    queryKey: ['api', path],
    queryFn: ({ signal }) => api<T>(path, { signal }),
    enabled,
  });
}
export function useAction(onSuccess?: (row: Row) => void) {
  return useMutation({
    mutationFn: ({
      path,
      body = {},
      method = 'POST',
    }: {
      path: string;
      body?: object | FormData;
      method?: string;
    }) => api(path, { method, body: body instanceof FormData ? body : JSON.stringify(body) }),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ['api'] });
      onSuccess?.(row);
    },
  });
}
export function useDebouncedSearch() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ term: '', page: 1 });
  useEffect(() => {
    const timer = setTimeout(
      () => setQuery((current) => (current.term === search ? current : { term: search, page: 1 })),
      300,
    );
    return () => clearTimeout(timer);
  }, [search]);
  return {
    search,
    setSearch,
    term: query.term,
    page: query.page,
    setPage: (page: number) => setQuery((current) => ({ ...current, page })),
  };
}
export type List = Page;
export const str = (value: unknown, fallback = '—') =>
  value == null || value === '' ? fallback : String(value);
export const date = (value: unknown) =>
  value
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(
        new Date(String(value)),
      )
    : '—';
export const routeFor = (resource: string) => (resource === 'vehicles' ? 'inventory' : resource);
