import React from "react";
import { WebPlayerView } from "unified-video-framework/web";

const FinalAuthFlow = () => {
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
        
        // ⏱️ Free duration for authenticated users
        freeDuration={30}
        
        // 📱 Fully responsive player
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
        
        style={{
          width: '100%',
          height: '100%',
        }}
        
        // ✅ EMAIL AUTH: Check token immediately on player render
        emailAuth={{
          enabled: true,
          skipIfAuthenticated: true, // Skip if token already exists & valid
          apiEndpoints: {
            requestOtp: 'http://localhost:3000/api/auth/request-otp',
            verifyOtp: 'http://localhost:3000/api/auth/verify-otp',
            refreshToken: 'http://localhost:3000/api/auth/refresh-token',
            logout: 'http://localhost:3000/api/auth/logout',
          },
          sessionStorage: {
            tokenKey: 'uvf_session_token',
            refreshTokenKey: 'uvf_refresh_token',
            userIdKey: 'uvf_user_id',
          },
          ui: {
            title: "Sign in to watch",
            description: "Enter your email to receive a verification code and start watching",
            emailPlaceholder: "Enter your email address",
            otpPlaceholder: "Enter 6-digit verification code",
            submitButtonText: "Send Code",
            resendButtonText: "Resend Code",
            resendCooldown: 30,
          },
          validation: {
            otpLength: 6,
            otpTimeout: 300,
            rateLimiting: {
              maxAttempts: 5,
              windowMinutes: 60,
            },
          },
        }}
        
        // ✅ PAYWALL: Shows after free duration expires (for authenticated users)
        paywall={{
          enabled: true,
          apiBase: 'http://localhost:3000',
          userId: 'user-placeholder', // Gets updated after auth
          videoId: 'big-buck-bunny',
          gateways: ['stripe', 'cashfree'],
          branding: {
            title: 'Unlock Full Video',
            description: 'Rent this video to continue watching without limits',
          },
          popup: {
            width: 800,
            height: 600,
          },
        }}
        
        // 🎨 Player theme
        playerTheme={{
          accent: "#ff6b35",
          accent2: "#ff8c42",
          iconColor: "#ffffff",
          textPrimary: "#ffffff",
          textSecondary: "#cccccc",
          overlayStrong: "rgba(0,0,0,0.95)",
        }}
        
        // ⚙️ Player configuration
        autoPlay={false}
        muted={false}
        enableAdaptiveBitrate={true}
        debug={true}
        
        // 📊 Event handlers with detailed logging
        onReady={(player) => {
          console.log('🎬 Player ready - flow will now check authentication');
        }}
        onError={(error) => {
          console.error('❌ Player error:', error);
        }}
      />
      
      {/* 🧪 Status indicator */}
      <div style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 999999,
      }}>
        🔐 Auth Flow Active
      </div>
    </div>
  );
};

export default FinalAuthFlow;

/*
✅ IMPLEMENTED FLOW:

🎬 Player Renders
    ↓
🔍 Check Authentication Token (IMMEDIATE)
    ├── ✅ Token EXISTS & Valid
    │   ├── ▶️ Play video with free duration (30s)
    │   └── ⏰ After 30s → Show "Rent Now" + Paywall
    │
    └── ❌ Token MISSING/Invalid  
        ├── 📧 Show Email OTP Modal IMMEDIATELY
        ├── ✅ After login success → Play video with free duration
        └── ⏰ After 30s → Show "Rent Now" + Paywall

🎯 KEY CHANGES:
1. ✅ Auth check happens IMMEDIATELY on player render (not after free duration)
2. ✅ PaywallController.checkAuthenticationOnInit() added
3. ✅ Email auth config merged even when paywall prop is missing
4. ✅ Console logging for debugging the flow

🧪 TESTING:
1. First run: Should show email modal immediately (no token)
2. Enter email → get OTP from console → verify → play 30s → paywall
3. Refresh page: Should play immediately (token exists) → play 30s → paywall
4. Clear localStorage → refresh: Should show email modal again

💾 To clear stored tokens for testing:
localStorage.clear()
*/
