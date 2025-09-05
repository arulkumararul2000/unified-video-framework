import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config.js';
import { getEntitlement, issueRentalEntitlement } from '../services/entitlements.js';
import { upsertPayment } from '../services/payments.js';
import { db } from '../db.js';

export const rentalsRouter = Router();
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2024-06-20' });

// Simple mock checkout page for local development when Stripe is not configured
rentalsRouter.get('/mock/checkout', async (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/html');
  return res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mock Checkout</title>
  <style>
    body { margin:0; background:#0f0f10; color:#fff; font-family:Arial, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; }
    .card { background:#141416; border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:24px; width: min(520px, 92vw); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
    h1 { margin:0 0 8px; font-size:20px; }
    p { margin:0 0 16px; color: rgba(255,255,255,0.75); }
    .actions { display:flex; gap:12px; }
    button { cursor:pointer; border:none; border-radius:8px; padding:10px 16px; }
    .primary { background:linear-gradient(135deg,#ff4d4f,#d9363e); color:#fff; }
    .secondary { background:rgba(255,255,255,0.12); color:#fff; border:1px solid rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div class="card">
    <h1>Mock Stripe Checkout</h1>
    <p>This is a simulated checkout used for local development.</p>
    <div class="actions">
      <button class="primary" onclick="complete()">Complete Payment</button>
      <button class="secondary" onclick="cancel()">Cancel</button>
    </div>
  </div>
  <script>
    function complete(){ try{ window.opener && window.opener.postMessage({ type: 'uvfCheckout', status: 'success' }, '*'); }catch(e){} window.close(); }
    function cancel(){ try{ window.opener && window.opener.postMessage({ type: 'uvfCheckout', status: 'cancel' }, '*'); }catch(e){} window.close(); }
  </script>
</body>
</html>`);
});

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

  return res.json({ enabled: true, apiBase: config.appBaseUrl, userId, videoId, gateways, branding, popup });
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
      const mockUrl = `${base}/api/rentals/mock/checkout?videoId=${encodeURIComponent(videoId)}&userId=${encodeURIComponent(userId)}&amountCents=${price_cents}&currency=${encodeURIComponent(currency || 'USD')}`;
      return res.json({ url: mockUrl, id: `mock_${Date.now()}` });
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
      // In dev, gracefully fallback to mock checkout if Stripe call fails
      try { console.error('[stripe/checkout-session] error', e?.message || e); } catch (_) {}
      // Do not fallback to mock here; return explicit failure so caller can act accordingly
      return res.status(500).json({ error: 'failed to create checkout session', details: e?.message || String(e) });
    }
  } catch (err) {
    try { console.error('[stripe/checkout-session] db error', err); } catch (_) {}
    return res.status(500).json({ error: 'failed to create checkout session (db)' });
  }
});

