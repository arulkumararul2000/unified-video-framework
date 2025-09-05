import { Router, type Request, type Response } from 'express';
import axios from 'axios';
// Pesapal integration removed in favor of Cashfree
import { config } from '../config.js';
import { db } from '../db.js';
import { upsertPayment } from '../services/payments.js';
import { issueRentalEntitlement } from '../services/entitlements.js';
import { randomUUID } from 'crypto';

// export const pesapalRouter = Router();

// POST /api/rentals/pesapal/order { userId, videoId, returnUrl }
/* pesapalRouter.post('/pesapal/order', async (req: Request, res: Response) => {
  const { userId, videoId, returnUrl } = req.body || {};
  if (!userId || !videoId || !returnUrl) return res.status(400).json({ error: 'userId, videoId, returnUrl required' });

  try {
    const token = await pesapalAuthToken();

    const { rows } = await db.query(
      `SELECT price_cents, currency, rental_duration_hours, title FROM videos WHERE video_id=$1`, [videoId]);
    if (!rows[0]) return res.status(404).json({ error: 'Video not found' });

    const { price_cents, currency, rental_duration_hours, title } = rows[0];

    const orderReq = {
      id: randomUUID(),
      currency: (currency || 'USD').toUpperCase(),
      amount: (price_cents / 100).toFixed(2),
      description: `Rent: ${title || videoId}`,
      callback_url: `${config.appBaseUrl}/api/ipn/pesapal/callback`,
      notification_id: 'your-pesapal-ipn-ref',
      billing_address: { email_address: 'customer@example.com' }
    };

    const submit = await axios.post(`${config.pesapal.baseUrl}/api/Transactions/SubmitOrderRequest`,
      orderReq, { headers: { Authorization: `Bearer ${token}` } });

    return res.json({ redirectUrl: submit.data.redirect_url, orderTrackingId: submit.data.order_tracking_id });
  } catch (err) {
    return res.status(500).json({ error: 'failed to create pesapal order' });
  }
}); */

/* async function pesapalAuthToken(): Promise<string> {
  const res = await axios.post(`${config.pesapal.baseUrl}/api/Auth/RequestToken`, {
    consumer_key: config.pesapal.consumerKey,
    consumer_secret: config.pesapal.consumerSecret
  });
  return res.data.token;
}
*/

// Pesapal IPN target: POST /api/ipn/pesapal/callback
/* pesapalRouter.post('/pesapal/callback', async (req: Request, res: Response) => {
  const { order_tracking_id, userId, videoId, rentalDurationHours } = req.body || {};
  if (!order_tracking_id || !userId || !videoId) return res.status(400).send('Bad IPN payload');

  try {
    const token = await pesapalAuthToken();
    const statusRes = await axios.get(
      `${config.pesapal.baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${order_tracking_id}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const status = statusRes.data;

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
  } catch (err) {
    res.status(500).send('IPN handling failed');
  }
}); */

