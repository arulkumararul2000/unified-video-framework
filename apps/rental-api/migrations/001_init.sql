-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL CHECK (gateway IN ('stripe','pesapal','google_pay')),
  gateway_ref TEXT NOT NULL UNIQUE,
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded','pending','failed','refunded')),
  raw_payload JSONB NOT NULL,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_video ON payments(user_id, video_id);

-- Entitlements (rentals only)
CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type = 'rental'),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','expired')),
  source_payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, video_id, status)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user_video ON entitlements(user_id, video_id);

