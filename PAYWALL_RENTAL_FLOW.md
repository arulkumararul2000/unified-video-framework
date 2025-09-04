# Paywall Rental Flow (Stripe, Pesapal, Optional Google Pay)

This document describes a complete, production-ready flow to integrate a per-video rental paywall with Stripe, Pesapal, and optionally direct Google Pay. The video player remains payment‑agnostic; your app displays an overlay and unlocks playback after entitlement is confirmed by the backend.


## Step 0) Decisions and prerequisites

- Payments:
  - Stripe (recommended; supports Apple Pay/Google Pay through Payment Request Button or Payment Element).
  - Pesapal (regional support; requires IPN handling and server confirmation).
  - Optional: Direct Google Pay only if not using Stripe for it.
- Entitlements: Per‑video rental with a time window (e.g., 48 hours).
- Keep player internals clean: implement paywall as an overlay in your app and unlock playback when entitled.


## Step 1) Database schema (Payments + Rentals)

Two tables: `payments`, `entitlements` (type='rental'). Example (PostgreSQL):

```sql
-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe','pesapal','google_pay')),
  gateway_ref TEXT NOT NULL UNIQUE, -- e.g. Stripe session.id or PI id, Pesapal orderTrackingId
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded','pending','failed','refunded')),
  raw_payload JSONB NOT NULL,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_user_video ON payments(user_id, video_id);

-- Entitlements (rentals only)
CREATE TABLE entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type = 'rental'),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','expired')),
  source_payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id, status) -- at most one active rental
);

CREATE INDEX idx_entitlements_user_video ON entitlements(user_id, video_id);
```

In your admin “Products/Videos” table, store: `video_id`, `title`, `price_cents`, `currency`, `rental_duration_hours`.


## Step 2) Backend project structure (Node + Express + TypeScript example)

- Directory layout:
  - `src/server.ts`: Express app setup
  - `src/config.ts`: Env loading
  - `src/db.ts`: DB client
  - `src/routes/rentals.ts`: REST endpoints (entitlement checks, Stripe/Pesapal session creation)
  - `src/routes/webhooks.ts`: Stripe webhook
  - `src/routes/pesapal.ts`: Pesapal order + IPN
  - `src/services/payments.ts`: Payment creation/lookup helpers
  - `src/services/entitlements.ts`: Entitlement issue/lookup helpers
- Environment variables (do not log them):
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `PESAPAL_BASE_URL` (sandbox/production)
  - `APP_BASE_URL`
  - `DATABASE_URL`
- Install packages:
  - `stripe`, `express`, `body-parser`, `pg` (or your DB lib), `axios` (Pesapal), `dotenv`, `crypto`


## Step 3) Config and app bootstrap

`src/config.ts`
```ts
import 'dotenv/config';

export const config = {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  pesapal: {
    consumerKey: process.env.PESAPAL_CONSUMER_KEY!,
    consumerSecret: process.env.PESAPAL_CONSUMER_SECRET!,
    baseUrl: process.env.PESAPAL_BASE_URL || 'https://pay.pesapal.com', // or sandbox
  },
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  dbUrl: process.env.DATABASE_URL!,
};
```

`src/server.ts`
```ts
import express from 'express';
import bodyParser from 'body-parser';
import { rentalsRouter } from './routes/rentals';
import { stripeWebhookRouter } from './routes/webhooks';
import { pesapalRouter } from './routes/pesapal';

const app = express();

// Stripe webhook needs raw body for signature verification
app.use('/api/webhooks/stripe', bodyParser.raw({ type: 'application/json' }));
// Other routes use JSON
app.use(bodyParser.json());

app.use('/api/rentals', rentalsRouter);
app.use('/api/webhooks', stripeWebhookRouter);
app.use('/api/ipn', pesapalRouter);

app.listen(3000, () => console.log('API on :3000'));
```


## Step 4) Core services (payments, entitlements)

`src/services/entitlements.ts`
```ts
import { db } from '../db';

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

  // Expire previous active entitlements that are no longer valid (optional guard)
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
```

`src/services/payments.ts`
```ts
import { db } from '../db';

export async function upsertPayment(args: {
  gateway: 'stripe'|'pesapal'|'google_pay',
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
```


## Step 5) Entitlement and Stripe endpoints

