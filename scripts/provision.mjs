import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
const root = process.cwd();
const data = path.join(root, '.data/postgres');
const socket = path.join(root, '.data/socket');
const run = (program, args) =>
  execFileSync(program, args, { cwd: root, stdio: 'pipe', encoding: 'utf8' }).trim();
await mkdir(data, { recursive: true });
await mkdir(socket, { recursive: true });
run('sudo', ['-n', 'chown', '-R', 'postgres:postgres', data, socket]);
const binary = run('pg_config', ['--bindir']);
try {
  await access(path.join(data, 'PG_VERSION'));
} catch {
  run('sudo', [
    '-n',
    '-u',
    'postgres',
    `${binary}/initdb`,
    '-D',
    data,
    '--auth-local=trust',
    '--auth-host=scram-sha-256',
    '--encoding=UTF8',
  ]);
}
let env;
try {
  env = await readFile('.env', 'utf8');
} catch {
  const password = randomBytes(24).toString('hex');
  env = `DATABASE_URL=postgresql://dealerflow:${password}@127.0.0.1:5432/dealerflow\nTEST_DATABASE_URL=postgresql://dealerflow:${password}@127.0.0.1:5432/dealerflow_test\nDEMO_PASSWORD=${randomBytes(15).toString('base64url')}\nDOCUMENT_ROOT=.data/documents\n`;
  await writeFile('.env', env, { mode: 0o600 });
}
try {
  run('sudo', ['-n', '-u', 'postgres', `${binary}/pg_ctl`, '-D', data, 'status']);
} catch {
  run('sudo', [
    '-n',
    '-u',
    'postgres',
    `${binary}/pg_ctl`,
    '-D',
    data,
    '-l',
    `${data}/server.log`,
    '-o',
    `-k ${socket} -h 127.0.0.1 -p 5432`,
    '-w',
    'start',
  ]);
}
const connection = env.match(/^DATABASE_URL=(.*)$/m)?.[1];
if (!connection) throw new Error('DATABASE_URL missing');
const url = new URL(connection);
if (url.hostname !== '127.0.0.1') throw new Error('Local provision refuses external DATABASE_URL');
const pg = (query) =>
  run('sudo', [
    '-n',
    '-u',
    'postgres',
    'psql',
    '-h',
    socket,
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-Atc',
    query,
  ]);
if (!pg("SELECT 1 FROM pg_roles WHERE rolname='dealerflow'"))
  pg(
    `CREATE ROLE dealerflow LOGIN PASSWORD '${decodeURIComponent(url.password).replaceAll("'", "''")}'`,
  );
for (const name of ['dealerflow', 'dealerflow_test'])
  if (!pg(`SELECT 1 FROM pg_database WHERE datname='${name}'`))
    pg(`CREATE DATABASE ${name} OWNER dealerflow`);
console.info('Local PostgreSQL ready; generated credentials are in ignored .env (mode 0600).');
