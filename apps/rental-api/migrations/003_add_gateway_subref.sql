-- Add gateway_subref to correlate refunds with payments (e.g., Stripe payment_intent)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_subref TEXT;
CREATE INDEX IF NOT EXISTS idx_payments_gateway_subref ON payments(gateway_subref);

