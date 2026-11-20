import type { QuotationEstimate, Row } from '@dealerflow/contracts';
export const modelId = '11111111-1111-4111-8111-111111111111';
export const model: Row = {
  id: modelId,
  brand: 'Aster',
  name: 'Crest',
  variant: 'VX',
  fuel: 'Petrol',
  transmission: 'Automatic',
  image_key: 'suv',
  active: true,
};
export const sample: QuotationEstimate = {
  request: { model_id: modelId, model_year: 2026, quantity: 3, city: 'Hyderabad' },
  vehicle: {
    brand: 'Aster',
    name: 'Crest',
    variant: 'VX',
    fuel: 'Petrol',
    transmission: 'Automatic',
    image_key: 'suv',
  },
  disclosure: 'Demo estimate—not live market pricing',
  source: 'Catalog base price + simulated city charges · demo-v1',
  checked_at: '2026-11-20T07:00:00Z',
  components: [
    { label: 'Catalog base price (tax treatment unverified)', paise: '10000001' },
    { label: 'Simulated registration / road-tax charge', paise: '1200000' },
    { label: 'Simulated insurance charge', paise: '3500000' },
  ],
  unit_paise: '14700001',
  total_paise: '44100003',
  stock: {
    available: 2,
    received: 1,
    in_transit: 1,
    total_branches: 2,
    branches: [
      { id: 'branch-one', name: 'Banjara Hills', available: 1, received: 1, in_transit: 1 },
      { id: 'branch-two', name: 'Jubilee Hills', available: 1, received: 0, in_transit: 0 },
    ],
  },
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
export async function defaultHttp(
  path: string | URL | Request,
  options?: RequestInit,
): Promise<Response> {
  const url = String(path);
  if (url === '/api/branches')
    return json({
      items: [{ id: 'branch-one', name: 'Banjara Hills', city: 'Hyderabad', active: true }],
    });
  if (url.startsWith('/api/models?')) return json({ items: [model], total: 1, page: 1, limit: 20 });
  if (url === `/api/models/${modelId}`) return json(model);
  if (url === '/api/quotations/preview')
    return json({ ...sample, request: JSON.parse(String(options?.body)) });
  return json({ error: { message: 'Record not found' } }, 404);
}
