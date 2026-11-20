import { app } from './app.ts';
import { health, pool } from './lib/db.ts';
await health();
const server = app.listen(Number(process.env.API_PORT || 4174), '0.0.0.0', () =>
  console.info('DealerFlow API ready'),
);
async function close() {
  server.close();
  await pool.end();
}
process.on('SIGTERM', close);
process.on('SIGINT', close);
