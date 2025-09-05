import { db } from '../db.js';

export async function upsertPayment(args: {
  gateway: 'stripe'|'pesapal'|'google_pay'|'cashfree',
  gatewayRef: string,
  amountCents: number,
  currency: string,
  status: 'succeeded'|'pending'|'failed'|'refunded',
  rawPayload: any,
  userId: string,
  videoId: string
}) {
  const { rows } = await db.query(
    `INSERT INTO payments (gateway,gateway_ref,amount_cents,currency,status,raw_payload,user_id,video_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (gateway_ref) DO UPDATE SET status=EXCLUDED.status, raw_payload=EXCLUDED.raw_payload
     RETURNING *`,
    [args.gateway, args.gatewayRef, args.amountCents, args.currency, args.status, args.rawPayload, args.userId, args.videoId]
  );
  return rows[0];
}

