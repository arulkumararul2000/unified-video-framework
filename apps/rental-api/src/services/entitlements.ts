import { db } from '../db.js';

export async function getEntitlement(userId: string, videoId: string) {
  const { rows } = await db.query(
    `SELECT * FROM entitlements 
     WHERE user_id=$1 AND video_id=$2 
     ORDER BY created_at DESC LIMIT 1`,
    [userId, videoId]
  );
  if (!rows[0]) return { entitled: false as const };
  const e = rows[0];
  const now = new Date();
  const entitled = new Date(e.expires_at) > now && e.status === 'active';
  return { entitled, expiresAt: e.expires_at };
}

export async function issueRentalEntitlement(args: {
  userId: string; videoId: string; paymentId: string; rentalDurationHours: number;
}) {
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + args.rentalDurationHours * 3600 * 1000);

  await db.query(
    `UPDATE entitlements SET status='expired' 
     WHERE user_id=$1 AND video_id=$2 AND status='active' AND expires_at <= NOW()`,
    [args.userId, args.videoId]
  );

  const { rows } = await db.query(
    `INSERT INTO entitlements (user_id, video_id, type, starts_at, expires_at, status, source_payment_id)
     VALUES ($1,$2,'rental',$3,$4,'active',$5)
     RETURNING *`,
    [args.userId, args.videoId, startsAt.toISOString(), expiresAt.toISOString(), args.paymentId]
  );
  return rows[0];
}

export async function expireEntitlementsForPayment(paymentId: string) {
  await db.query(
    `UPDATE entitlements SET status='expired', expires_at=LEAST(expires_at, NOW())
     WHERE source_payment_id=$1 AND status='active'`,
    [paymentId]
  );
}

