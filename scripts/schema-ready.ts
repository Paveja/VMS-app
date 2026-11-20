import { pool } from '../apps/api/src/lib/db.ts';
try {
  const result = await pool.query(
    "SELECT count(*)::int AS count FROM schema_migrations WHERE name='001_initial.sql'",
  );
  if (result.rows[0].count !== 1) process.exitCode = 1;
} catch {
  process.exitCode = 1;
} finally {
  await pool.end();
}
