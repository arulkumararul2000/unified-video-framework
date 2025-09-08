-- Create database tables for unified video framework

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  price_cents INTEGER DEFAULT 2500,
  currency VARCHAR(3) DEFAULT 'USD',
  rental_duration_hours INTEGER DEFAULT 48,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users table for email authentication
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  gateway VARCHAR(50) NOT NULL,
  gateway_ref VARCHAR(255) NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(50) NOT NULL,
  raw_payload JSONB,
  user_id VARCHAR(255) NOT NULL,
  video_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Entitlements table
CREATE TABLE IF NOT EXISTS entitlements (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  video_id VARCHAR(255) NOT NULL,
  payment_id INTEGER REFERENCES payments(id),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  email VARCHAR(255)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_video ON payments(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_ref ON payments(gateway, gateway_ref);
CREATE INDEX IF NOT EXISTS idx_entitlements_user_video ON entitlements(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_email ON entitlements(email);
CREATE INDEX IF NOT EXISTS idx_entitlements_user_email ON entitlements(user_id, email);

-- Sample data for testing
INSERT INTO videos (video_id, title, price_cents, currency, rental_duration_hours) 
VALUES 
  ('big-buck-bunny', 'Big Buck Bunny - Premium Version', 999, 'USD', 48),
  ('sample-video-1', 'Sample Video 1', 1999, 'USD', 72),
  ('sample-video-2', 'Sample Video 2', 2999, 'USD', 168)
ON CONFLICT (video_id) DO UPDATE SET
  title = EXCLUDED.title,
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  rental_duration_hours = EXCLUDED.rental_duration_hours;
