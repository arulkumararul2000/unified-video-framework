import { Pool } from 'pg';
import { config } from './config.js';

export const db = new Pool({ connectionString: config.dbUrl });

export async function initDb() {
  // Simple connectivity check
  await db.query('SELECT 1');
}

