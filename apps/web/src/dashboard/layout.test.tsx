// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { defaults, loadLayout, useLayout } from './layout';
import { rupeesToPaise, formatMoney, businessWindow, querySchema } from '@dealerflow/contracts';
import { Select, Dialog } from '../components/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient, useDebouncedSearch, useAction } from '../lib/api';
import { GlobalSearch } from '../components/search-dialog';
import { ResourceViews } from '../operations/resource-views';
import { ResourceList } from '../operations/resource-list';
import { BookingDialogs } from '../operations/booking-dialogs';
import { Invoice } from '../operations/invoice';
import { BranchWidget } from './branch-widget';
import { TrendWidget } from './trend-widget';
import { PaymentRecords } from './payment-records';
afterEach(() => {
  cleanup();
  localStorage.clear();
  queryClient.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function Harness() {
  const layout = useLayout('employee-a', 'manager', 'executive');
  return (
    <>
      <output data-testid="first">{layout.widgets[0].key}</output>
      <button onClick={layout.begin}>Customize</button>
      <button onClick={() => layout.move(layout.widgets[0].key, 1)}>Move</button>
      <button onClick={layout.cancel}>Cancel</button>
      <button onClick={layout.save}>Save</button>
      <button onClick={layout.reset}>Reset</button>
      {layout.error && <p role="alert">{layout.error}</p>}
    </>
  );
}
function SearchHarness() {
  const { search, setSearch, term, page, setPage } = useDebouncedSearch();
  return (
    <>
      <input
        aria-label="Debounced search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <output data-testid="query">
        {term}:{page}
      </output>
      <button onClick={() => setPage(2)}>Next page</button>
    </>
  );
}
function BookingHarness() {
  const action = useAction();
  return (
    <BookingDialogs
      id="booking"
      vin="DEMO-VIN"
      confirm
      conversion
      closeConfirm={() => {}}
      closeConversion={() => {}}
      action={action}
    />
  );
}
function renderWorkspace(children: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}
describe('UI quality regressions', () => {
  it('debounces rapid typing, resets the page only at commit and cancels on unmount', () => {
    vi.useFakeTimers();
    const view = render(<SearchHarness />);
    fireEvent.click(screen.getByText('Next page'));
    fireEvent.change(screen.getByLabelText('Debounced search'), { target: { value: 'cre' } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(screen.getByLabelText('Debounced search'), { target: { value: 'crest' } });
    act(() => vi.advanceTimersByTime(299));
    expect(screen.getByTestId('query').textContent).toBe(':2');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId('query').textContent).toBe('crest:1');
    fireEvent.change(screen.getByLabelText('Debounced search'), { target: { value: 'pending' } });
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps header search separate from simultaneous dialog title associations', () => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.setAttribute('open', '');
        },
      },
      close: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.removeAttribute('open');
        },
      },
    });
    renderWorkspace(
      <>
        <GlobalSearch />
        <BookingHarness />
        <Dialog title="Another panel" onClose={() => {}}>
          Content
        </Dialog>
      </>,
    );
    const search = screen.getByRole('combobox', { name: 'Search VIN, customer, booking or order' });
    const other = screen.getByRole('dialog', { name: 'Another panel' });
    expect(search.id).not.toBe(other.getAttribute('aria-labelledby'));
    for (const name of ['Cancel this booking?', 'Create sales order']) {
      const panel = screen.getByRole('dialog', { name });
      expect(panel.querySelector('h2')?.id).toBe(panel.getAttribute('aria-labelledby'));
    }
  });
  it('distinguishes empty and filtered no-results lists without rendering empty tables', () => {
    queryClient.setQueryData(['api', '/analytics/stock?'], { branches: [], comparison: [] });
    queryClient.setQueryData(['api', '/analytics/trends?branch_id=example'], {
      items: [],
      explanation: '',
    });
    renderWorkspace(
      <>
        <BranchWidget scope="" />
        <TrendWidget scope="branch_id=example" />
        <ResourceViews resource="inventory" items={[]} search="q=missing" />
      </>,
    );
    expect(screen.getByText('No branches yet.')).toBeTruthy();
    expect(screen.getByText('No trend records match your filters.')).toBeTruthy();
    expect(screen.getByText('No records match your filters.')).toBeTruthy();
    expect(screen.queryAllByRole('table')).toHaveLength(0);
  });
  it('owns record loading, empty, no-results and errors at the collection level', () => {
    const employee = {
      id: 'viewer',
      name: 'Viewer',
      email: 'viewer@example.test',
      role: 'inventory' as const,
    };
    queryClient.setQueryData(['api', '/branches'], { items: [] });
    queryClient.setQueryData(['api', '/models?limit=100'], {
      items: [],
      total: 0,
      page: 1,
      limit: 100,
    });
    const view = renderWorkspace(<ResourceList resource="customers" employee={employee} />);
    expect(screen.getByRole('status', { name: 'Loading records' })).toBeTruthy();
    view.unmount();
    queryClient.setQueryData(['api', '/customers?'], { items: [], total: 0, page: 1, limit: 20 });
    const empty = renderWorkspace(<ResourceList resource="customers" employee={employee} />);
    expect(
      screen.getByText('No records yet. Create the first record to get started.'),
    ).toBeTruthy();
    empty.unmount();
    const filtered = renderWorkspace(
      <ResourceViews resource="inventory" items={[]} search="q=missing" />,
    );
    expect(screen.getByText('No records match your filters.')).toBeTruthy();
    expect(screen.queryByRole('row')).toBeNull();
    filtered.unmount();
    queryClient
      .getQueryCache()
      .find({ queryKey: ['api', '/customers?'] })!
      .setState({ status: 'error', error: new Error('Contact records unavailable') });
    renderWorkspace(<ResourceList resource="customers" employee={employee} />);
    expect(screen.getByRole('alert').textContent).toContain('Contact records unavailable');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
  it('preserves loading and retryable error states in list widgets', () => {
    const loading = renderWorkspace(<BranchWidget scope="q=uncached" />);
    expect(screen.getByRole('status', { name: 'Loading records' })).toBeTruthy();
    loading.unmount();
    queryClient.clear();
    queryClient.setQueryData(['api', '/analytics/trends?failed'], { items: [], explanation: '' });
    queryClient
      .getQueryCache()
      .find({ queryKey: ['api', '/analytics/trends?failed'] })!
      .setState({ status: 'error', error: new Error('Recorded request failure') });
    renderWorkspace(<TrendWidget scope="failed" />);
    expect(screen.getByRole('alert').textContent).toContain('Recorded request failure');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
  it('scopes every rendered table header and uses semantic stable record columns', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    queryClient.setQueryData(['api', '/analytics/stock?'], {
      branches: [{ id: 'branch', name: 'Test branch', available: 1, active_bookings: 0 }],
      comparison: [],
    });
    queryClient.setQueryData(['api', '/analytics/trends?'], {
      items: [{ day: '2026-11-20', orders: 1 }],
      explanation: 'Actual events',
    });
    queryClient.setQueryData(['api', '/analytics/records?metric=payments'], {
      items: [{ id: 'payment', order_id: 'order', invoice_ref: 'INV-test', amount_paise: '100' }],
      total: 1,
      page: 1,
      limit: 20,
    });
    const snapshot = { customer: {}, model: {}, branch: {}, vin: 'test', color: 'Blue' };
    renderWorkspace(
      <>
        <BranchWidget scope="" />
        <TrendWidget scope="" />
        <PaymentRecords />
        <ResourceViews
          resource="inventory"
          items={[{ id: 'vehicle', status: 'available' }]}
          search=""
        />
        <Invoice order={{ snapshot, total_paise: '100' }} />
      </>,
    );
    expect(screen.getAllByRole('table')).toHaveLength(5);
    for (const header of document.querySelectorAll('th'))
      expect(['col', 'row']).toContain(header.getAttribute('scope'));
  });
});
describe('workspace presentation and exact formatting', () => {
  it('handles missing/corrupt/outdated layout without losing primary access', () => {
    expect(loadLayout('missing', 'executive')).toEqual(defaults('executive'));
    localStorage.setItem('bad', 'broken');
    expect(loadLayout('bad', 'executive')).toHaveLength(6);
    localStorage.setItem('bad', JSON.stringify({ version: 99, widgets: [] }));
    expect(loadLayout('bad', 'executive')).toHaveLength(6);
  });
  it('previews, cancels, saves, reloads and resets keyboard-usable layout controls', () => {
    const view = render(<Harness />);
    fireEvent.click(screen.getByText('Customize'));
    fireEvent.click(screen.getByText('Move'));
    expect(screen.getByTestId('first').textContent).toBe('stock');
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByTestId('first').textContent).toBe('sales');
    fireEvent.click(screen.getByText('Customize'));
    fireEvent.click(screen.getByText('Move'));
    fireEvent.click(screen.getByText('Save'));
    view.unmount();
    render(<Harness />);
    expect(screen.getByTestId('first').textContent).toBe('stock');
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByTestId('first').textContent).toBe('sales');
  });
  it('reports storage failures instead of claiming save', () => {
    render(<Harness />);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByRole('alert').textContent).toContain('could not be saved');
    spy.mockRestore();
  });
  it('gives selects accessible labels and exactly one reserved custom chevron', () => {
    const view = render(
      <Select label="Branch" defaultValue="long">
        <option value="long">An intentionally long fictional branch option</option>
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'Branch' }).className).toContain('pr-10');
    expect(screen.getByRole('combobox').className).toContain('appearance-none');
    expect(view.container.querySelectorAll('svg')).toHaveLength(1);
  });
  it('keeps paise exact and rejects negative, excess precision and float-coercion inputs', () => {
    expect(rupeesToPaise('1234567.89')).toBe('123456789');
    expect(formatMoney('123456789')).toBe('₹12,34,567.89');
    for (const value of ['-1', '1.999', 'NaN', '1e3']) expect(() => rupeesToPaise(value)).toThrow();
  });
  it('uses half-open Kolkata business days and rejects unbounded/invalid periods', () => {
    const query = querySchema.parse({ period: 'today' });
    expect(businessWindow(query, new Date('2026-11-20T01:00:00Z'))).toEqual({
      start: '2026-11-19T18:30:00.000Z',
      end: '2026-11-20T18:30:00.000Z',
    });
    expect(() =>
      businessWindow({ period: 'custom', start: '2026-11-22', end: '2026-11-20' }),
    ).toThrow();
  });
});
