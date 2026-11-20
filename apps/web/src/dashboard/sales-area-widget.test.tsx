// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { SalesAreas } from '@dealerflow/contracts';
import { queryClient } from '../lib/api';
import { SalesAreaWidget } from './sales-area-widget';
import { defaults, loadLayout } from './layout';
const path = '/analytics/sales-areas?';
const sales: SalesAreas = {
  items: [
    { city: 'Hyderabad', deliveries: 3, rank: 1 },
    { city: 'Bengaluru', deliveries: 2, rank: 2 },
    { city: 'Chennai', deliveries: 2, rank: 2 },
  ],
  totalDeliveries: 12,
  totalAreas: 8,
};
function mount(scope = '') {
  return render(
    <QueryClientProvider client={queryClient}>
      <SalesAreaWidget scope={scope} />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  queryClient.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
});
it('shows city delivery ranks, clear tie semantics and compact counts without recomputing totals from displayed rows', () => {
  queryClient.setQueryData(['api', path], sales);
  mount();
  const rows = screen.getAllByRole('listitem');
  expect(rows).toHaveLength(3);
  expect(within(rows[0]).getByText('Hyderabad')).toBeTruthy();
  expect(within(rows[0]).getByLabelText('Rank 1')).toBeTruthy();
  expect(screen.getAllByLabelText('Rank 2')).toHaveLength(2);
  const count = within(rows[0]).getByText('3');
  expect(count.classList.contains('text-base')).toBe(true);
  expect(count.classList.contains('sm:text-lg')).toBe(true);
  expect(screen.getByText(/12 completed deliveries across 8 cities/)).toBeTruthy();
  expect(screen.getByText(/Showing the top 3 cities/)).toBeTruthy();
  expect(screen.getByText(/Equal delivery counts share a rank/)).toBeTruthy();
});
it('shows a genuine no-deliveries state instead of inventing a leading city', () => {
  queryClient.setQueryData(['api', path], { items: [], totalDeliveries: 0, totalAreas: 0 });
  mount();
  expect(screen.getByText('No completed deliveries in this period and scope.')).toBeTruthy();
  expect(screen.queryByRole('list')).toBeNull();
});
it('preserves loading and non-destructive failure/retry states', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => new Promise(() => {})),
  );
  const loading = mount('period=7d');
  expect(screen.getByRole('status', { name: 'Loading records' })).toBeTruthy();
  loading.unmount();
  queryClient.setQueryDefaults(['api', path], { retry: false });
  vi.mocked(fetch).mockRejectedValueOnce(new Error('Temporarily unavailable'));
  mount();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('No completed deliveries in this period and scope.')).toBeNull();
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(sales), { status: 200 }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Hyderabad')).toBeTruthy();
});
it('passes selected dashboard period, branch and model to the authenticated aggregate API', async () => {
  sessionStorage.setItem('dealerflow.token', 'test-token');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(sales), { status: 200 })),
  );
  const scope = 'period=30d&branch_id=branch&model_id=model';
  mount(scope);
  expect(await screen.findByText('Hyderabad')).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith(
    `/api${path}${scope}`,
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }),
  );
  sessionStorage.clear();
});
it('enables the sales widget in both landing presets and migrates legacy layouts without losing preferences', () => {
  for (const preset of ['executive', 'operations']) {
    expect(defaults(preset)[0]).toEqual({ key: 'sales', size: 'small', visible: true });
  }
  const previous = defaults('executive')
    .filter((widget) => widget.key !== 'sales')
    .reverse()
    .map((widget) => ({ ...widget, visible: false, size: 'large' as const }));
  localStorage.setItem('legacy', JSON.stringify({ version: 1, widgets: previous }));
  const migrated = loadLayout('legacy', 'executive');
  expect(migrated[0]).toEqual({ key: 'sales', size: 'small', visible: true });
  expect(migrated.slice(1)).toEqual(previous);
  expect(migrated).toHaveLength(6);
});
it('preserves explicitly customized sales visibility, size and order on reload', () => {
  const customized = defaults('executive')
    .reverse()
    .map((widget) =>
      widget.key === 'sales' ? { ...widget, size: 'large' as const, visible: false } : widget,
    );
  localStorage.setItem('custom', JSON.stringify({ version: 1, widgets: customized }));
  expect(loadLayout('custom', 'executive')).toEqual(customized);
});
