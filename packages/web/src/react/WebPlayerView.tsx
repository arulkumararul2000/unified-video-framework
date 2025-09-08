// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { VideoSource, SubtitleTrack, VideoMetadata, PlayerConfig } from '@unified-video/core';
import { WebPlayer } from '../WebPlayer';

export type WebPlayerViewProps = {
  // Player config
  autoPlay?: boolean;
  muted?: boolean;
  enableAdaptiveBitrate?: boolean;
  debug?: boolean;
  freeDuration?: number;
  // Paywall with Email Authentication
  paywall?: import('@unified-video/core').PaywallConfig;
  paywallConfigUrl?: string; // optional endpoint returning PaywallConfig JSON
  
  // Email Authentication (will be merged into paywall config)
  emailAuth?: {
    enabled?: boolean;                    // Enable email authentication flow
    skipIfAuthenticated?: boolean;       // Skip email auth if user already has valid session (default: true)
    apiEndpoints?: {
      requestOtp?: string;               // POST endpoint for requesting OTP (default: '/auth/request-otp')
      verifyOtp?: string;                // POST endpoint for verifying OTP (default: '/auth/verify-otp')
      refreshToken?: string;             // POST endpoint for refreshing token (default: '/auth/refresh-token')
      logout?: string;                   // POST endpoint for logout (default: '/auth/logout')
    };
    sessionStorage?: {
      tokenKey?: string;                 // Key for storing session token (default: 'uvf_session_token')
      refreshTokenKey?: string;          // Key for storing refresh token (default: 'uvf_refresh_token')
      userIdKey?: string;                // Key for storing user ID (default: 'uvf_user_id')
    };
    ui?: {
      title?: string;                    // Modal title (default: "Sign in to continue")
      description?: string;              // Modal description
      emailPlaceholder?: string;         // Email input placeholder
      otpPlaceholder?: string;           // OTP input placeholder
      submitButtonText?: string;         // Submit button text
      resendButtonText?: string;         // Resend OTP button text
      resendCooldown?: number;           // Resend cooldown in seconds (default: 30)
    };
    validation?: {
      otpLength?: number;                // Expected OTP length (default: 6)
      otpTimeout?: number;               // OTP validity timeout in seconds (default: 300)
      rateLimiting?: {
        maxAttempts?: number;            // Max OTP requests per hour (default: 5)
        windowMinutes?: number;          // Rate limiting window (default: 60)
      };
    };
  };

  // Source config
  url: string;
  type?: 'mp4' | 'hls' | 'dash' | 'webm' | 'auto';
  subtitles?: SubtitleTrack[];
  metadata?: VideoMetadata;

  // Optional Google Cast sender SDK loader
  cast?: boolean;

  // Styling
  className?: string;
  style?: CSSProperties;
  // Dynamic theming: pass a single accent color string or an object with fields
  // { accent, accent2, iconColor, textPrimary, textSecondary }
  playerTheme?: string | { accent?: string; accent2?: string; iconColor?: string; textPrimary?: string; textSecondary?: string };

  // Responsive configuration
  responsive?: {
    enabled?: boolean;                    // Enable/disable responsive behavior (default: true)
    aspectRatio?: number;                // Aspect ratio (width/height) - default: 16/9
    maxWidth?: string;                   // Maximum width for desktop - default: '100%'
    maxHeight?: string;                  // Maximum height - default: '70vh'
    breakpoints?: {                      // Custom breakpoints
      mobile?: number;                   // Mobile breakpoint (default: 768)
      tablet?: number;                   // Tablet breakpoint (default: 1024)
    };
    mobilePortrait?: {                   // Mobile portrait specific settings
      maxHeight?: string;                // Max height in mobile portrait (default: '40vh')
      aspectRatio?: number;              // Custom aspect ratio for mobile portrait
    };
    mobileLandscape?: {                  // Mobile landscape specific settings
      maxHeight?: string;                // Max height in mobile landscape (default: '80vh')
      aspectRatio?: number;              // Custom aspect ratio for mobile landscape
    };
    tablet?: {                          // Tablet specific settings
      maxWidth?: string;                 // Max width for tablets (default: '90%')
      maxHeight?: string;                // Max height for tablets (default: '60vh')
    };
  };

  // Callbacks
  onReady?: (player: WebPlayer) => void;
  onError?: (error: unknown) => void;
};

