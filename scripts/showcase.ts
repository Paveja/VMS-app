import 'dotenv/config';
export {};
const target = process.env.SHOWCASE_DATABASE_URL;
if (
  !target ||
  target === process.env.DATABASE_URL ||
  !new URL(target).pathname.includes('showcase')
)
  throw new Error('Set a separate SHOWCASE_DATABASE_URL whose database name includes showcase');
process.env.DATABASE_URL = target;
const { migrate } = await import('./migrate.ts');
const { seed } = await import('./seed.ts');
const { pool } = await import('../apps/api/src/lib/db.ts');
try {
  await migrate();
  await seed();
  console.info('Isolated fictional showcase ready; main database untouched');
} finally {
  await pool.end();
}
