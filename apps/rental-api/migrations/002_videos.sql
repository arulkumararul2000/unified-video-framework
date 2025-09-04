-- Videos catalog used by the rental API
CREATE TABLE IF NOT EXISTS videos (
  video_id TEXT PRIMARY KEY,
  title TEXT,
  price_cents INT NOT NULL,
  currency TEXT NOT NULL,
  rental_duration_hours INT NOT NULL DEFAULT 48,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

