import React from "react";
import { WebPlayerView } from "unified-video-framework/web";

const CompleteVideoPlayer = () => {
  return (
    <div style={{ 
      margin: 0, 
      padding: 0, 
      width: '100vw', 
      height: '100vh',
      overflow: 'hidden' 
    }}>
      <WebPlayerView
        url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        
        // Free preview duration (30 seconds) - after this time, auth + paywall flow triggers
        freeDuration={30}
        
        // Full viewport responsive configuration
        responsive={{
          enabled: true,
          aspectRatio: 16 / 9,
          maxWidth: '100vw',
          maxHeight: '100vh',
          breakpoints: {
            mobile: 330,
            tablet: 768,
          },
          mobilePortrait: {
            maxHeight: '100vh',
          },
          mobileLandscape: {
            maxHeight: '100vh',
          },
          tablet: {
            maxWidth: '100vw',
            maxHeight: '100vh',
          },
        }}
        
        // Container style to ensure full height
        style={{
          width: '100%',
          height: '100%',
        }}
        
        // ✅ Email Authentication Configuration
        emailAuth={{
          enabled: true,
          skipIfAuthenticated: true,
          apiEndpoints: {
            requestOtp: '/api/auth/request-otp',
            verifyOtp: '/api/auth/verify-otp',
            refreshToken: '/api/auth/refresh-token',
            logout: '/api/auth/logout',
          },
          sessionStorage: {
            tokenKey: 'uvf_session_token',
            refreshTokenKey: 'uvf_refresh_token',
            userIdKey: 'uvf_user_id',
          },
          ui: {
            title: "Sign in to continue watching",
            description: "Enter your email to receive a verification code and unlock premium content",
            emailPlaceholder: "Enter your email address",
            otpPlaceholder: "Enter 6-digit verification code",
            submitButtonText: "Send Code",
            resendButtonText: "Resend Code",
            resendCooldown: 30,
          },
          validation: {
            otpLength: 6,
            otpTimeout: 300, // 5 minutes
            rateLimiting: {
              maxAttempts: 5,
              windowMinutes: 60,
            },
          },
        }}
        
        // ✅ Paywall Configuration (works with email auth)
        paywall={{
          enabled: true,
          apiBase: 'http://localhost:3100',
          userId: 'demo-user-123', // This gets updated automatically after email auth
          videoId: 'big-buck-bunny',
          gateways: ['stripe', 'cashfree'], // ✅ Fixed: array of strings, not objects
          branding: {
            title: 'Unlock Premium Content',
            description: 'Get unlimited access to all videos',
          },
          popup: {
            width: 800,
            height: 600,
          },
        }}
        
        // Player theme
        playerTheme={{
          accent: "#ff6b35",
          accent2: "#ff8c42",
          iconColor: "#ffffff",
          textPrimary: "#ffffff",
          textSecondary: "#cccccc",
          overlayStrong: "rgba(0,0,0,0.95)",
        }}
        
        // Player configuration
        autoPlay={false}
        muted={false}
        enableAdaptiveBitrate={true}
        debug={true} // Enable debug to see console logs
        
        // Event handlers
        onReady={(player) => {
          console.log('🎬 Player is ready:', player);
        }}
        onError={(error) => {
          console.error('❌ Player error:', error);
        }}
      />
    </div>
  );
};

export default CompleteVideoPlayer;

/*
🎯 COMPLETE FLOW EXPLANATION:

🎬 Video Playback Starts
    ↓
❓ Check Authentication State
    ├── ✅ Already Authenticated → Check Entitlements
    └── ❌ Not Authenticated → Show Email Auth Modal
        ↓
📧 Email OTP Flow 
    ├── Step 1: Email Input
    ├── Step 2: OTP Verification (check console for OTP)
    ├── Step 3: Store Session Token
    └── ✅ Authentication Success
        ↓
🎫 Check User Entitlements  
    ├── ✅ Has Access → Resume Playback
    └── ❌ Needs Purchase → Show Paywall
        ↓  
💳 Payment Flow
    ├── Gateway Selection (Stripe/Cashfree)
    ├── Payment Processing
    └── ✅ Purchase Success → Resume Playback

📋 USAGE NOTES:
- After 30 seconds of video, the auth flow will trigger
- Check the console for OTP codes (they'll be logged)
- Email auth session is stored in localStorage
- The flow respects already authenticated users
- Paywall only shows after successful authentication
- All API endpoints are running on localhost:3100

🔧 API ENDPOINTS AVAILABLE:
- POST /api/auth/request-otp (email)
- POST /api/auth/verify-otp (email, otp)  
- POST /api/auth/refresh-token (refreshToken)
- POST /api/auth/logout (sessionToken)
- GET /api/rentals/config
- POST /api/rentals/stripe/checkout-session
- POST /api/rentals/cashfree/order
*/
