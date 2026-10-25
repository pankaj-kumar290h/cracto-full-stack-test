import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env before starting the API.');
function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: positiveInteger('DB_POOL_MAX', 10),
  connectionTimeoutMillis: positiveInteger('DB_CONNECT_TIMEOUT_MS', 3000),
  idleTimeoutMillis: positiveInteger('DB_IDLE_TIMEOUT_MS', 30000),
  statement_timeout: positiveInteger('DB_STATEMENT_TIMEOUT_MS', 5000),
});
pool.on('error', (error) => console.error('PostgreSQL connection error:', error.message));
