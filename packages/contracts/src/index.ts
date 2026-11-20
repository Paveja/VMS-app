import { z } from 'zod';

export const roles = ['sales', 'inventory', 'manager', 'admin'] as const;
export const stockStatuses = ['in_transit', 'available', 'reserved', 'sold'] as const;
export const documentCategories = ['identity', 'address', 'insurance', 'registration'] as const;
export const fuels = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'] as const;
export const transmissions = ['Manual', 'Automatic'] as const;
export const id = z.string().uuid();
export const money = z.string().regex(/^\d{1,14}$/, 'Enter an integer amount in paise');
export const positiveMoney = money.refine((value) => BigInt(value) > 0n, 'Amount must be positive');
const text = z.string().trim().min(1).max(120);
export const modelSchema = z
  .object({
    brand: text,
    name: text,
    variant: text,
    fuel: z.enum(fuels),
    transmission: z.enum(transmissions),
    base_price_paise: positiveMoney,
    image_key: z.enum(['suv', 'sedan', 'hatchback', 'electric']).default('suv'),
    active: z.boolean().default(true),
  })
  .strict();
export const vehicleSchema = z
  .object({
    vin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{8,32}$/, 'Use 8–32 letters, digits or hyphens'),
    model_id: id,
    branch_id: id,
    color: text,
    status: z.enum(['in_transit', 'available']),
  })
  .strict();
export const customerSchema = z
  .object({
    name: text,
    phone: z
      .string()
      .transform((value) => value.replace(/[\s()+-]/g, ''))
      .pipe(z.string().regex(/^\d{10,15}$/, 'Enter 10–15 phone digits')),
    email: z
      .union([z.email(), z.literal('')])
      .optional()
      .default(''),
    address: z.string().trim().max(500).default(''),
  })
  .strict();
export const bookingSchema = z
  .object({
    customer_id: id,
    vehicle_id: id,
    notes: z.string().trim().max(2000).default(''),
    booked_at: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export const conversionSchema = z
  .object({ extras_paise: money.default('0'), tax_paise: money.default('0') })
  .strict();
export const paymentSchema = z.object({ amount_paise: positiveMoney }).strict();
export const reviewSchema = z
  .object({
    status: z.enum(['verified', 'rejected']),
    reason: z.string().trim().max(500).default(''),
  })
  .strict()
  .refine((value) => value.status !== 'rejected' || value.reason.length > 0, {
    message: 'Explain why this document is rejected',
    path: ['reason'],
  });
export const loginSchema = z
  .object({ email: z.email().toLowerCase(), password: z.string().min(1).max(256) })
  .strict();
export const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).default(''),
  branch_id: id.optional(),
  model_id: id.optional(),
  brand: z.string().max(120).optional(),
  variant: z.string().max(120).optional(),
  fuel: z.enum(fuels).optional(),
  transmission: z.enum(transmissions).optional(),
  color: z.string().max(120).optional(),
  status: z
    .enum([
      'in_transit',
      'available',
      'reserved',
      'sold',
      'confirmed',
      'cancelled',
      'converted',
      'open',
      'delivered',
    ])
    .optional(),
  sort: z.enum(['created_at', 'name', 'vin', 'status', 'total_paise']).default('created_at'),
  direction: z.enum(['asc', 'desc']).default('desc'),
  period: z.enum(['today', '7d', '30d', 'custom', 'all']).default('30d'),
  start: z.iso.date().optional(),
  end: z.iso.date().optional(),
  metric: z
    .enum([
      'available',
      'active_bookings',
      'open_orders',
      'payments',
      'outstanding',
      'ready',
      'in_transit',
      'delivered',
      'payment',
      'documents',
      'combined',
      'pending',
      'aged',
    ])
    .optional(),
  event: z.enum(['bookings', 'orders', 'payments', 'deliveries']).optional(),
});
export type Role = (typeof roles)[number];
export type Employee = { id: string; name: string; email: string; role: Role };
export type Query = z.infer<typeof querySchema>;
export type Row = Record<string, unknown>;
export type Page = { items: Row[]; total: number; page: number; limit: number };
export const privileges = {
  catalog: ['inventory', 'admin'],
  sales: ['sales', 'admin'],
  review: ['manager', 'admin'],
} satisfies Record<string, Role[]>;
export function can(role: Role, privilege: keyof typeof privileges) {
  return (privileges[privilege] as readonly Role[]).includes(role);
}
export function formatMoney(value: string | bigint | number = '0') {
  const amount = BigInt(value);
  return `₹${new Intl.NumberFormat('en-IN').format(amount / 100n)}.${(amount % 100n).toString().padStart(2, '0')}`;
}
export function rupeesToPaise(value: string) {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(value))
    throw new Error('Enter rupees with up to two decimals');
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
}
export function businessWindow(query: Pick<Query, 'period' | 'start' | 'end'>, now = new Date()) {
  const today = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
  const endDay = query.period === 'custom' ? query.end : today;
  const startDay = query.period === 'custom' ? query.start : today;
  if (!startDay || !endDay) throw new Error('Choose start and end dates');
  const start = new Date(`${startDay}T00:00:00+05:30`);
  const end = new Date(new Date(`${endDay}T00:00:00+05:30`).getTime() + 86400000);
  if (query.period === '7d' || query.period === '30d')
    start.setUTCDate(start.getUTCDate() - (query.period === '7d' ? 6 : 29));
  if (end <= start || (end.getTime() - start.getTime()) / 86400000 > 366)
    throw new Error('Choose a valid date range of at most 366 days');
  return { start: start.toISOString(), end: end.toISOString() };
}
