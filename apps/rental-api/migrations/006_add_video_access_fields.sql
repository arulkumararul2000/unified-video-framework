-- Add is_free field to videos table if not exists
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT FALSE;

-- Update existing demo video to be PPV
UPDATE videos 
SET is_free = FALSE, price_cents = 499 
WHERE video_id = 'big-buck-bunny';

-- Add some test videos with different access types
INSERT INTO videos (video_id, title, price_cents, currency, is_free, rental_duration_hours, created_at)
VALUES 
  ('free-sample-1', 'Free Sample Video', 0, 'USD', TRUE, 48, NOW()),
  ('ppv-movie-1', 'Premium Movie', 999, 'USD', FALSE, 48, NOW())
ON CONFLICT (video_id) DO NOTHING;
