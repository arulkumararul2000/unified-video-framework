# Email OTP Authentication Integration

This document describes the Email OTP authentication flow integration in the unified-video-framework. This feature extends the existing paywall system to include email-based authentication before showing payment options.

## 🎯 Overview

The Email OTP authentication flow provides a secure way to authenticate users before they can access premium content or make payments. It integrates seamlessly with your existing video player and paywall system.

### Key Features

- ✅ **Email-based authentication** with 6-digit OTP codes
- ✅ **Responsive modal UI** that adapts to all screen sizes  
- ✅ **Seamless integration** with existing paywall system
- ✅ **Session management** with automatic token storage
- ✅ **Configurable UI** text and behavior
- ✅ **Rate limiting** and security controls
- ✅ **Auto-skip** for already authenticated users

## 🔄 Authentication Flow

```
🎬 Video Playback Starts
    ↓
❓ Check Authentication State
    ├── ✅ Already Authenticated → Check Entitlements
    └── ❌ Not Authenticated → Show Email Auth Modal
        ↓
📧 Email OTP Flow
    ├── Step 1: Email Input
    ├── Step 2: OTP Verification  
    ├── Step 3: Store Session Token
    └── ✅ Authentication Success
        ↓
🎫 Check User Entitlements  
    ├── ✅ Has Access → Resume Playback
    └── ❌ Needs Purchase → Show Paywall
        ↓  
💳 Payment Flow (Existing - Unchanged)
    ├── Gateway Selection (Stripe/Cashfree)
    ├── Payment Processing
    └── ✅ Purchase Success → Resume Playback
```

## 🚀 Quick Start

### 1. Backend API Requirements

Your backend needs to provide these endpoints:

```typescript
// Request OTP
POST /auth/request-otp
Content-Type: application/json
{
  "email": "user@example.com"
}

// Response
{
  "success": true,
  "message": "OTP sent successfully"
}

// Verify OTP  
POST /auth/verify-otp
Content-Type: application/json
{
  "email": "user@example.com",
  "otp": "123456"
}

// Response
{
  "success": true,
  "data": {
    "sessionToken": "jwt_token_here",
    "refreshToken": "refresh_token_here", 
    "userId": "user123",
    "expiresIn": 3600
  }
}
```

### 2. React Usage

```tsx
import { WebPlayerView } from '@unified-video/web/react';

<WebPlayerView
  url="https://example.com/video.m3u8"
  type="hls"
  freeDuration={60}
  paywall={{
    enabled: true,
    apiBase: 'http://localhost:3100',
    userId: 'temp-user', // Will be replaced after authentication
    videoId: 'video123',
    gateways: ['stripe', 'cashfree'],
    branding: { 
      title: 'Continue watching',
      description: 'Rent to continue watching this video.'
    }
  }}
  emailAuth={{
    enabled: true,
    skipIfAuthenticated: true,
    apiEndpoints: {
      requestOtp: '/auth/request-otp',
      verifyOtp: '/auth/verify-otp',
      logout: '/auth/logout'
    },
    ui: {
      title: 'Sign in to continue',
      description: 'Enter your email to receive a verification code',
      emailPlaceholder: 'Enter your email',
      resendCooldown: 30
    },
    validation: {
      otpLength: 6,
      otpTimeout: 300
    }
  }}
/>
```

### 3. Vanilla JavaScript Usage

```javascript
import { WebPlayer } from '@unified-video/web';

const player = new WebPlayer();

await player.initialize(document.getElementById('player'), {
  autoPlay: false,
  muted: false,
  freeDuration: 60,
  paywall: {
    enabled: true,
    apiBase: 'http://localhost:3100',
    userId: 'temp-user',
    videoId: 'video123',
    gateways: ['stripe', 'cashfree'],
    // Email authentication configuration
    emailAuth: {
      enabled: true,
      skipIfAuthenticated: true,
      sessionStorage: {
        tokenKey: 'uvf_session_token',
        refreshTokenKey: 'uvf_refresh_token',
        userIdKey: 'uvf_user_id'
      },
      api: {
        requestOtp: '/auth/request-otp',
        verifyOtp: '/auth/verify-otp',
        refreshToken: '/auth/refresh-token',
        logout: '/auth/logout'
      },
      ui: {
        title: 'Sign in to continue',
        description: 'Enter your email to receive a verification code',
        emailPlaceholder: 'Enter your email',
        otpPlaceholder: 'Enter 6-digit code',
        submitButtonText: 'Send Code',
        resendButtonText: 'Resend Code',
        resendCooldown: 30
      },
      validation: {
        otpLength: 6,
        otpTimeout: 300,
        rateLimiting: {
          maxAttempts: 5,
          windowMinutes: 60
        }
      }
    }
  }
});

const source = {
  url: 'https://example.com/video.m3u8',
  type: 'hls'
};

await player.load(source);
```

