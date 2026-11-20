import { useState } from 'react';
import type { SearchGroup, SearchItem } from '@dealerflow/contracts';

const historyLimit = 5;
export type SearchAction = SearchItem & { term?: string };
export const quickAccess: SearchAction[] = [
  {
    id: 'quick-inventory',
    title: 'Available Inventory',
    subtitle: 'Available vehicles',
    href: '/inventory?metric=available',
  },
  {
    id: 'quick-bookings',
    title: 'Active Bookings',
    subtitle: 'Confirmed reservations',
    href: '/bookings?metric=active_bookings',
  },
  {
    id: 'quick-payments',
    title: 'Pending Payments',
    subtitle: 'Orders with pending payment requests',
    href: '/orders?metric=pending',
  },
];
export const recentSearchKey = (employeeId: string) => `dealerflow.search-recent.v1:${employeeId}`;
const displayTerm = (term: string) => term.trim().replace(/\s+/g, ' ');
const sameTerm = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const invoiceReference = /^DF-\d{4}-[A-F0-9]{8}-[A-F0-9]{3}$/i;
function safeShape(term: string) {
  if (term.length < 2 || term.length > 120) return false;
  if (invoiceReference.test(term)) return true;
  return (
    /^[\p{L}\p{N} +.&/-]+$/u.test(term) &&
    /\p{L}/u.test(term) &&
    term.includes(' ') &&
    term.replace(/\D/g, '').length < 7 &&
    !/\b[A-Z0-9]{17}\b/i.test(term)
  );
}
export function eligibleRecent(term: string, groups: SearchGroup[]) {
  const normalized = displayTerm(term);
  if (!safeShape(normalized)) return false;
  // Do not infer safety from an absence of PII-looking characters alone.
  if (groups.some((group) => ['customers', 'bookings'].includes(group.type) && group.items.length))
    return false;
  return groups.some(
    (group) =>
      (group.type === 'vehicles' ||
        (group.type === 'orders' && invoiceReference.test(normalized))) &&
      group.items.some((item) => sameTerm(displayTerm(item.title), normalized)),
  );
}
function readRecent(employeeId?: string): string[] {
  if (!employeeId) return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(recentSearchKey(employeeId)) ?? '[]');
    if (
      !Array.isArray(parsed) ||
      parsed.some((term) => typeof term !== 'string' || !safeShape(term))
    )
      return [];
    return parsed
      .map(displayTerm)
      .filter((term, index, terms) => terms.findIndex((entry) => sameTerm(entry, term)) === index)
      .slice(0, historyLimit);
  } catch {
    console.warn('Recent search storage is unavailable or invalid');
    return [];
  }
}
export function useRecentSearches(employeeId?: string) {
  const [history, setHistory] = useState(() => ({ employeeId, terms: readRecent(employeeId) }));
  const terms = history.employeeId === employeeId ? history.terms : [];
  function write(next: string[]) {
    if (!employeeId) return;
    setHistory({ employeeId, terms: next });
    try {
      if (next.length) localStorage.setItem(recentSearchKey(employeeId), JSON.stringify(next));
      else localStorage.removeItem(recentSearchKey(employeeId));
    } catch {
      console.warn('Recent search storage could not be updated');
    }
  }
  return {
    terms,
    refresh: () => setHistory({ employeeId, terms: readRecent(employeeId) }),
    remember: (term: string, groups: SearchGroup[]) => {
      if (!employeeId || !eligibleRecent(term, groups)) return;
      const readable = displayTerm(term);
      write(
        [readable, ...terms.filter((entry) => !sameTerm(entry, readable))].slice(0, historyLimit),
      );
    },
    clear: () => write([]),
    actions: [
      ...terms.map((term, index) => ({
        id: `recent-${index}`,
        title: term,
        subtitle: 'Search again',
        href: '',
        term,
      })),
      ...quickAccess,
    ] satisfies SearchAction[],
  };
}
