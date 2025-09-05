// Simple migration runner: applies all SQL files in migrations/ in alphabetical order
import 'dotenv/config';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: dbUrl });

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      // Repo layout: apps/rental-api/scripts/run-migration.js -> migrations alongside ../migrations
      resolve(__dirname, '..', 'migrations'),
      // Executed from repo root
      resolve(process.cwd(), 'apps', 'rental-api', 'migrations'),
      // Executed from apps/rental-api
      resolve(process.cwd(), 'migrations')
    ];
    const dir = candidates.find(p => existsSync(p));
    if (!dir) throw new Error('migrations directory not found');

    const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      const sql = readFileSync(join(dir, f), 'utf8');
      process.stdout.write(`[migrate] applying ${f}...\n`);
      await pool.query(sql);
    }
    process.stdout.write('[migrate] done\n');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[migrate] failed', err);
  process.exit(1);
});

