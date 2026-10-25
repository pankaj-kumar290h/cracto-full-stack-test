import { readFile } from 'node:fs/promises';
import { pool } from './db.js';

try {
  await pool.query(await readFile(new URL('./database.sql', import.meta.url), 'utf8'));
  console.log('Database ready.');
} finally {
  await pool.end();
}
