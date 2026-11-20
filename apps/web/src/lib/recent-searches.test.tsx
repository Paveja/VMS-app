// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { SearchGroup } from '@dealerflow/contracts';
import { eligibleRecent, recentSearchKey, useRecentSearches } from './recent-searches';

const modelGroup = (title: string): SearchGroup[] => [
  {
    type: 'vehicles',
    hasMore: false,
    items: [{ id: 'vehicle', title, subtitle: 'Available', href: '/inventory/vehicle' }],
  },
];
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
describe('private recent search terms', () => {
  it('saves only exact recognized model titles or native displayed invoice references', () => {
    expect(eligibleRecent(' Aster Crest ZX+ ', modelGroup('Aster Crest ZX+'))).toBe(true);
    expect(eligibleRecent('Crest', modelGroup('Aster Crest ZX+'))).toBe(false);
    expect(eligibleRecent('Aster Crest', [])).toBe(false);
    const orders: SearchGroup[] = [
      {
        type: 'orders',
        hasMore: false,
        items: [
          { id: 'order', title: 'DF-2026-ABC12345-ABC', subtitle: 'Buyer', href: '/orders/order' },
        ],
      },
    ];
    expect(eligibleRecent('df-2026-abc12345-abc', orders)).toBe(true);
    expect(eligibleRecent('ORD-1024', orders)).toBe(false);
  });
  it('rejects customer names, phone/email/VIN/UUID queries and ambiguous text even with matches', () => {
    for (const term of [
      'Aarav Sethi',
      '9876543210',
      '+91 98765 43210',
      'buyer@example.test',
      'DF202600000000001',
      '1HGCM82633A004352',
      '12345678-1234-1234-1234-123456789abc',
      'BK-12345678',
    ]) {
      const customers: SearchGroup[] = [
        {
          type: 'customers',
          hasMore: false,
          items: [
            {
              id: 'customer',
              title: term,
              subtitle: 'Customer record',
              href: '/customers/customer',
            },
          ],
        },
      ];
      expect(eligibleRecent(term, customers)).toBe(false);
      if (term !== 'Aarav Sethi') expect(eligibleRecent(term, modelGroup(term))).toBe(false);
    }
    expect(
      eligibleRecent('Aster Crest ZX+', [
        ...modelGroup('Aster Crest ZX+'),
        {
          type: 'customers',
          hasMore: false,
          items: [
            { id: 'customer', title: 'Aster Crest ZX+', subtitle: '', href: '/customers/id' },
          ],
        },
      ]),
    ).toBe(false);
  });
  it('deduplicates case-insensitively, moves submissions newest-first and keeps five strings only', () => {
    const { result } = renderHook(() => useRecentSearches('employee-a'));
    for (const term of [
      'Aster Crest ZX+',
      'Aster Crest VX',
      'Northstar Evolve Long Range',
      'Meridian Arc Signature',
      'Meridian Urban Sport',
      'Northstar Summit Adventure',
    ]) {
      act(() => result.current.remember(term, modelGroup(term)));
    }
    expect(result.current.terms).toHaveLength(5);
    expect(result.current.terms[0]).toBe('Northstar Summit Adventure');
    act(() =>
      result.current.remember('  MERIDIAN ARC SIGNATURE ', modelGroup('Meridian Arc Signature')),
    );
    expect(result.current.terms[0]).toBe('MERIDIAN ARC SIGNATURE');
    expect(result.current.terms).toHaveLength(5);
    expect(
      result.current.terms.filter((term) => term.toLowerCase() === 'meridian arc signature'),
    ).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(recentSearchKey('employee-a'))!)).toEqual(
      result.current.terms,
    );
    expect(localStorage.length).toBe(1);
  });
  it('isolates employees, never uses an anonymous shared key and clears persistently', () => {
    const first = renderHook(() => useRecentSearches('employee-a'));
    act(() => first.result.current.remember('Aster Crest ZX+', modelGroup('Aster Crest ZX+')));
    const second = renderHook(() => useRecentSearches('employee-b'));
    expect(second.result.current.terms).toEqual([]);
    const anonymous = renderHook(() => useRecentSearches());
    act(() => anonymous.result.current.remember('Aster Crest ZX+', modelGroup('Aster Crest ZX+')));
    expect(anonymous.result.current.terms).toEqual([]);
    act(() => first.result.current.clear());
    expect(first.result.current.terms).toEqual([]);
    expect(localStorage.getItem(recentSearchKey('employee-a'))).toBeNull();
    first.unmount();
    const reloaded = renderHook(() => useRecentSearches('employee-a'));
    expect(reloaded.result.current.terms).toEqual([]);
  });
  it('hides previous history immediately if the employee changes without a remount', () => {
    const { result, rerender } = renderHook(({ id }) => useRecentSearches(id), {
      initialProps: { id: 'employee-a' },
    });
    act(() => result.current.remember('Aster Crest ZX+', modelGroup('Aster Crest ZX+')));
    rerender({ id: 'employee-b' });
    expect(result.current.terms).toEqual([]);
    act(() => result.current.refresh());
    expect(result.current.terms).toEqual([]);
  });
  it('ignores corrupt storage and handles unavailable storage reads/writes/removal without crashing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const key = recentSearchKey('employee-a');
    for (const invalid of ['not-json', '{}', '[123]', '["buyer@example.test"]']) {
      localStorage.setItem(key, invalid);
      const instance = renderHook(() => useRecentSearches('employee-a'));
      expect(instance.result.current.terms).toEqual([]);
      instance.unmount();
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('disabled');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('disabled');
    });
    const { result } = renderHook(() => useRecentSearches('employee-a'));
    expect(result.current.terms).toEqual([]);
    expect(result.current.actions).toHaveLength(3);
    expect(() =>
      act(() => result.current.remember('Aster Crest ZX+', modelGroup('Aster Crest ZX+'))),
    ).not.toThrow();
    expect(() => act(() => result.current.clear())).not.toThrow();
    expect(result.current.terms).toEqual([]);
  });
});
