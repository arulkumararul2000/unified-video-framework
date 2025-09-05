import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: url });
  try {
    const sql = `UPDATE videos SET currency=$1, price_cents=$2 WHERE video_id=$3`;
    const res = await pool.query(sql, ['INR', 399, 'v1']);
    console.log(`[update-video] rows affected: ${res.rowCount}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[update-video] failed', err);
  process.exit(1);
});

