import { Router, type Request, type Response } from 'express';
import { db } from '../db.js';

export const authRouter = Router();

// In-memory OTP store for demo (in production, use Redis or database)
const otpStore = new Map<string, { otp: string; expires: number; attempts: number }>();
const sessionStore = new Map<string, { userId: string; email: string; expires: number }>();

// Generate random OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate session token
function generateSessionToken(): string {
  return 'session_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// POST /auth/request-otp
// Body: { email }
authRouter.post('/request-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        error: 'Valid email address is required',
        code: 'INVALID_EMAIL'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Check rate limiting (max 5 attempts per hour per email)
    const existing = otpStore.get(normalizedEmail);
    if (existing && existing.attempts >= 5) {
      const timeLeft = Math.ceil((existing.expires - Date.now()) / 1000 / 60);
      return res.status(429).json({ 
        error: `Too many attempts. Please try again in ${timeLeft} minutes.`,
        code: 'RATE_LIMITED',
        retryAfter: timeLeft * 60
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expires = Date.now() + (5 * 60 * 1000); // 5 minutes
    const attempts = existing ? existing.attempts + 1 : 1;
    
    // Store OTP
    otpStore.set(normalizedEmail, { otp, expires, attempts });
    
    // In production, send email via SendGrid, AWS SES, etc.
    // For demo, we'll log it to console
    console.log(`[AUTH] OTP for ${normalizedEmail}: ${otp} (expires in 5 minutes)`);
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return res.json({ 
      success: true, 
      message: 'Verification code sent to your email',
      email: normalizedEmail 
    });
    
  } catch (error: any) {
    console.error('[AUTH] request-otp error:', error);
    return res.status(500).json({ 
      error: 'Failed to send verification code',
      code: 'SERVER_ERROR'
    });
  }
});

// POST /auth/verify-otp  
// Body: { email, otp }
authRouter.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body || {};
    
    if (!email || !otp) {
      return res.status(400).json({ 
        error: 'Email and OTP are required',
        code: 'MISSING_FIELDS'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const stored = otpStore.get(normalizedEmail);
    
    if (!stored) {
      return res.status(400).json({ 
        error: 'No verification code found. Please request a new one.',
        code: 'OTP_NOT_FOUND'
      });
    }
    
    if (Date.now() > stored.expires) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({ 
        error: 'Verification code has expired. Please request a new one.',
        code: 'OTP_EXPIRED'
      });
    }
    
    if (stored.otp !== otp.trim()) {
      return res.status(400).json({ 
        error: 'Invalid verification code',
        code: 'OTP_INVALID'
      });
    }
    
    // OTP is valid - create user session
    const userId = 'user_' + Buffer.from(normalizedEmail).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    const sessionToken = generateSessionToken();
    const refreshToken = 'refresh_' + generateSessionToken();
    const sessionExpires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    // Store session
    sessionStore.set(sessionToken, {
      userId,
      email: normalizedEmail,
      expires: sessionExpires
    });
    
    // Store refresh token mapping  
    sessionStore.set(refreshToken, {
      userId,
      email: normalizedEmail,
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    });
    
    // Clean up OTP
    otpStore.delete(normalizedEmail);
    
    // Try to upsert user in database (if available)
    try {
      await db.query(`
        INSERT INTO users (user_id, email, created_at, last_login) 
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (email) 
        DO UPDATE SET last_login = NOW()
      `, [userId, normalizedEmail]);
    } catch (dbError) {
      // DB unavailable - continue without database storage
      console.log('[AUTH] Database unavailable for user storage:', dbError);
    }
    
    console.log(`[AUTH] User authenticated: ${normalizedEmail} -> ${userId}`);
    
    return res.json({
      success: true,
      message: 'Authentication successful',
      userId,
      email: normalizedEmail,
      sessionToken,
      refreshToken,
      expiresIn: 24 * 60 * 60, // seconds
      expiresAt: sessionExpires
    });
    
  } catch (error: any) {
    console.error('[AUTH] verify-otp error:', error);
    return res.status(500).json({ 
      error: 'Verification failed',
      code: 'SERVER_ERROR'
    });
  }
});

// POST /auth/refresh-token
// Body: { refreshToken }
authRouter.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body || {};
    
    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }
    
    const stored = sessionStore.get(refreshToken);
    if (!stored) {
      return res.status(401).json({ 
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
    
    if (Date.now() > stored.expires) {
      sessionStore.delete(refreshToken);
      return res.status(401).json({ 
        error: 'Refresh token has expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }
    
    // Generate new session token
    const newSessionToken = generateSessionToken();
    const sessionExpires = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    
    sessionStore.set(newSessionToken, {
      userId: stored.userId,
      email: stored.email,
      expires: sessionExpires
    });
    
    return res.json({
      success: true,
      userId: stored.userId,
      email: stored.email,
      sessionToken: newSessionToken,
      expiresIn: 24 * 60 * 60,
      expiresAt: sessionExpires
    });
    
  } catch (error: any) {
    console.error('[AUTH] refresh-token error:', error);
    return res.status(500).json({ 
      error: 'Token refresh failed',
      code: 'SERVER_ERROR'
    });
  }
});

// POST /auth/logout
// Body: { sessionToken }
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.body || {};
    
    if (sessionToken) {
      sessionStore.delete(sessionToken);
    }
    
    return res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
    
  } catch (error: any) {
    console.error('[AUTH] logout error:', error);
    return res.status(500).json({ 
      error: 'Logout failed',
      code: 'SERVER_ERROR'
    });
  }
});

// GET /auth/me
// Headers: Authorization: Bearer <sessionToken>
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = authHeader?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ 
        error: 'Session token is required',
        code: 'MISSING_SESSION_TOKEN'
      });
    }
    
    const stored = sessionStore.get(sessionToken);
    if (!stored) {
      return res.status(401).json({ 
        error: 'Invalid session token',
        code: 'INVALID_SESSION_TOKEN'
      });
    }
    
    if (Date.now() > stored.expires) {
      sessionStore.delete(sessionToken);
      return res.status(401).json({ 
        error: 'Session has expired',
        code: 'SESSION_EXPIRED'
      });
    }
    
    return res.json({
      success: true,
      userId: stored.userId,
      email: stored.email,
      expiresAt: stored.expires
    });
    
  } catch (error: any) {
    console.error('[AUTH] me error:', error);
    return res.status(500).json({ 
      error: 'Failed to get user info',
      code: 'SERVER_ERROR'
    });
  }
});

// Middleware to validate session token
export function requireAuth(req: Request, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'MISSING_SESSION_TOKEN'
    });
  }
  
  const stored = sessionStore.get(sessionToken);
  if (!stored || Date.now() > stored.expires) {
    if (stored) sessionStore.delete(sessionToken);
    return res.status(401).json({ 
      error: 'Invalid or expired session',
      code: 'INVALID_SESSION'
    });
  }
  
  // Add user info to request
  (req as any).user = {
    userId: stored.userId,
    email: stored.email
  };
  
  next();
}