## 📋 Configuration Reference

### EmailAuth Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable email authentication flow |
| `skipIfAuthenticated` | `boolean` | `true` | Skip email auth if user already has valid session |

### API Endpoints

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `requestOtp` | `string` | `/auth/request-otp` | POST endpoint for requesting OTP |
| `verifyOtp` | `string` | `/auth/verify-otp` | POST endpoint for verifying OTP |
| `refreshToken` | `string` | `/auth/refresh-token` | POST endpoint for refreshing token |
| `logout` | `string` | `/auth/logout` | POST endpoint for logout |

### Session Storage

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tokenKey` | `string` | `uvf_session_token` | Key for storing session token |
| `refreshTokenKey` | `string` | `uvf_refresh_token` | Key for storing refresh token |
| `userIdKey` | `string` | `uvf_user_id` | Key for storing user ID |

### UI Customization

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | `string` | `Sign in to continue` | Modal title |
| `description` | `string` | `Enter your email to receive...` | Modal description |
| `emailPlaceholder` | `string` | `Enter your email` | Email input placeholder |
| `otpPlaceholder` | `string` | `Enter 6-digit code` | OTP input placeholder |
| `submitButtonText` | `string` | `Send Code` | Submit button text |
| `resendButtonText` | `string` | `Resend Code` | Resend OTP button text |
| `resendCooldown` | `number` | `30` | Resend cooldown in seconds |

### Validation Settings

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `otpLength` | `number` | `6` | Expected OTP length |
| `otpTimeout` | `number` | `300` | OTP validity timeout in seconds |
| `rateLimiting.maxAttempts` | `number` | `5` | Max OTP requests per hour |
| `rateLimiting.windowMinutes` | `number` | `60` | Rate limiting window |

## 🔐 Security Features

### OTP Security
- **Single Use**: Each OTP can only be used once
- **Time-based Expiry**: OTP expires after configurable timeout (default: 5 minutes)
- **Rate Limiting**: Maximum 5 OTP requests per hour per email
- **Secure Generation**: Backend should generate cryptographically secure 6-digit codes

### Session Management
- **JWT Tokens**: Secure session tokens with expiry
- **Refresh Tokens**: Long-lived tokens for session renewal
- **Automatic Cleanup**: Expired tokens are automatically cleared
- **Secure Storage**: Tokens stored in localStorage with configurable keys

### Input Validation
- **Email Format**: Client-side email validation
- **OTP Format**: Only numeric input accepted for OTP
- **XSS Protection**: All user inputs are sanitized
- **CSRF Protection**: API calls should implement CSRF protection

## 📱 Responsive Design

The email authentication modal is fully responsive and adapts to different screen sizes:

### Mobile Portrait (< 768px width, height > width)
- Full width with padding
- Optimized input sizes
- Touch-friendly buttons
- Readable font sizes

### Mobile Landscape (< 768px width, width > height)  
- Centered modal with max width
- Compact layout
- Easy thumb navigation

### Tablet (768px - 1024px width)
- Balanced modal size
- Comfortable input areas
- Desktop-like experience

### Desktop (> 1024px width)
- Fixed max width modal
- Spacious layout
- Hover effects and animations

## 🎨 UI/UX Features

### Visual Design
- **Dark Theme**: Modern dark interface matching video player
- **Smooth Animations**: Slide-in modal with CSS transitions
- **Loading States**: Spinner during API calls
- **Error Handling**: Clear error messages with styling
- **Success Feedback**: Checkmark animation on successful auth

### Accessibility
- **ARIA Labels**: Proper accessibility attributes
- **Keyboard Navigation**: Full keyboard support
- **Focus Management**: Automatic focus on inputs
- **Screen Reader Support**: Semantic HTML structure

### User Experience
- **Auto-focus**: Inputs are automatically focused
- **Enter Key Support**: Submit forms with Enter key
- **Resend Cooldown**: Visual countdown for resend button
- **Back Navigation**: Easy navigation between steps
- **Cancel Option**: Users can cancel authentication

## 🔧 Advanced Usage

### Custom Styling

You can customize the appearance by overriding CSS variables:

```css
.uvf-auth-modal {
  --auth-bg-color: #1a1a1b;
  --auth-text-color: #ffffff;
  --auth-accent-color: #4f9eff;
  --auth-error-color: #ef4444;
  --auth-success-color: #10b981;
  --auth-border-color: rgba(255, 255, 255, 0.2);
  --auth-input-bg: rgba(255, 255, 255, 0.05);
}
```

### Event Handling

```javascript
// Listen for authentication events
player.on('onFreePreviewEnded', () => {
  console.log('Free preview ended, showing authentication...');
});

