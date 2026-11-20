import {
  quotationPreviewSchema,
  quotationDisclosure,
  type QuotationEstimate,
} from '@dealerflow/contracts';
import { one, rows, transaction, HttpError } from './db.ts';

// Fictional external-pricing adapter. These are not statutory rates or insurer offers.
const demoCharges = {
  Hyderabad: { registrationBasisPoints: 1200n, insurancePaise: 3500000n },
  Bengaluru: { registrationBasisPoints: 1500n, insurancePaise: 3800000n },
};
type StockBranch = QuotationEstimate['stock']['branches'][number] & {
  total_available: number;
  total_transit: number;
  total_received: number;
  total_branches: number;
};
export async function quotationPreview(body: unknown): Promise<QuotationEstimate> {
  const input = quotationPreviewSchema.parse(body);
  return transaction(async (connection) => {
    const model = await one(
      connection,
      `
      SELECT brand,name,variant,fuel,transmission,image_key,base_price_paise::text
      FROM vehicle_models WHERE id=$1 AND active`,
      [input.model_id],
    );
    const branches = await rows<StockBranch>(
      connection,
      `
      WITH branch_stock AS (
        SELECT br.id,br.name,
          count(v.id) FILTER(WHERE v.status='available')::int AS available,
          count(v.id) FILTER(WHERE v.status='in_transit')::int AS in_transit,
          count(v.id) FILTER(WHERE v.status='available' AND v.received_at IS NOT NULL)::int AS received
        FROM branches br LEFT JOIN vehicles v ON v.branch_id=br.id AND v.model_id=$1
        WHERE br.active AND br.city=$2 GROUP BY br.id
      )
      SELECT *,sum(available) OVER()::int AS total_available,
        sum(in_transit) OVER()::int AS total_transit,sum(received) OVER()::int AS total_received,
        count(*) OVER()::int AS total_branches
      FROM branch_stock ORDER BY name,id LIMIT 20`,
      [input.model_id, input.city],
    );
    const totals = branches[0];
    if (!totals) throw new HttpError(422, 'Choose a city with an active dealership branch');
    const base = BigInt(model.base_price_paise);
    const charges = demoCharges[input.city];
    const registration = (base * charges.registrationBasisPoints + 5000n) / 10000n;
    const unit = base + registration + charges.insurancePaise;
    return {
      request: input,
      vehicle: {
        brand: model.brand,
        name: model.name,
        variant: model.variant,
        fuel: model.fuel,
        transmission: model.transmission,
        image_key: model.image_key,
      },
      disclosure: quotationDisclosure,
      source: 'Catalog base price + simulated city charges · demo-v1',
      checked_at: new Date().toISOString(),
      components: [
        { label: 'Catalog base price (tax treatment unverified)', paise: base.toString() },
        { label: 'Simulated registration / road-tax charge', paise: registration.toString() },
        { label: 'Simulated insurance charge', paise: charges.insurancePaise.toString() },
      ],
      unit_paise: unit.toString(),
      total_paise: (unit * BigInt(input.quantity)).toString(),
      stock: {
        available: totals.total_available,
        in_transit: totals.total_transit,
        received: totals.total_received,
        total_branches: totals.total_branches,
        branches: branches.map(({ id, name, available, in_transit, received }) => ({
          id,
          name,
          available,
          in_transit,
          received,
        })),
      },
    };
  }, true);
}
