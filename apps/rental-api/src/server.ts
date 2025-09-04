import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { rentalsRouter } from './routes/rentals.js';
import { stripeWebhookRouter } from './routes/webhooks.js';
import { pesapalRouter } from './routes/pesapal.js';
import { initDb } from './db.js';

const app = express();

// Enable CORS for browser calls from the demo
app.use(cors());

// Stripe webhook must be raw body
app.use('/api/webhooks/stripe', bodyParser.raw({ type: 'application/json' }));

// JSON body for other routes
app.use(bodyParser.json());

app.use('/api/rentals', rentalsRouter);
app.use('/api/webhooks', stripeWebhookRouter);
app.use('/api/ipn', pesapalRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

(async () => {
  try {
    await initDb();
    app.listen(PORT, () => console.log(`[rental-api] listening on :${PORT}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
})();

