import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config.js';
import { getEntitlement, issueRentalEntitlement } from '../services/entitlements.js';
import { upsertPayment } from '../services/payments.js';
import { db } from '../db.js';

export const rentalsRouter = Router();
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2024-06-20' });


// POST /api/rentals/stripe/confirm { sessionId }
rentalsRouter.post('/stripe/confirm', async (req: Request, res: Response) => {
  try {
    if (!config.stripeSecretKey) return res.status(400).json({ error: 'stripe not configured' });
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const session = await stripe.checkout.sessions.retrieve(String(sessionId));
    const paid = (session.payment_status === 'paid') || (session.status === 'complete');
    if (!paid) return res.status(400).json({ error: 'not paid', status: session.payment_status || session.status });

    const userId = (session.metadata?.userId || '').toString();
    const videoId = (session.metadata?.videoId || '').toString();
    const rentalDurationHours = Number(session.metadata?.rentalDurationHours || 48);
    if (!userId || !videoId) return res.status(400).json({ error: 'missing metadata on session' });

    const amountCents = session.amount_total ?? 0;
    const currency = (session.currency || 'USD').toUpperCase();

    const payment = await upsertPayment({
      gateway: 'stripe',
      gatewayRef: session.id,
      amountCents: amountCents,
      currency,
      status: 'succeeded',
      rawPayload: session,
      userId,
      videoId
    });

    await issueRentalEntitlement({ userId, videoId, paymentId: payment.id, rentalDurationHours });
    return res.json({ ok: true });
  } catch (err: any) {
    try { console.error('[stripe/confirm] error', err?.message || err); } catch (_) {}
    return res.status(500).json({ error: 'confirm failed', details: err?.message || String(err) });
  }
});

// GET /api/rentals/config?tenant=&userId=&videoId=
// Returns a PaywallConfig JSON for the web player
rentalsRouter.get('/config', async (req: Request, res: Response) => {
  const tenant = String(req.query.tenant || 'demo').toLowerCase();
  const userId = String(req.query.userId || 'u1');
  const videoId = String(req.query.videoId || 'v1');

  // Basic mock mapping: demo tenants get both gateways
  const gateways = ['stripe','cashfree'];
  const branding = { title: 'Continue watching', description: 'Rent to continue watching this video.' };
  const popup = { width: 1000, height: 800 };

  // Always point apiBase to this API's origin so the web demo calls the correct server
  const host = req.get('host') as string;
  const apiBase = `${req.protocol}://${host}`;

  return res.json({ enabled: true, apiBase, userId, videoId, gateways, branding, popup });
});

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

// POST /api/rentals/simulate - Testing endpoint
// Body: { userId, videoId }
rentalsRouter.post('/simulate', async (req: Request, res: Response) => {
  try {
    const { userId, videoId } = req.body || {};
    
    if (!userId || !videoId) {
      return res.status(400).json({ error: 'userId and videoId required' });
    }
    
    // Create a simulated payment record
    const payment = await upsertPayment({
      gateway: 'stripe',
      gatewayRef: `test_${Date.now()}`,
      amountCents: 499, // $4.99
      currency: 'USD',
      status: 'succeeded',
      rawPayload: { test: true },
      userId,
      videoId
    });
    
    // Issue rental entitlement for 48 hours
    await issueRentalEntitlement({ 
      userId, 
      videoId, 
      paymentId: payment.id, 
      rentalDurationHours: 48 
    });
    
    console.log(`[SIMULATE] Created test rental for user ${userId} video ${videoId}`);
    
    return res.json({ 
      success: true, 
      message: 'Test rental created',
      rentalId: payment.id,
      expiresIn: '48 hours'
    });
    
  } catch (error: any) {
    console.error('[SIMULATE] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to simulate rental',
      details: error?.message || String(error)
    });
  }
});

// POST /api/rentals/stripe/checkout-session
// Body: { userId, videoId, successUrl, cancelUrl }
rentalsRouter.post('/stripe/checkout-session', async (req: Request, res: Response) => {
  const { userId, videoId, successUrl, cancelUrl } = req.body || {};
  if (!userId || !videoId || !successUrl || !cancelUrl) {
    return res.status(400).json({ error: 'userId, videoId, successUrl, cancelUrl required' });
  }

  // Require Stripe to be configured
  if (!config.stripeSecretKey) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  // Defaults for demo when DB is disabled or empty
  let price_cents = 2500; // $25.00
  let currency = 'USD';
  let rental_duration_hours = 48;
  let title = videoId as string;

  try {
    const { rows } = await db.query(
      `SELECT price_cents, currency, rental_duration_hours, title FROM videos WHERE video_id=$1`,
      [videoId]
    );
    if (rows[0]) {
      price_cents = Number(rows[0].price_cents ?? price_cents);
      currency = String(rows[0].currency || currency);
      rental_duration_hours = Number(rows[0].rental_duration_hours ?? rental_duration_hours);
      title = String(rows[0].title || title);
    }
  } catch (_) {
    // DB unavailable or disabled: keep defaults
  }

  try {
    // Ensure successUrl carries the Stripe session placeholder so the client can confirm without webhooks
    const successWithSession = `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
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
      success_url: successWithSession,
      cancel_url: cancelUrl,
      metadata: {
        userId, videoId, rentalDurationHours: String(rental_duration_hours || 48)
      }
    });

    return res.json({ url: session.url, id: session.id });
  } catch (e: any) {
    try { console.error('[stripe/checkout-session] error', e?.message || e); } catch (_) {}
    return res.status(500).json({ error: 'failed to create checkout session', details: e?.message || String(e) });
  }
});