`src/routes/rentals.ts`
```ts
import { Router } from 'express';
import Stripe from 'stripe';
import { config } from '../config';
import { getEntitlement } from '../services/entitlements';
import { db } from '../db';

export const rentalsRouter = Router();
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2024-06-20' });

// GET /api/rentals/entitlement?userId=&videoId=
rentalsRouter.get('/entitlement', async (req, res) => {
  const { userId, videoId } = req.query as any;
  if (!userId || !videoId) return res.status(400).json({ error: 'userId and videoId required' });
  const out = await getEntitlement(userId, videoId);
  return res.json(out);
});

// POST /api/rentals/stripe/checkout-session
// Body: { userId, videoId, successUrl, cancelUrl }
rentalsRouter.post('/stripe/checkout-session', async (req, res) => {
  const { userId, videoId, successUrl, cancelUrl } = req.body || {};
  if (!userId || !videoId || !successUrl || !cancelUrl) {
    return res.status(400).json({ error: 'userId, videoId, successUrl, cancelUrl required' });
  }

  // Fetch product/pricing from your DB
  const { rows } = await db.query(
    `SELECT price_cents, currency, rental_duration_hours, title 
     FROM videos WHERE video_id=$1`,
    [videoId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Video not found' });
  const { price_cents, currency, rental_duration_hours, title } = rows[0];

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: currency || 'usd',
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

  // Return url or id for redirect
  return res.json({ url: session.url, id: session.id });
});
```


## Step 6) Stripe webhook: grant rental on success

`src/routes/webhooks.ts`
```ts
import { Router } from 'express';
import Stripe from 'stripe';
import { config } from '../config';
import { upsertPayment } from '../services/payments';
import { issueRentalEntitlement } from '../services/entitlements';

export const stripeWebhookRouter = Router();
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2024-06-20' });

// Stripe requires raw body; configured in server.ts
stripeWebhookRouter.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const amountCents = session.amount_total ?? 0;
    const currency = session.currency?.toUpperCase() || 'USD';
    const userId = session.metadata?.userId || '';
    const videoId = session.metadata?.videoId || '';
    const rentalDurationHours = Number(session.metadata?.rentalDurationHours || 48);

    // Store payment (idempotent by session.id)
    const payment = await upsertPayment({
      gateway: 'stripe',
      gatewayRef: session.id,
      amountCents,
      currency,
      status: 'succeeded',
      rawPayload: session,
      userId,
      videoId
    });

    // Issue rental entitlement
    await issueRentalEntitlement({
      userId, videoId, paymentId: payment.id, rentalDurationHours
    });
  }

  // TODO: handle refunds/chargebacks -> expire entitlement
  res.status(200).send('ok');
});
```


## Step 7) Pesapal integration: order + IPN + confirm

Create order and redirect (or embed in iframe). Confirm status in IPN before granting rental.

