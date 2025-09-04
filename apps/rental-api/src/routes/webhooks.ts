import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config.js';
import { upsertPayment } from '../services/payments.js';
import { issueRentalEntitlement, expireEntitlementsForPayment } from '../services/entitlements.js';
import { db } from '../db.js';

export const stripeWebhookRouter = Router();
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2024-06-20' });

// Stripe requires raw body at server.ts level
stripeWebhookRouter.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).send('Missing signature');

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig as string, config.stripeWebhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const amountCents = session.amount_total ?? 0;
      const currency = (session.currency || 'USD').toUpperCase();
      const userId = session.metadata?.userId || '';
      const videoId = session.metadata?.videoId || '';
      const rentalDurationHours = Number(session.metadata?.rentalDurationHours || 48);

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

      // Store payment_intent as subref for refunds correlation
      const pi = session.payment_intent ? String(session.payment_intent) : null;
      if (pi) {
        await db.query(
          `UPDATE payments SET gateway_subref=$1 WHERE id=$2`,
          [pi, payment.id]
        );
      }

      await issueRentalEntitlement({
        userId, videoId, paymentId: payment.id, rentalDurationHours
      });
    }

    // Handle refunds: charge.refunded
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const pi = charge.payment_intent ? String(charge.payment_intent) : null;
      if (pi) {
        const { rows } = await db.query(
          `SELECT id FROM payments WHERE gateway='stripe' AND gateway_subref=$1 LIMIT 1`,
          [pi]
        );
        if (rows[0]?.id) {
          await expireEntitlementsForPayment(rows[0].id);
        }
      }
    }

    res.status(200).send('ok');
  } catch (err) {
    return res.status(400).send('Webhook signature verification failed');
  }
});

