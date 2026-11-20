import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool, transaction } from '../apps/api/src/lib/db.ts';
export async function migrate() {
  const directory = fileURLToPath(new URL('../apps/api/migrations/', import.meta.url));
  await transaction(async (connection) => {
    await connection.query('SELECT pg_advisory_xact_lock(728194)');
    await connection.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = (await connection.query('SELECT name FROM schema_migrations')).rows.map(
      (row) => row.name,
    );
    for (const name of (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort()) {
      if (applied.includes(name)) continue;
      await connection.query(await readFile(`${directory}/${name}`, 'utf8'));
      await connection.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await migrate();
    console.info('Migrations applied');
  } finally {
    await pool.end();
  }
}
