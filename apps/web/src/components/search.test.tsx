// @vitest-environment jsdom
import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { SearchResult } from '@dealerflow/contracts';
import { queryClient } from '../lib/api';
import { GlobalSearch } from './search-dialog';
import { Shell } from './shell';
const data: SearchResult = {
  query: 'Crest',
  groups: [
    {
      type: 'vehicles',
      hasMore: true,
      items: [
        {
          id: 'vehicle',
          title: 'Aster Crest ZX+',
          subtitle: 'VIN ••••1234 · available · Jubilee Hills',
          href: '/inventory/vehicle',
          status: 'available',
        },
      ],
    },
    {
      type: 'customers',
      hasMore: false,
      items: [
        {
          id: 'customer',
          title: 'Crest Buyer',
          subtitle: 'Customer record',
          href: '/customers/customer',
        },
      ],
    },
    {
      type: 'bookings',
      hasMore: false,
      items: [
        { id: 'booking', title: 'BK-12345678', subtitle: 'Crest Buyer', href: '/bookings/booking' },
      ],
    },
    {
      type: 'orders',
      hasMore: false,
      items: [
        { id: 'order', title: 'INV-2026-123', subtitle: 'Crest Buyer', href: '/orders/order' },
      ],
    },
  ],
};
const response = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function mount(initial = '/') {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initial]}>
        <GlobalSearch />
        <label>
          Outside form
          <input aria-label="Outside form" />
        </label>
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return screen.getByRole('combobox');
}
function type(input: HTMLElement, value = 'Crest') {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
}
async function options() {
  return screen.findAllByRole('option');
}
beforeEach(() => {
  sessionStorage.setItem('dealerflow.token', 'test-session');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => response(data)),
  );
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  sessionStorage.clear();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Part 1 header global search', () => {
  it('shows empty-query shortcuts without requesting data and waits 300ms after two characters', async () => {
    vi.useFakeTimers();
    const input = mount();
    fireEvent.focus(input);
    expect(screen.getByText('No recent searches')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Quick Access' })).toBeTruthy();
    type(input, 'C');
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(fetch).not.toHaveBeenCalled();
    type(input);
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(fetch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('q=Crest');
    expect(localStorage.length).toBe(0);
  });
  it('renders all groups, literal match marks, context, badges and additional-match hints', async () => {
    const input = mount();
    type(input);
    expect(await options()).toHaveLength(4);
    for (const label of ['Vehicles', 'Customers', 'Bookings', 'Orders']) {
      expect(screen.getByRole('group', { name: label })).toBeTruthy();
    }
    expect(screen.getByText('More vehicles match. Refine your search.')).toBeTruthy();
    expect(document.querySelector('mark')?.textContent).toBe('Crest');
    expect(input.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
    expect(screen.getByRole('option', { name: /Aster Crest/ }).getAttribute('title')).toContain(
      'Jubilee Hills',
    );
  });
  it('supports Arrow Up/Down, active descendant, Enter and context-preserving detail navigation', async () => {
    const input = mount('/?branch_id=branch&model_id=model');
    type(input);
    await options();
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: /INV-2026/ }).id,
    );
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Aster Crest/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('location').textContent).toBe(
      '/inventory/vehicle?branch_id=branch&model_id=model',
    );
    expect(screen.queryByRole('option')).toBeNull();
  });
  it('opens every existing domain detail through mouse selection', async () => {
    for (const [title, path] of [
      ['Aster Crest', '/inventory/vehicle'],
      ['Crest Buyer', '/customers/customer'],
      ['BK-12345678', '/bookings/booking'],
      ['INV-2026', '/orders/order'],
    ]) {
      const input = mount();
      type(input);
      await options();
      fireEvent.click(screen.getByRole('option', { name: new RegExp(`^${title}`) }));
      expect(screen.getByTestId('location').textContent).toBe(path);
      cleanup();
      queryClient.clear();
    }
  });
  it('dismisses with Escape and outside pointer/focus without blocking underlying form entry', async () => {
    const input = mount();
    type(input);
    await options();
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(input);
    fireEvent.click(input);
    await options();
    const outside = screen.getByLabelText('Outside form');
    fireEvent.pointerDown(outside);
    fireEvent.change(outside, { target: { value: 'Form kept' } });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect((outside as HTMLInputElement).value).toBe('Form kept');
    fireEvent.focus(input);
    await options();
    fireEvent.focusIn(outside);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
  it('distinguishes loading, no matches and a failed request with working retry', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response({ query: 'Crest', groups: [] }));
    const input = mount();
    type(input);
    expect(screen.getByText('Searching…')).toBeTruthy();
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Search temporarily unavailable',
    );
    expect(screen.queryByText('No matches found')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry search' }));
    expect(await screen.findByText('No matches found')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('cancels obsolete requests and never exposes late results from an older query', async () => {
    let finishOld: (value: Response) => void = () => {};
    let oldSignal: AbortSignal | null | undefined;
    vi.mocked(fetch)
      .mockImplementationOnce((_url, init) => {
        oldSignal = init?.signal;
        return new Promise<Response>((resolve) => {
          finishOld = resolve;
        });
      })
      .mockResolvedValueOnce(response({ query: 'Latest', groups: [] }));
    const input = mount();
    type(input);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    type(input, 'Latest');
    expect(screen.queryByRole('option')).toBeNull();
    await act(async () => finishOld(response(data)));
    expect(oldSignal?.aborted).toBe(true);
    expect(await screen.findByText('No matches found')).toBeTruthy();
    expect(screen.queryByRole('option')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('No recent searches')).toBeTruthy();
  });
  it('hides protected results on logout and prevents a pending response from restoring them', async () => {
    const input = mount();
    type(input);
    await options();
    act(() => {
      sessionStorage.removeItem('dealerflow.token');
      window.dispatchEvent(new Event('dealerflow:logout'));
    });
    expect(screen.queryByRole('option')).toBeNull();
    fireEvent.focus(input);
    type(input);
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
  it('uses the existing 401 session-expiry handling instead of rendering protected cached results', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ error: { message: 'Session expired' } }, 401));
    const input = mount();
    type(input);
    await waitFor(() => expect(sessionStorage.getItem('dealerflow.token')).toBeNull());
    expect(screen.queryByRole('option')).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
  it('wires search into the authenticated shell with a responsive anchored panel', () => {
    cleanup();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Shell
            employee={{
              id: 'admin',
              name: 'Demo Admin',
              role: 'admin',
              email: 'admin@example.test',
            }}
            logout={() => {}}
          >
            <p>Existing content</p>
          </Shell>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(input.getAttribute('placeholder')).toBe('Search VIN, customer, booking or order…');
    expect(input.closest('header')?.className).toContain('relative');
    expect(screen.getByRole('status').parentElement?.className).toContain('sm:inset-x-0');
    expect(screen.getByText('Existing content')).toBeTruthy();
  });
});
