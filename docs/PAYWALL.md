# Paywall Integration (Stripe + Cashfree)

This document describes how to enable a dynamic paywall for rental flows across the Web player. It covers free preview gating, in-player paywall overlay (80% modal), popup checkout windows, entitlement polling/verification, and gateway configuration.

## Features
- Free preview limit (freeDuration) enforced locally and during casting
- 80% in-player overlay on preview end showing metadata and a Rent Now CTA
- Gateway selection list rendered dynamically from configuration
- Popup checkout window (not a tab) for Stripe and Cashfree
- Auto-close popup and resume playback on payment success
- Cancel handling: popup closes and overlay returns to gateway list

## Backend Requirements
- Rental API exposes:
  - Stripe: `POST /api/rentals/stripe/checkout-session` (returns { url })
  - Cashfree: `POST /api/rentals/cashfree/order` (returns { paymentLink, orderId })
  - Cashfree verify: `GET /api/rentals/cashfree/verify?orderId=&userId=&videoId=`
- Environment variables:
  - STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
  - CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_BASE_URL (sandbox/live)

## Core Types
```
export interface PaywallConfig {
  enabled: boolean;
  apiBase: string;
  userId: string;
  videoId: string;
  gateways: Array<'stripe' | 'cashfree'>;
  branding?: { title?: string; description?: string; logoUrl?: string; theme?: any };
  popup?: { width?: number; height?: number };
}

export interface PlayerConfig {
  ...
  freeDuration?: number;
  paywall?: PaywallConfig;
}
```

## Web Player Usage
```
import { WebPlayerView } from '@unified-video/web/react';

<WebPlayerView
  url="https://.../movie.m3u8"
  type="hls"
  freeDuration={60}
  paywall={{
    enabled: true,
    apiBase: 'http://localhost:3100',
    userId: 'u1',
    videoId: 'v1',
    gateways: ['stripe','cashfree'],
    branding: { title: 'Continue watching', description: 'Rent to continue watching this video.' },
    popup: { width: 1000, height: 800 }
  }}
/>
```

Or fetch paywall config dynamically per tenant:
```
<WebPlayerView
  url="..."
  freeDuration={60}
  paywallConfigUrl="/api/rentals/config?tenant=acme"
/>
```
`paywallConfigUrl` should return PaywallConfig JSON.

## Stripe
- We open the exact Checkout URL returned from `stripe/checkout-session`.
- successUrl: `.../enhanced-player.html?rental=success&popup=1`
- cancelUrl:  `.../enhanced-player.html?rental=cancel&popup=1`
- The popup page posts `{ type:'uvfCheckout', status:'success|cancel' }` to the opener and closes.
- Entitlement is granted by webhook; the player polls entitlement and resumes on success.

## Cashfree
- We call `cashfree/order` to get `paymentLink` and `orderId`.
- Open `paymentLink` in a popup; on success the return URL includes `?rental=success&popup=1&order_id=...`.
- The popup posts a message with `{ type:'uvfCheckout', status:'success', orderId }` and closes.
- The player verifies via `cashfree/verify` and grants entitlement immediately.

## Styling & Branding
- The overlay uses minimal inline styles for portability. You can pass `branding` and `popup` in `PaywallConfig` for per-tenant customization.

## Removing Pesapal
- Pesapal code is disabled and not wired in the server.
- Demo and shared paywall UI list Stripe and Cashfree only.

## Troubleshooting
- Popup blocked: allow popups for your domain (localhost in dev).
- Stripe “Something went wrong”: never append query params to the Checkout URL; only add `popup=1` to your own return/cancel URLs.
- Entitlement doesn’t resume: ensure webhooks (Stripe) or `cashfree/verify` are reachable; check Rental API logs.

