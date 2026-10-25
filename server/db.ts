import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env before starting the API.');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.on('error', (error) => console.error('PostgreSQL connection error:', error.message));
