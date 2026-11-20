// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { formatMoney } from '@dealerflow/contracts';
import { queryClient } from '../lib/api';
import { Kpis } from './kpis';
import { Journey } from './journey';
import type { Summary } from './types';

const summary: Summary = {
  asOf: '2026-11-20T00:00:00Z',
  available: 120,
  active_bookings: 48,
  open_orders: 36,
  payments: '12345678900',
  outstanding: '98765432100',
  ready: 12,
  in_transit: 8,
  reserved: 48,
  sold: 240,
  payment_only: 6,
  document_only: 4,
  combined: 2,
  definitions: {},
};
afterEach(() => {
  cleanup();
  queryClient.clear();
});
it('keeps KPI and journey values compact without shortening amounts or changing links', () => {
  queryClient.setQueryData(['api', '/analytics/summary?'], summary);
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Kpis scope="" />
        <Journey scope="" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  for (const value of [
    '120',
    '48',
    '36',
    '12',
    '8',
    '6',
    '240',
    formatMoney(summary.payments),
    formatMoney(summary.outstanding),
  ]) {
    for (const element of screen.getAllByText(value)) {
      expect(element.classList.contains('text-base')).toBe(true);
      expect(element.classList.contains('sm:text-lg')).toBe(true);
      expect(element.classList.contains('tabular-nums')).toBe(true);
      expect(element.classList.contains('text-2xl')).toBe(false);
    }
  }
  expect(screen.getByText(formatMoney(summary.payments)).closest('a')?.getAttribute('href')).toBe(
    '/records?metric=payments',
  );
  expect(screen.getByText('240').closest('a')?.getAttribute('href')).toBe(
    '/orders?metric=delivered',
  );
});
