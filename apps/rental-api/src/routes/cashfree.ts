import { Router, type Request, type Response } from 'express';
import axios from 'axios';
import { config } from '../config.js';
import { db } from '../db.js';
import { upsertPayment } from '../services/payments.js';
import { issueRentalEntitlement } from '../services/entitlements.js';
import { randomUUID } from 'crypto';

export const cashfreeRouter = Router();

// POST /api/rentals/cashfree/order { userId, videoId, returnUrl }
cashfreeRouter.post('/cashfree/order', async (req: Request, res: Response) => {
  const { userId, videoId, returnUrl, userEmail, userPhone, userName } = req.body || {};
  if (!userId || !videoId || !returnUrl) return res.status(400).json({ error: 'userId, videoId, returnUrl required' });

  try {
    let price_cents = 0;
    let currency = 'INR';
    let rental_duration_hours = 48;
    let title = videoId;
    try {
      const { rows } = await db.query(`SELECT price_cents, currency, rental_duration_hours, title FROM videos WHERE video_id=$1`, [videoId]);
      if (rows[0]) {
        price_cents = Number(rows[0].price_cents || 0);
        currency = String(rows[0].currency || 'INR');
        rental_duration_hours = Number(rows[0].rental_duration_hours || 48);
        title = String(rows[0].title || videoId);
      } else {
        // Fallback demo price when DB has no record
        price_cents = 2500; // ₹25.00
        currency = 'INR';
        rental_duration_hours = 48;
        title = videoId;
      }
    } catch {
      // Fallback when DB is disabled or not reachable
      price_cents = 2500; // ₹25.00
      currency = 'INR';
      rental_duration_hours = 48;
      title = videoId;
    }

    // Require Cashfree to be configured
    if (!config.cashfree.appId || !config.cashfree.secretKey) {
      return res.status(503).json({ error: 'Cashfree not configured' });
    }

    const orderId = 'cf_' + randomUUID();

    // Ensure HTTPS return_url for live Cashfree (production requires https)
    let safeReturnUrl = String(returnUrl || '').trim();
    try {
      const u = new URL(safeReturnUrl || 'https://example.com/');
      const isLive = /api\.cashfree\.com/i.test(config.cashfree.baseUrl || '');
      if (isLive && u.protocol !== 'https:') {
        u.protocol = 'https:';
      }
      safeReturnUrl = u.toString();
    } catch {
      // Fallback placeholder
      safeReturnUrl = 'https://example.com/';
    }

    const body = {
      order_id: orderId,
      order_amount: (price_cents / 100).toFixed(2),
      order_currency: (currency || 'INR').toUpperCase(),
      customer_details: {
        customer_id: String(userId),
        customer_phone: String(userPhone || '9999999999'),
        customer_email: String(userEmail || 'demo@example.com'),
        customer_name: String(userName || 'Demo User')
      },
      order_meta: {
        return_url: `${safeReturnUrl}${safeReturnUrl.includes('?') ? '&' : '?'}rental=success&popup=1&order_id=${orderId}`
      }
    } as any;

    const base = config.cashfree.baseUrl.replace(/\/$/, '');
    const url = `${base}/pg/orders`;
    const headers = {
      'x-client-id': config.cashfree.appId,
      'x-client-secret': config.cashfree.secretKey,
      'x-api-version': '2022-09-01',
      'Content-Type': 'application/json'
    } as any;

    try { console.log('[cashfree/order] POST', url, JSON.stringify({ ...body, customer_details: { ...body.customer_details, customer_phone: '***' } })); } catch(_) {}
    const resp = await axios.post(url, body, { headers });
    try { console.log('[cashfree/order] resp keys', Object.keys(resp.data || {})); } catch(_) {}
    let paymentLink = resp.data?.payment_link || resp.data?.payment_link_url || resp.data?.payment_url;
    // New PG v2 API returns payment_session_id without a direct link; construct hosted checkout URL
    if (!paymentLink && resp.data?.payment_session_id) {
      const sessionIdRaw = resp.data.payment_session_id;
      const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw : String(sessionIdRaw?.id || sessionIdRaw);
      try { console.log('[cashfree/order] sessionId', sessionId); } catch(_) {}
      const isLive = /api\.cashfree\.com/i.test(config.cashfree.baseUrl || '');
      // Per Cashfree docs, the hosted page is served from payments.cashfree.com (live) or sandbox.cashfree.com
      const host = isLive ? 'https://payments.cashfree.com' : 'https://sandbox.cashfree.com';
      // Hosted checkout path per Cashfree PG v2 docs
      paymentLink = `${host.replace(/\/$/, '')}/pg/view/checkout?payment_session_id=${encodeURIComponent(sessionId)}`;
    }
    if (!paymentLink) {
      try { console.error('[cashfree/order] response missing payment link', typeof resp.data === 'object' ? JSON.stringify(resp.data) : String(resp.data)); } catch(_) {}
      return res.status(500).json({ error: 'cashfree payment link not returned', details: resp.data });
    }
  // Also return sessionId to support JS SDK (Elements/Dropin) integration
  const sessionIdOut = String(resp.data?.payment_session_id || '');
  return res.json({ paymentLink, orderId, sessionId: sessionIdOut, rentalDurationHours: Number(rental_duration_hours || 48), title: title || videoId });
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    try { console.error('[cashfree/order] error', status, typeof data === 'object' ? JSON.stringify(data) : String(data)); } catch (_) {}
    return res.status(500).json({ error: 'failed to create cashfree order', details: { status, data } });
  }
});

// GET /api/rentals/cashfree/verify?orderId=&userId=&videoId=&rentalDurationHours=
cashfreeRouter.get('/cashfree/verify', async (req: Request, res: Response) => {
  const orderId = String(req.query.orderId || '');
  const userId = String(req.query.userId || '');
  const videoId = String(req.query.videoId || '');
  const rentalDurationHours = Number(req.query.rentalDurationHours || 48);
  if (!orderId || !userId || !videoId) return res.status(400).json({ error: 'orderId, userId, videoId required' });

  try {
    const base = config.cashfree.baseUrl.replace(/\/$/, '');
    const url = `${base}/pg/orders/${encodeURIComponent(orderId)}`;
    const headers = {
      'x-client-id': config.cashfree.appId,
      'x-client-secret': config.cashfree.secretKey,
      'x-api-version': '2022-09-01'
    } as any;
    const resp = await axios.get(url, { headers });
    const status = (resp.data?.order_status || '').toUpperCase();
    const amount = Math.round(Number(resp.data?.order_amount || 0) * 100);
    const currency = (resp.data?.order_currency || 'INR').toUpperCase();

    if (status === 'PAID') {
      const pay = await upsertPayment({
        gateway: 'cashfree',
        gatewayRef: orderId,
        amountCents: amount,
        currency,
        status: 'succeeded',
        rawPayload: resp.data,
        userId,
        videoId
      });
      await issueRentalEntitlement({ userId, videoId, paymentId: pay.id, rentalDurationHours });
      return res.json({ ok: true, paid: true });
    }
    return res.json({ ok: true, paid: false, status });
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    try { console.error('[cashfree/verify] error', status, typeof data === 'object' ? JSON.stringify(data) : String(data)); } catch (_) {}
    return res.status(500).json({ error: 'verify failed', details: { status, data } });
  }
});

