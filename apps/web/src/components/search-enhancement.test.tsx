// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { queryClient } from '../lib/api';
import { recentSearchKey } from '../lib/recent-searches';
import { GlobalSearch } from './search-dialog';
const term = 'Aster Crest ZX+';
function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function mount(employeeId = 'employee-a', path = '/') {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <GlobalSearch employeeId={employeeId} />
        <input aria-label="Other form" />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  return input;
}
function change(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}
beforeEach(() => {
  sessionStorage.setItem('dealerflow.token', 'test-session');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => {
      const query = new URL(url, 'http://example.test').searchParams.get('q')!;
      return new Response(
        JSON.stringify({
          query,
          groups: [
            {
              type: 'vehicles',
              hasMore: false,
              items: [
                {
                  id: 'vehicle',
                  title: term,
                  subtitle: 'VIN ••••1234 · available',
                  href: '/inventory/vehicle',
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }),
  );
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('renders empty history and three keyboard-accessible shortcuts without a network request', () => {
  const input = mount();
  expect(screen.getByText('No recent searches')).toBeTruthy();
  expect(screen.getByRole('group', { name: 'Recent Searches' })).toBeTruthy();
  expect(screen.getAllByRole('option')).toHaveLength(3);
  expect(fetch).not.toHaveBeenCalled();
  expect(input.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  const pending = screen.getByRole('option', { name: 'Pending Payments' });
  expect(input.getAttribute('aria-activedescendant')).toBe(pending.id);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByTestId('location').textContent).toBe('/orders?metric=pending');
});
it('records an explicitly submitted safe model term and selecting it reuses grouped live search', async () => {
  const input = mount();
  change(input, term);
  await screen.findByRole('option', { name: /Aster Crest ZX\+, VIN/ });
  fireEvent.keyDown(input, { key: 'Enter' });
  change(input, '');
  const recent = screen.getByRole('option', { name: term });
  expect(JSON.parse(localStorage.getItem(recentSearchKey('employee-a'))!)).toEqual([term]);
  fireEvent.click(recent);
  expect((input as HTMLInputElement).value).toBe(term);
  expect(await screen.findByRole('option', { name: /Aster Crest ZX\+, VIN/ })).toBeTruthy();
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByTestId('location').textContent).toBe('/inventory/vehicle');
  expect(JSON.parse(localStorage.getItem(recentSearchKey('employee-a'))!)).toEqual([term]);
});
it('does not record terms merely from typing and never saves unclassified or identifying queries', async () => {
  const input = mount();
  change(input, term);
  await screen.findByRole('option', { name: /Aster Crest ZX\+, VIN/ });
  expect(localStorage.getItem(recentSearchKey('employee-a'))).toBeNull();
  for (const sensitive of [
    'Aarav Sethi',
    'buyer@example.test',
    '9876543210',
    'DF202600000000001',
  ]) {
    change(input, sensitive);
    await screen.findByRole('option', { name: /Aster Crest ZX\+, VIN/ });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(localStorage.getItem(recentSearchKey('employee-a'))).toBeNull();
  }
});
it('clears recent terms immediately and keeps them cleared after remount', () => {
  localStorage.setItem(recentSearchKey('employee-a'), JSON.stringify([term]));
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Clear recent' }));
  expect(screen.queryByRole('option', { name: term })).toBeNull();
  expect(screen.getByText('No recent searches')).toBeTruthy();
  expect(localStorage.getItem(recentSearchKey('employee-a'))).toBeNull();
  cleanup();
  queryClient.clear();
  mount();
  expect(screen.getByText('No recent searches')).toBeTruthy();
});
it('navigates each supported shortcut with branch/model scope and no redundant query parameters', () => {
  for (const [label, path] of [
    ['Available Inventory', '/inventory'],
    ['Active Bookings', '/bookings'],
    ['Pending Payments', '/orders'],
  ]) {
    mount('employee-a', '/?branch_id=branch&model_id=model&period=7d');
    fireEvent.click(screen.getByRole('option', { name: label }));
    const location = new URL(screen.getByTestId('location').textContent!, 'http://example.test');
    expect(location.pathname).toBe(path);
    expect(location.searchParams.get('branch_id')).toBe('branch');
    expect(location.searchParams.get('model_id')).toBe('model');
    expect(location.searchParams.get('metric')).toBe(
      label === 'Available Inventory'
        ? 'available'
        : label === 'Active Bookings'
          ? 'active_bookings'
          : 'pending',
    );
    expect(location.searchParams.has('period')).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    cleanup();
    queryClient.clear();
  }
});
it('supports recent-item keyboard selection, Escape/outside dismissal and employee isolation', () => {
  localStorage.setItem(recentSearchKey('employee-a'), JSON.stringify([term]));
  const input = mount();
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect((input as HTMLInputElement).value).toBe(term);
  change(input, '');
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(input.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(input);
  fireEvent.pointerDown(screen.getByLabelText('Other form'));
  expect(input.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(input);
  act(() => {
    sessionStorage.removeItem('dealerflow.token');
    window.dispatchEvent(new Event('dealerflow:logout'));
  });
  expect(screen.queryByRole('option')).toBeNull();
  cleanup();
  queryClient.clear();
  sessionStorage.setItem('dealerflow.token', 'another-session');
  mount('employee-b');
  expect(screen.queryByRole('option', { name: term })).toBeNull();
  expect(screen.getByText('No recent searches')).toBeTruthy();
});
it('keeps Quick Access and typed search operational with corrupt or disabled storage', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  localStorage.setItem(recentSearchKey('employee-a'), 'invalid json');
  const getItem = Storage.prototype.getItem;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    if (this === localStorage) throw new Error('disabled');
    return getItem.call(this, key);
  });
  const input = mount();
  expect(screen.getByRole('option', { name: 'Available Inventory' })).toBeTruthy();
  change(input, term);
  expect(await screen.findByRole('option', { name: /Aster Crest ZX\+, VIN/ })).toBeTruthy();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
});
