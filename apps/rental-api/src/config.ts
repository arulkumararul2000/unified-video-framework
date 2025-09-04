import 'dotenv/config';

export const config = {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  pesapal: {
    consumerKey: process.env.PESAPAL_CONSUMER_KEY || '',
    consumerSecret: process.env.PESAPAL_CONSUMER_SECRET || '',
    baseUrl: process.env.PESAPAL_BASE_URL || 'https://pay.pesapal.com'
  },
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  dbUrl: process.env.DATABASE_URL || ''
};

