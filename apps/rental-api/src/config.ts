import 'dotenv/config';

export const config = {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  cashfree: {
    appId: process.env.CASHFREE_APP_ID || '',
    secretKey: process.env.CASHFREE_SECRET_KEY || '',
    baseUrl: process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com'
  },
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  dbUrl: process.env.DATABASE_URL || ''
};

