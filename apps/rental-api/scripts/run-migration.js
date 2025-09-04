// Simple migration runner: applies all SQL files in migrations/ in alphabetical order
import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: dbUrl });

  try {
    const dir = join(process.cwd(), 'apps', 'rental-api', 'migrations');
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

