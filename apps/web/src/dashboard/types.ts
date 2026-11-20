import type { Row } from '@dealerflow/contracts';
export type Summary = {
  asOf: string;
  available: number;
  active_bookings: number;
  open_orders: number;
  payments: string;
  outstanding: string;
  ready: number;
  in_transit: number;
  reserved: number;
  sold: number;
  payment_only: number;
  document_only: number;
  combined: number;
  definitions: Record<string, string>;
};
export type Stock = {
  distribution: { status: string; count: number }[];
  branches: Row[];
  models: { items: Row[]; total: number; page: number; limit: number };
  comparison: Row[];
};
export const metrics = [
  {
    key: 'available',
    label: 'Available VINs',
    unit: 'vehicles',
    route: '/inventory?metric=available',
  },
  {
    key: 'active_bookings',
    label: 'Active bookings',
    unit: 'reservations',
    route: '/bookings?metric=active_bookings',
  },
  { key: 'open_orders', label: 'Open orders', unit: 'orders', route: '/orders?metric=open_orders' },
  {
    key: 'payments',
    label: 'Recorded payments',
    unit: 'settled · event period',
    route: '/records?metric=payments',
  },
  {
    key: 'outstanding',
    label: 'Outstanding balance',
    unit: 'open orders · snapshot',
    route: '/orders?metric=outstanding',
  },
  { key: 'ready', label: 'Delivery-ready', unit: 'orders', route: '/orders?metric=ready' },
] as const;
export function scopedLink(route: string, scope: string) {
  const [pathname, search] = route.split('?');
  const params = new URLSearchParams(scope);
  for (const key of ['page', 'q', 'sort', 'status', 'metric']) params.delete(key);
  new URLSearchParams(search).forEach((value, key) => params.set(key, value));
  return `${pathname}?${params}`;
}
