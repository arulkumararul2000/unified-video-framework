import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config.js';
import { getEntitlement, issueRentalEntitlement } from '../services/entitlements.js';
import { upsertPayment } from '../services/payments.js';
import { db } from '../db.js';

export const rentalsRouter = Router();
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2024-06-20' });

// GET /api/rentals/entitlement?userId=&videoId=
rentalsRouter.get('/entitlement', async (req: Request, res: Response) => {
  const userId = String(req.query.userId || '');
  const videoId = String(req.query.videoId || '');
  if (!userId || !videoId) return res.status(400).json({ error: 'userId and videoId required' });

  try {
    const out = await getEntitlement(userId, videoId);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ error: 'entitlement lookup failed' });
  }
});

// POST /api/rentals/mock/grant
// Body: { userId, videoId, rentalDurationHours? }
rentalsRouter.post('/mock/grant', async (req: Request, res: Response) => {
  if (process.env.ENABLE_DEV_MOCKS !== '1' && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'mock endpoint disabled' });
  }
  const { userId, videoId, rentalDurationHours } = req.body || {};
  if (!userId || !videoId) return res.status(400).json({ error: 'userId and videoId required' });
  try {
    const { rows } = await db.query(
      `SELECT price_cents, currency, rental_duration_hours FROM videos WHERE video_id=$1`, [videoId]
    );
    const price_cents = rows[0]?.price_cents ?? 0;
    const currency = rows[0]?.currency ?? 'USD';
    const hours = Number(rentalDurationHours || rows[0]?.rental_duration_hours || 48);

    const pay = await upsertPayment({
      gateway: 'stripe',
      gatewayRef: `mock_${Date.now()}`,
      amountCents: price_cents,
      currency,
      status: 'succeeded',
      rawPayload: { mock: true },
      userId,
      videoId
    });

    const ent = await issueRentalEntitlement({ userId, videoId, paymentId: pay.id, rentalDurationHours: hours });
    return res.json({ ok: true, entitlement: ent });
  } catch (err) {
    return res.status(500).json({ error: 'mock grant failed' });
  }
});

// POST /api/rentals/mock/revoke
// Body: { userId, videoId }
rentalsRouter.post('/mock/revoke', async (req: Request, res: Response) => {
  if (process.env.ENABLE_DEV_MOCKS !== '1' && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'mock endpoint disabled' });
  }
  const { userId, videoId } = req.body || {};
  if (!userId || !videoId) return res.status(400).json({ error: 'userId and videoId required' });
  try {
    await db.query(
      `UPDATE entitlements SET status='expired', expires_at=LEAST(expires_at, NOW())
       WHERE user_id=$1 AND video_id=$2 AND status='active'`, [userId, videoId]
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'mock revoke failed' });
  }
});

// POST /api/rentals/stripe/checkout-session
// Body: { userId, videoId, successUrl, cancelUrl }
rentalsRouter.post('/stripe/checkout-session', async (req: Request, res: Response) => {
  const { userId, videoId, successUrl, cancelUrl } = req.body || {};
  if (!userId || !videoId || !successUrl || !cancelUrl) {
    return res.status(400).json({ error: 'userId, videoId, successUrl, cancelUrl required' });
  }

  try {
    const { rows } = await db.query(
      `SELECT price_cents, currency, rental_duration_hours, title FROM videos WHERE video_id=$1`,
      [videoId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Video not found' });
    const { price_cents, currency, rental_duration_hours, title } = rows[0];

    // Fallback to mock checkout when Stripe key is not configured
    if (!config.stripeSecretKey) {
      const base = (config.appBaseUrl || 'http://localhost:3000').replace(/\/$/, '');
      const mockUrl = `${base}/mock/checkout?videoId=${encodeURIComponent(videoId)}&userId=${encodeURIComponent(userId)}&amountCents=${price_cents}&currency=${encodeURIComponent(currency || 'USD')}`;
      return res.json({ url: mockUrl, id: `mock_${Date.now()}` });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: (currency || 'usd').toLowerCase(),
          unit_amount: price_cents,
          product_data: { name: `Rent: ${title || videoId}` }
        },
        quantity: 1
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId, videoId, rentalDurationHours: String(rental_duration_hours || 48)
      }
    });

    return res.json({ url: session.url, id: session.id });
  } catch (err) {
    return res.status(500).json({ error: 'failed to create checkout session' });
  }
});

