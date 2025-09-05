import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: url });
  const videoId = process.env.VIDEO_ID || 'v1';
  const cents = Number(process.env.NEW_PRICE_CENTS || 9900); // default ₹99.00
  try {
    const res = await pool.query('UPDATE videos SET price_cents=$1 WHERE video_id=$2', [cents, videoId]);
    console.log(`[update-price] rows affected: ${res.rowCount}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error('[update-price] failed', err); process.exit(1); });