export const WebPlayerView: React.FC<WebPlayerViewProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<WebPlayer | null>(null);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  // Responsive window resize handler
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Enable responsive by default unless explicitly disabled
    const responsiveEnabled = props.responsive?.enabled !== false;
    if (!responsiveEnabled) return;

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    // Call once immediately to set initial dimensions
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [props.responsive?.enabled]);

  // Calculate responsive dimensions based on current viewport
  const getResponsiveDimensions = (): CSSProperties => {
    // Enable responsive by default unless explicitly disabled
    const responsiveEnabled = props.responsive?.enabled !== false;
    if (!responsiveEnabled) return props.style || {};

    const { width, height } = dimensions;
    const responsive = props.responsive || {};
    
    // Default configuration
    const defaults = {
      aspectRatio: responsive.aspectRatio || 16/9,
      maxWidth: responsive.maxWidth || '100%',
      maxHeight: responsive.maxHeight || '70vh',
      breakpoints: {
        mobile: responsive.breakpoints?.mobile || 768,
        tablet: responsive.breakpoints?.tablet || 1024,
      },
      mobilePortrait: {
        maxHeight: responsive.mobilePortrait?.maxHeight || '50vh', // Increased from 40vh
        aspectRatio: responsive.mobilePortrait?.aspectRatio,
      },
      mobileLandscape: {
        maxHeight: responsive.mobileLandscape?.maxHeight || '85vh', // Increased from 80vh
        aspectRatio: responsive.mobileLandscape?.aspectRatio,
      },
      tablet: {
        maxWidth: responsive.tablet?.maxWidth || '90%',
        maxHeight: responsive.tablet?.maxHeight || '65vh', // Increased from 60vh
      },
    };

    const isMobile = width < defaults.breakpoints.mobile;
    const isTablet = width >= defaults.breakpoints.mobile && width < defaults.breakpoints.tablet;
    const isPortrait = height > width;
    const isLandscape = width > height;

    // Base responsive style
    let calculatedStyle: CSSProperties = {
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative',
      margin: '0 auto',
      ...props.style, // Apply user styles first, then override as needed
    };

    // Mobile Portrait
    if (isMobile && isPortrait) {
      const mobileAspectRatio = defaults.mobilePortrait.aspectRatio || defaults.aspectRatio;
      // Use viewport width to calculate proper height for mobile
      const calculatedHeight = Math.min(
        width / mobileAspectRatio, // Full width divided by aspect ratio
        height * 0.5 // 50% of viewport height max
      );
      calculatedStyle = {
        ...calculatedStyle,
        width: '100vw',
        maxWidth: '100vw',
        height: `${calculatedHeight}px`,
        maxHeight: '50vh',
        minHeight: '200px', // Ensure minimum usable height
        aspectRatio: 'unset', // Let our height calculation take precedence
      };
    }
    // Mobile Landscape
    else if (isMobile && isLandscape) {
      const mobileAspectRatio = defaults.mobileLandscape.aspectRatio || defaults.aspectRatio;
      const calculatedHeight = Math.min(
        width / mobileAspectRatio,
        height * 0.85 // 85% of viewport height
      );
      calculatedStyle = {
        ...calculatedStyle,
        width: '100vw',
        maxWidth: '100vw',
        height: `${calculatedHeight}px`,
        maxHeight: '85vh',
        minHeight: '180px',
        aspectRatio: 'unset', // Let our height calculation take precedence
      };
    }
    // Tablet
    else if (isTablet) {
      const calculatedHeight = Math.min(
        (width * 0.9) / defaults.aspectRatio,
        height * 0.65 // 65% of viewport height max
      );
      calculatedStyle = {
        ...calculatedStyle,
        width: '90vw',
        maxWidth: defaults.tablet.maxWidth,
        height: `${calculatedHeight}px`,
        maxHeight: defaults.tablet.maxHeight,
        minHeight: '250px',
        aspectRatio: 'unset',
      };
    }
    // Desktop
    else {
      calculatedStyle = {
        ...calculatedStyle,
        maxWidth: defaults.maxWidth,
        maxHeight: defaults.maxHeight,
        aspectRatio: `${defaults.aspectRatio}`,
      };
    }

    return calculatedStyle;
  };

  // Checkout return bridge: forward rental=success/cancel with session_id/order_id back to opener and close
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const popup = (params.get('popup') || '').toLowerCase() === '1';
      const status = (params.get('rental') || '').toLowerCase();
      const orderId = params.get('order_id') || '';
      const sessionId = params.get('session_id') || '';
      if (popup && (status === 'success' || status === 'cancel')) {
        try { window.opener?.postMessage({ type: 'uvfCheckout', status, orderId, sessionId }, '*'); } catch (_) {}
        try { window.close(); } catch (_) {}
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!containerRef.current) return;

      const player = new WebPlayer();
      playerRef.current = player;

      // Optionally load Google Cast sender SDK
      if (props.cast) {
        try {
          const existing = document.querySelector('script[data-cast-sdk="1"]');
          if (!existing) {
            const s = document.createElement('script');
            s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
            s.async = true;
            s.setAttribute('data-cast-sdk', '1');
            document.head.appendChild(s);
          }
        } catch (_) {
          // ignore load issues in SSR or restricted environments
        }
      }

      // Resolve paywall config: inline or fetched
      let paywallCfg = props.paywall as any;
      if (!paywallCfg && props.paywallConfigUrl) {
        try {
          const resp = await fetch(props.paywallConfigUrl);
          if (resp.ok) paywallCfg = await resp.json();
        } catch(_) {}
      }
      
      // Merge email authentication configuration with paywall config
      if (props.emailAuth?.enabled) {
        // Ensure paywall config exists if email auth is enabled
        if (!paywallCfg) {
          paywallCfg = {
            enabled: true,
            apiBase: 'http://localhost:3000', // Default API base
            userId: 'user-' + Math.random().toString(36).substr(2, 9), // Generate temp userId
            videoId: 'video-' + Math.random().toString(36).substr(2, 9), // Generate temp videoId
            gateways: ['stripe'], // Default gateway
          };
        }
        
        paywallCfg = {
          ...paywallCfg,
          emailAuth: {
            enabled: props.emailAuth.enabled,
            skipIfAuthenticated: props.emailAuth.skipIfAuthenticated ?? true,
            sessionStorage: {
              tokenKey: props.emailAuth.sessionStorage?.tokenKey || 'uvf_session_token',
              refreshTokenKey: props.emailAuth.sessionStorage?.refreshTokenKey || 'uvf_refresh_token',
              userIdKey: props.emailAuth.sessionStorage?.userIdKey || 'uvf_user_id',
            },
            api: {
              requestOtp: props.emailAuth.apiEndpoints?.requestOtp || '/auth/request-otp',
              verifyOtp: props.emailAuth.apiEndpoints?.verifyOtp || '/auth/verify-otp',
              refreshToken: props.emailAuth.apiEndpoints?.refreshToken || '/auth/refresh-token',
              logout: props.emailAuth.apiEndpoints?.logout || '/auth/logout',
            },
            ui: {
              title: props.emailAuth.ui?.title || 'Sign in to continue',
              description: props.emailAuth.ui?.description || 'Enter your email to receive a verification code',
              emailPlaceholder: props.emailAuth.ui?.emailPlaceholder || 'Enter your email',
              otpPlaceholder: props.emailAuth.ui?.otpPlaceholder || 'Enter 6-digit code',
              submitButtonText: props.emailAuth.ui?.submitButtonText || 'Send Code',
              resendButtonText: props.emailAuth.ui?.resendButtonText || 'Resend Code',
              resendCooldown: props.emailAuth.ui?.resendCooldown || 30,
            },
            validation: {
              otpLength: props.emailAuth.validation?.otpLength || 6,
              otpTimeout: props.emailAuth.validation?.otpTimeout || 300,
              rateLimiting: {
                maxAttempts: props.emailAuth.validation?.rateLimiting?.maxAttempts || 5,
                windowMinutes: props.emailAuth.validation?.rateLimiting?.windowMinutes || 60,
              },
            },
          },
        };
      }

      const config: PlayerConfig = {
        autoPlay: props.autoPlay ?? false,
        muted: props.muted ?? false,
        enableAdaptiveBitrate: props.enableAdaptiveBitrate ?? true,
        debug: props.debug ?? false,
        freeDuration: props.freeDuration,
        paywall: paywallCfg
      };

      try {
        await player.initialize(containerRef.current, config);

        // Apply theme before loading source (so poster and UI show themed styles)
        try {
          if (props.playerTheme && (player as any).setTheme) {
            (player as any).setTheme(props.playerTheme as any);
          }
        } catch (_) {}

        const source: VideoSource = {
          url: props.url,
          type: props.type ?? 'auto',
          subtitles: props.subtitles,
          metadata: props.metadata,
        };

        await player.load(source);
        if (!cancelled) props.onReady?.(player);
      } catch (err) {
        if (!cancelled) props.onError?.(err);
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [
    props.autoPlay,
    props.muted,
    props.enableAdaptiveBitrate,
    props.debug,
    props.url,
    props.type,
    JSON.stringify(props.subtitles),
    JSON.stringify(props.metadata),
    props.cast,
    props.freeDuration,
    JSON.stringify(props.responsive),
    JSON.stringify(props.paywall),
    JSON.stringify(props.emailAuth),
    props.paywallConfigUrl,
  ])

  // Update free preview duration at runtime without full re-init
  useEffect(() => {
    const p = playerRef.current as any;
    if (p && typeof p.setFreeDuration === 'function' && typeof props.freeDuration !== 'undefined') {
      try { p.setFreeDuration(props.freeDuration as number); } catch(_) {}
    }
  }, [props.freeDuration]);

  // Update paywall config at runtime if prop changes
  useEffect(() => {
    const p = playerRef.current as any;
    if (p && typeof p.setPaywallConfig === 'function' && props.paywall) {
      try { p.setPaywallConfig(props.paywall as any); } catch(_) {}
    }
  }, [JSON.stringify(props.paywall)]);

  // Respond to theme updates without reinitializing the player
  useEffect(() => {
    const p = playerRef.current as any;
    try {
      if (p && typeof p.setTheme === 'function') {
        p.setTheme(props.playerTheme as any);
      }
    } catch (_) {}
  }, [JSON.stringify(props.playerTheme)]);

  const responsiveStyle = getResponsiveDimensions();
  
  return (
    <div 
      ref={containerRef} 
      className={`uvf-responsive-container ${props.className || ''}`}
      style={responsiveStyle}
    />
  );
};

export default WebPlayerView;

