import { fileURLToPath } from 'node:url';
import { pool, transaction, rows, one } from '../apps/api/src/lib/db.ts';
import { hashPassword } from '../apps/api/src/lib/auth.ts';
import { insert } from '../apps/api/src/lib/stock.ts';
import { createBooking, cancelBooking } from '../apps/api/src/lib/stock.ts';
import {
  convertBooking,
  createPayment,
  settlePayment,
  deliverOrder,
} from '../apps/api/src/lib/orders.ts';
import { uploadDocument, reviewDocument } from '../apps/api/src/lib/documents.ts';
export async function seed() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('Set DEMO_PASSWORD to at least 12 characters before explicit seed');
  const passwordHash = await hashPassword(password);
  const existing = await rows(pool, "SELECT id FROM employees WHERE email='admin@dealerflow.demo'");
  if (existing.length) {
    console.info('Fictional seed already exists; existing records preserved');
    return;
  }
  await transaction(async (connection) => {
    await connection.query('SELECT pg_advisory_xact_lock(728195)');
    const names = ['Aditi Sharma', 'Arjun Mehta', 'Priya Nair', 'Vikram Rao'];
    for (const [index, role] of ['admin', 'sales', 'inventory', 'manager'].entries())
      await insert(connection, 'employees', {
        name: names[index],
        email: `${role}@dealerflow.demo`,
        password_hash: passwordHash,
        role,
      });
    for (const [name, city] of [
      ['Jubilee Hills', 'Hyderabad'],
      ['Whitefield', 'Bengaluru'],
      ['Banjara Hills', 'Hyderabad'],
    ])
      await insert(connection, 'branches', { name, city });
    const models = [
      ['Aster', 'Crest', 'ZX+', 'Petrol', 'Automatic', '184900000', 'suv'],
      ['Aster', 'Crest', 'VX', 'Diesel', 'Manual', '162500000', 'suv'],
      ['Northstar', 'Evolve', 'Long Range', 'Electric', 'Automatic', '224900000', 'electric'],
      ['Meridian', 'Arc', 'Signature', 'Petrol', 'Automatic', '142000000', 'sedan'],
      ['Meridian', 'Urban', 'Sport', 'Petrol', 'Manual', '84900000', 'hatchback'],
      ['Northstar', 'Summit', 'Adventure', 'Hybrid', 'Automatic', '269500000', 'suv'],
    ];
    for (const [brand, name, variant, fuel, transmission, base_price_paise, image_key] of models)
      await insert(connection, 'vehicle_models', {
        brand,
        name,
        variant,
        fuel,
        transmission,
        base_price_paise,
        image_key,
      });
    const catalog = await rows(connection, 'SELECT * FROM vehicle_models ORDER BY name');
    const branches = await rows(connection, 'SELECT * FROM branches ORDER BY name');
    for (let index = 0; index < 54; index++)
      await insert(connection, 'vehicles', {
        vin: `DF2026${String(index + 1).padStart(11, '0')}`,
        model_id: catalog[index % catalog.length].id,
        branch_id: branches[index % branches.length].id,
        color: ['Pearl White', 'Midnight Blue', 'Graphite Grey', 'Ruby Red'][index % 4],
        status: index > 47 ? 'in_transit' : 'available',
        created_at: new Date(Date.now() - (index % 52) * 86400000),
      });
    for (const [index, name] of [
      'Rohan Kapoor',
      'Ananya Reddy',
      'Karthik Iyer',
      'Sneha Desai',
      'Rahul Menon',
      'Isha Patel',
      'Dev Malhotra',
      'Neha Shah',
      'Aarav Sethi',
      'Mira Rao',
      'Arvind Joshi',
      'Pooja Nair',
    ].entries())
      await insert(connection, 'customers', {
        name,
        phone: `98${String(10000000 + index)}`,
        email: `customer${index + 1}@example.test`,
        address: 'Fictional demonstration address, India',
      });
  });
  const sales = await one(pool, "SELECT id FROM employees WHERE role='sales'");
  const manager = await one(pool, "SELECT id FROM employees WHERE role='manager'");
  const vehicles = await rows(
    pool,
    "SELECT id FROM vehicles WHERE status='available' ORDER BY vin LIMIT 18",
  );
  const customers = await rows(pool, 'SELECT id FROM customers ORDER BY name LIMIT 20');
  for (let index = 0; index < 18; index++) {
    const booking = await createBooking(
      {
        customer_id: customers[index % customers.length].id,
        vehicle_id: vehicles[index].id,
        notes: 'Fictional seed transaction',
        booked_at: new Date(Date.now() - (20 - index) * 86400000).toISOString(),
      },
      sales.id,
    );
    if (index > 13) {
      if (index === 17) await cancelBooking(booking.id);
      continue;
    }
    const order = await convertBooking(booking.id, { extras_paise: '2500000', tax_paise: '0' });
    await pool.query('UPDATE orders SET created_at=$2 WHERE id=$1', [
      order.id,
      new Date(Date.now() - (18 - index) * 86400000),
    ]);
    const request = await createPayment(
      order.id,
      { amount_paise: index < 7 ? order.total_paise : (BigInt(order.total_paise) / 3n).toString() },
      sales.id,
    );
    if (index !== 10) {
      await settlePayment(order.id, request.id, manager.id);
      await pool.query('UPDATE payment_requests SET paid_at=$2 WHERE id=$1', [
        request.id,
        new Date(Date.now() - Math.max(0, 12 - index) * 86400000),
      ]);
    }
    if (index === 7) {
      const buffer = Buffer.from('%PDF-1.4\n% Fictional rejected example\n%%EOF');
      const rejected = await uploadDocument(
        order.id,
        'identity',
        {
          originalname: 'fictional-rejected.pdf',
          mimetype: 'application/pdf',
          size: buffer.length,
          buffer,
        } as Express.Multer.File,
        sales.id,
      );
      await reviewDocument(
        order.id,
        rejected.id,
        { status: 'rejected', reason: 'Fictional example: image not readable' },
        manager.id,
      );
    }
    if (index < 5) {
      for (const category of ['identity', 'address']) {
        const buffer = Buffer.from('%PDF-1.4\n% Fictional demonstration document\n%%EOF');
        const document = await uploadDocument(
          order.id,
          category,
          {
            originalname: `fictional-${category}.pdf`,
            mimetype: 'application/pdf',
            size: buffer.length,
            buffer,
          } as Express.Multer.File,
          sales.id,
        );
        await reviewDocument(
          order.id,
          document.id,
          { status: 'verified', reason: 'Fictional demo review only' },
          manager.id,
        );
      }
      if (index < 3) {
        await deliverOrder(order.id, manager.id);
        await pool.query('UPDATE orders SET delivered_at=$2 WHERE id=$1', [
          order.id,
          new Date(Date.now() - (4 - index) * 86400000),
        ]);
      }
    }
  }
  console.info(
    'Fictional seed created. Emails: admin/sales/inventory/manager@dealerflow.demo. Initial password: DEMO_PASSWORD from ignored environment.',
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await seed();
  } finally {
    await pool.end();
  }
}
