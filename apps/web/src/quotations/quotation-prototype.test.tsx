// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { formatMoney } from '@dealerflow/contracts';
import { QuotationPrototype } from './quotation-prototype';
import { QuotationStock } from './quotation-stock';
import { defaultHttp, json, modelId, sample } from './quotation-test-data';
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const http = vi.fn(defaultHttp);
const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <QuotationPrototype />
    </QueryClientProvider>,
  );
async function selectVehicle() {
  await screen.findByRole('option', { name: /Aster · Crest · VX/ });
  fireEvent.change(screen.getByLabelText('Vehicle *'), { target: { value: modelId } });
  fireEvent.change(screen.getByLabelText('Model year *'), { target: { value: '2026' } });
  fireEvent.change(screen.getByLabelText('Quantity *'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Registration city *'), {
    target: { value: 'Hyderabad' },
  });
}
beforeEach(() => {
  http.mockReset();
  http.mockImplementation(defaultHttp);
  vi.stubGlobal('fetch', http);
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
it('calculates from the selected fields, discloses demo prices, shows real-stock response and prints', async () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  sessionStorage.setItem('dealerflow.token', 'component-test-token');
  mount();
  expect(screen.getByText('Your estimate will appear here')).toBeTruthy();
  await selectVehicle();
  fireEvent.click(screen.getByRole('button', { name: 'Calculate estimate' }));
  expect(await screen.findByRole('heading', { name: 'Your quotation estimate' })).toBeTruthy();
  expect(screen.getByText(formatMoney(sample.total_paise))).toBeTruthy();
  expect(screen.getByText('Banjara Hills')).toBeTruthy();
  expect(
    screen.getByText(/Exact-year availability and shipment readiness are unverified/),
  ).toBeTruthy();
  const call = http.mock.calls.find(([path]) => String(path) === '/api/quotations/preview');
  expect(JSON.parse(String(call?.[1]?.body))).toEqual(sample.request);
  expect(call?.[1]?.headers).toMatchObject({ Authorization: 'Bearer component-test-token' });
  const printable = document.querySelector('[data-print]');
  expect(printable?.textContent).toContain(sample.disclosure);
  expect(printable?.textContent).toContain(sample.source);
  fireEvent.click(screen.getByRole('button', { name: 'Print / save PDF' }));
  expect(print).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText('Quantity *'), { target: { value: '2' } });
  expect(screen.queryByRole('heading', { name: 'Your quotation estimate' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Print / save PDF' })).toBeNull();
});
it('retains invalid values, shows field feedback and makes no invalid pricing request', async () => {
  mount();
  await selectVehicle();
  fireEvent.change(screen.getByLabelText('Quantity *'), { target: { value: '0' } });
  fireEvent.blur(screen.getByLabelText('Quantity *'));
  expect(screen.getByText('Enter a whole quantity from 1 to 999.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Calculate estimate' }));
  expect(screen.getByText('Check the highlighted fields.')).toBeTruthy();
  expect((screen.getByLabelText('Quantity *') as HTMLInputElement).value).toBe('0');
  expect(http.mock.calls.some(([path]) => String(path).includes('/preview'))).toBe(false);
});
it('keeps choices after a server failure and supports calculating again', async () => {
  let fail = true;
  http.mockImplementation(async (path, options) =>
    String(path) === '/api/quotations/preview' && fail
      ? json({ error: { message: 'Pricing temporarily unavailable' } }, 503)
      : defaultHttp(path, options),
  );
  mount();
  await selectVehicle();
  fireEvent.click(screen.getByRole('button', { name: 'Calculate estimate' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText(/Pricing temporarily unavailable/)).toBeTruthy();
  expect((screen.getByLabelText('Quantity *') as HTMLInputElement).value).toBe('3');
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Calculate estimate' }));
  expect(await screen.findByRole('heading', { name: 'Your quotation estimate' })).toBeTruthy();
});
it('shows initial loading and disables duplicate submissions while checking prices', async () => {
  let complete: ((response: Response) => void) | undefined;
  http.mockImplementation((path, options) =>
    String(path) === '/api/quotations/preview'
      ? new Promise<Response>((resolve) => {
          complete = resolve;
        })
      : defaultHttp(path, options),
  );
  mount();
  expect(screen.getAllByRole('status', { name: 'Loading records' }).length).toBeGreaterThan(0);
  await selectVehicle();
  fireEvent.click(screen.getByRole('button', { name: 'Calculate estimate' }));
  expect(await screen.findByText('Checking catalog prices and city stock…')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Calculating estimate…' }) as HTMLButtonElement).disabled,
  ).toBe(true);
  complete?.(json(sample));
  expect(await screen.findByRole('heading', { name: 'Your quotation estimate' })).toBeTruthy();
});
it('handles a missing catalog, no search results and clearing a search', async () => {
  http.mockImplementation(async (path, options) =>
    String(path).startsWith('/api/models?')
      ? json({ items: [], total: 0, page: 1, limit: 20 })
      : defaultHttp(path, options),
  );
  mount();
  expect(await screen.findByText(/No catalog models yet/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Search make, model or variant'), {
    target: { value: 'missing' },
  });
  expect(await screen.findByText('No vehicles match your search.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  await waitFor(() =>
    expect((screen.getByLabelText('Search make, model or variant') as HTMLInputElement).value).toBe(
      '',
    ),
  );
});
it('retries failed catalog loading and shows a clear unsupported-city state', async () => {
  let fail = true;
  http.mockImplementation(async (path, options) =>
    String(path).startsWith('/api/models?') && fail
      ? json({ error: { message: 'Catalog unavailable' } }, 503)
      : String(path) === '/api/branches'
        ? json({ items: [] })
        : defaultHttp(path, options),
  );
  mount();
  expect(await screen.findByText('Catalog unavailable')).toBeTruthy();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('option', { name: /Aster · Crest · VX/ })).toBeTruthy();
  expect(screen.getByText('No active branch has supported demo city pricing.')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Calculate estimate' }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
it('has explicit zero-stock, empty-branch and bounded-detail states without inventing readiness', () => {
  render(
    <QuotationStock
      estimate={{
        ...sample,
        stock: { available: 0, received: 0, in_transit: 0, branches: [], total_branches: 0 },
      }}
    />,
  );
  expect(
    screen.getByText('No available stock for this vehicle in the selected city.'),
  ).toBeTruthy();
  expect(screen.getByText('No branch stock details are available.')).toBeTruthy();
  cleanup();
  render(
    <QuotationStock estimate={{ ...sample, stock: { ...sample.stock, total_branches: 25 } }} />,
  );
  expect(screen.getByText(/Showing 2 of 25 branches/)).toBeTruthy();
  expect(screen.getByText('Verification needed')).toBeTruthy();
});
