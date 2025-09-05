-- Seed a demo video so checkout endpoints can resolve price and duration
INSERT INTO videos (video_id, title, price_cents, currency, rental_duration_hours)
VALUES ('v1', 'Demo Video', 199, 'USD', 48)
ON CONFLICT (video_id) DO NOTHING;