// The player automatically handles authentication and paywall flow
// No additional event handlers needed
```

### Session Management

```javascript
// Check authentication status
const paywall = player.paywallController;
const isAuthenticated = paywall?.isAuthenticated();
const userId = paywall?.getAuthenticatedUserId();

// Logout user
await paywall?.logout();
```

## 🧪 Testing

### Test Authentication Flow

1. **Start Video Playback**: Load a video with free preview limit
2. **Wait for Preview End**: Let video reach the free duration limit
3. **Check Auth Modal**: Email authentication modal should appear
4. **Enter Email**: Test with valid email format
5. **Verify OTP**: Enter the OTP received
6. **Check Session**: Verify session token is stored
7. **Test Paywall**: Payment modal should appear after auth success

### Mock Backend for Testing

```javascript
// Simple mock server for testing
app.post('/auth/request-otp', (req, res) => {
  const { email } = req.body;
  console.log(`OTP for ${email}: 123456`);
  res.json({ success: true, message: 'OTP sent successfully' });
});

app.post('/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (otp === '123456') {
    res.json({
      success: true,
      data: {
        sessionToken: 'test_session_token',
        refreshToken: 'test_refresh_token',
        userId: 'test_user_123',
        expiresIn: 3600
      }
    });
  } else {
    res.json({ success: false, message: 'Invalid OTP' });
  }
});
```

## 🐛 Troubleshooting

### Common Issues

**1. Authentication modal doesn't appear**
- Check if `emailAuth.enabled` is set to `true`
- Verify paywall configuration is properly set
- Ensure free preview duration is reached

**2. OTP request fails**
- Verify API endpoint URLs are correct
- Check CORS settings on your backend
- Validate request payload format

**3. Session not persisting**
- Check localStorage permissions
- Verify session storage keys configuration
- Ensure backend returns proper token format

**4. Modal appears even when authenticated**
- Set `skipIfAuthenticated: true`
- Verify session token validation logic
- Check localStorage for existing tokens

### Debug Mode

Enable debug logging:

```javascript
const player = new WebPlayer();
player.initialize(container, {
  debug: true,
  // ... other config
});
```

This will log authentication flow steps to the browser console.

## 🔄 Migration Guide

### From Basic Paywall to Email Auth

If you're currently using the basic paywall system, here's how to add email authentication:

**Before:**
```tsx
<WebPlayerView
  paywall={{
    enabled: true,
    apiBase: 'http://localhost:3100',
    userId: 'user123',
    videoId: 'video123',
    gateways: ['stripe']
  }}
/>
```

**After:**
```tsx
<WebPlayerView
  paywall={{
    enabled: true,
    apiBase: 'http://localhost:3100',
    userId: 'temp-user', // Will be replaced after auth
    videoId: 'video123',
    gateways: ['stripe']
  }}
  emailAuth={{
    enabled: true,
    // ... email auth config
  }}
/>
```

## 📚 API Reference

### EmailAuthController Methods

```typescript
class EmailAuthController {
  // Check if user is authenticated
  isAuthenticated(): boolean

  // Get authenticated user ID
  getAuthenticatedUserId(): string | null

  // Open authentication modal
  openAuthModal(): void

  // Close authentication modal
  closeAuthModal(): void

  // Logout user
  logout(): Promise<void>

  // Cleanup
  destroy(): void
}
```

### PaywallController Methods (Extended)

```typescript
class PaywallController {
  // Existing methods...
  
  // Check authentication status
  isAuthenticated(): boolean
  
  // Get authenticated user ID
  getAuthenticatedUserId(): string | null
  
  // Logout user
  logout(): Promise<void>
}
```

## 🎯 Best Practices

1. **Security**: Always validate OTP on the server side
2. **UX**: Keep OTP timeout reasonable (5-10 minutes)
3. **Rate Limiting**: Implement proper rate limiting to prevent abuse
4. **Error Handling**: Provide clear, actionable error messages
5. **Session Management**: Implement proper token refresh logic
6. **Analytics**: Track authentication success/failure rates
7. **Testing**: Test across different devices and browsers
8. **Accessibility**: Ensure forms are accessible to all users

---

**Integration Status:** ✅ **READY FOR PRODUCTION**

The Email OTP authentication system is fully integrated into your unified-video-framework and ready to use. It seamlessly extends your existing paywall system without any breaking changes.

<citations>
<document>
<document_type>RULE</document_type>
<document_id>OEasg35AjG9GxJZiVVJCVE</document_id>
</document>
<document>
<document_type>RULE</document_type>
<document_id>ViABjMDr1RNG5Oxx0lnVI9</document_id>
</document>
</citations>