`src/routes/pesapal.ts`
```ts
import { Router } from 'express';
import axios from 'axios';
import { config } from '../config';
import { db } from '../db';
import { upsertPayment } from '../services/payments';
import { issueRentalEntitlement } from '../services/entitlements';
import { randomUUID } from 'crypto';

export const pesapalRouter = Router();

// POST /api/rentals/pesapal/order { userId, videoId, returnUrl }
pesapalRouter.post('/pesapal/order', async (req, res) => {
  const { userId, videoId, returnUrl } = req.body || {};
  if (!userId || !videoId || !returnUrl) return res.status(400).json({ error: 'userId, videoId, returnUrl required' });

  const token = await pesapalAuthToken();

  const { rows } = await db.query(
    `SELECT price_cents, currency, rental_duration_hours, title 
     FROM videos WHERE video_id=$1`, [videoId]);
  if (!rows[0]) return res.status(404).json({ error: 'Video not found' });

  const { price_cents, currency, rental_duration_hours, title } = rows[0];

  const orderReq = {
    id: randomUUID(),
    currency: (currency || 'USD').toUpperCase(),
    amount: (price_cents / 100).toFixed(2),
    description: `Rent: ${title || videoId}`,
    callback_url: `${config.appBaseUrl}/api/ipn/pesapal/callback`,
    notification_id: 'your-pesapal-ipn-ref', // configured in Pesapal portal
    billing_address: { email_address: 'customer@example.com' }
  };

  const submit = await axios.post(`${config.pesapal.baseUrl}/api/Transactions/SubmitOrderRequest`,
    orderReq, { headers: { Authorization: `Bearer ${token}` } });

  // Returns redirect_url and order_tracking_id
  return res.json({ redirectUrl: submit.data.redirect_url, orderTrackingId: submit.data.order_tracking_id });
});

async function pesapalAuthToken(): Promise<string> {
  const res = await axios.post(`${config.pesapal.baseUrl}/api/Auth/RequestToken`, {
    consumer_key: config.pesapal.consumerKey,
    consumer_secret: config.pesapal.consumerSecret
  });
  return res.data.token;
}

// Pesapal IPN target: POST /api/ipn/pesapal/callback
pesapalRouter.post('/pesapal/callback', async (req, res) => {
  // Read orderTrackingId from request (adapt to Pesapal IPN payload format)
  const { order_tracking_id, userId, videoId, rentalDurationHours } = req.body || {}; // align based on your mapping
  if (!order_tracking_id || !userId || !videoId) return res.status(400).send('Bad IPN payload');

  // Confirm status with Pesapal before granting
  const token = await pesapalAuthToken();
  const statusRes = await axios.get(
    `${config.pesapal.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${order_tracking_id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const status = statusRes.data; // inspect fields for success

  if (status.payment_status_code === 'COMPLETED' || status.status === 'COMPLETED') {
    const amountCents = Math.round(Number(status.amount) * 100);
    const currency = (status.currency || 'USD').toUpperCase();

    const payment = await upsertPayment({
      gateway: 'pesapal',
      gatewayRef: order_tracking_id,
      amountCents,
      currency,
      status: 'succeeded',
      rawPayload: status,
      userId,
      videoId
    });

    await issueRentalEntitlement({
      userId, videoId, paymentId: payment.id, rentalDurationHours: Number(rentalDurationHours || 48)
    });
  }

  res.status(200).send('ok');
});
```

Notes:
- Align IPN payload mapping (`userId`, `videoId`) by storing them server‑side with `orderTrackingId`, or encode them in a merchant reference you can look up.
- Use sandbox endpoints until production‑ready.


## Step 8) Frontend integration (overlay + polling)

Show overlay if not entitled, and provide buttons to initiate payments. After user completes payment (redirect back or completes in modal), poll entitlement every 2–5 seconds for up to 2 minutes, then unlock playback.

```ts
// pseudo-frontend integration
async function initVideoPage({ userId, videoId }) {
  const ent = await fetchJSON(`/api/rentals/entitlement?userId=${userId}&videoId=${videoId}`);
  await player.initialize(document.getElementById('player'), { autoPlay: ent.entitled });

  if (!ent.entitled) showPaywall();

  // Stripe flow
  document.getElementById('btnStripe').onclick = async () => {
    const { url } = await postJSON('/api/rentals/stripe/checkout-session', {
      userId, videoId,
      successUrl: window.location.href,
      cancelUrl: window.location.href
    });
    window.location.href = url;
  };

  // Pesapal flow
  document.getElementById('btnPesapal').onclick = async () => {
    const { redirectUrl } = await postJSON('/api/rentals/pesapal/order', {
      userId, videoId, returnUrl: window.location.href
    });
    window.open(redirectUrl, '_blank'); // or iframe modal
    await pollEntitlement(userId, videoId);
  };

  // After returning from Stripe success
  if (new URLSearchParams(location.search).get('paid') === '1') {
    await pollEntitlement(userId, videoId);
  }
}

async function pollEntitlement(userId, videoId) {
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const ent = await fetchJSON(`/api/rentals/entitlement?userId=${userId}&videoId=${videoId}`);
    if (ent.entitled) {
      hidePaywall();
      await player.play();
      return true;
    }
    await delay(2000);
  }
  alert('Payment is processing; please try again shortly.');
  return false;
}
```


## Step 9) Recommended: Stripe Payment Request Button (Google Pay via Stripe)

- Instead of separate Google Pay code, enable Google Pay in Stripe and render the Payment Request Button inside your Paywall modal for a one‑click wallet experience. This keeps your flow unified and your backend unchanged (still using Stripe webhooks).
- If you must do direct Google Pay:
  - Use Google Pay API client‑side to obtain a token.
  - POST it to a server endpoint (`/api/rentals/googlepay/charge`) where you charge via your PSP.
  - On success, upsert Payment and issue entitlement (same as other flows).


## Step 10) Security, idempotency, and refunds

- Only grant entitlements from webhooks/IPN after server‑side verification.
- Use idempotency by `gateway_ref` so retries don’t duplicate records.
- On refunds/chargebacks webhooks/IPN, expire rentals (e.g., set `status='expired'` or adjust `expires_at` to `NOW()`).
- Use server time (UTC) for entitlement. Return ISO 8601 to clients.


## Step 11) Testing checklist

- Stripe:
  - Create Checkout Session, complete test payment, verify webhook creates Payment + Entitlement.
  - Verify entitlement query returns true; player plays.
  - Test `?paid=1` redirect path and polling.
- Pesapal (sandbox):
  - Create order, complete test payment, verify IPN hits your endpoint.
  - Confirm status retrieval and entitlement issuance.
- Expiry:
  - Set `rentalDurationHours=0.01` in dev to test expiry logic. Ensure entitlement flips and overlay reappears.


## Next steps / What can be prepared

- A ready‑to‑run Express starter with the above routes wired.
- SQL migrations for Postgres.
- Minimal PaywallModal HTML/CSS/JS for your demo page.
- Stripe Payment Element/Payment Request Button example to support card + wallets inline.

If you confirm your backend stack (Node/Express/TS or something else) and DB (Postgres/MySQL), this template can be tailored and delivered as a drop‑in starter.

