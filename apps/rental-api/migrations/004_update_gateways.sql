-- Update payments.gateway check constraint to include 'cashfree' and drop 'pesapal'
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_gateway_check;
ALTER TABLE payments ADD CONSTRAINT payments_gateway_check CHECK (gateway IN ('stripe','cashfree','google_pay'));

