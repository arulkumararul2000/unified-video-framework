// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { VideoSource, SubtitleTrack, VideoMetadata, PlayerConfig } from '@unified-video/core';
import { WebPlayer } from '../WebPlayer';
import EPGOverlay from './components/EPGOverlay';
import type { EPGData, EPGConfig, EPGProgram, EPGProgramRow, EPGAction } from './types/EPGTypes';

export interface WebPlayerViewWithEPGProps {
  // All existing WebPlayerView props
  autoPlay?: boolean;
  muted?: boolean;
  enableAdaptiveBitrate?: boolean;
  debug?: boolean;
  freeDuration?: number;
  paywall?: import('@unified-video/core').PaywallConfig;
  paywallConfigUrl?: string;
  
  emailAuth?: {
    enabled?: boolean;
    skipIfAuthenticated?: boolean;
    apiEndpoints?: {
      requestOtp?: string;
      verifyOtp?: string;
      refreshToken?: string;
      logout?: string;
    };
    sessionStorage?: {
      tokenKey?: string;
      refreshTokenKey?: string;
      userIdKey?: string;
    };
    ui?: {
      title?: string;
      description?: string;
      emailPlaceholder?: string;
      otpPlaceholder?: string;
      submitButtonText?: string;
      resendButtonText?: string;
      resendCooldown?: number;
    };
    validation?: {
      otpLength?: number;
      otpTimeout?: number;
      rateLimiting?: {
        maxAttempts?: number;
        windowMinutes?: number;
      };
    };
  };

  // Video source config
  url: string;
  type?: 'mp4' | 'hls' | 'dash' | 'webm' | 'auto';
  subtitles?: SubtitleTrack[];
  metadata?: VideoMetadata;

  // Optional Google Cast
  cast?: boolean;

  // Styling
  className?: string;
  style?: CSSProperties;
  playerTheme?: string | { accent?: string; accent2?: string; iconColor?: string; textPrimary?: string; textSecondary?: string };

  // Responsive configuration
  responsive?: {
    enabled?: boolean;
    aspectRatio?: number;
    maxWidth?: string;
    maxHeight?: string;
    breakpoints?: {
      mobile?: number;
      tablet?: number;
    };
    mobilePortrait?: {
      maxHeight?: string;
      aspectRatio?: number;
    };
    mobileLandscape?: {
      maxHeight?: string;
      aspectRatio?: number;
    };
    tablet?: {
      maxWidth?: string;
      maxHeight?: string;
    };
  };

  // Callbacks
  onReady?: (player: WebPlayer) => void;
  onError?: (error: unknown) => void;

  // EPG specific props
  epg?: EPGData;
  epgConfig?: Partial<EPGConfig>;
  showEPG?: boolean;
  onToggleEPG?: (visible: boolean) => void;
  
  // EPG action handlers
  onEPGFavorite?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
  onEPGRecord?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
  onEPGSetReminder?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
  onEPGCatchup?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
  onEPGProgramSelect?: (program: EPGProgram, channel: EPGProgramRow) => void;
  onEPGChannelSelect?: (channel: EPGProgramRow) => void;
}

export const WebPlayerViewWithEPG: React.FC<WebPlayerViewWithEPGProps> = (props) => {
  const {
    epg,
    epgConfig,
    showEPG = false,
    onToggleEPG,
    onEPGFavorite,
    onEPGRecord,
    onEPGSetReminder,
    onEPGCatchup,
    onEPGProgramSelect,
    onEPGChannelSelect,
    ...webPlayerProps
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<WebPlayer | null>(null);
  const [epgVisible, setEPGVisible] = useState(showEPG);
  const [playerReady, setPlayerReady] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  // Responsive window resize handler
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const responsiveEnabled = props.responsive?.enabled !== false;
    if (!responsiveEnabled) return;

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [props.responsive?.enabled]);

  // Handle EPG toggle
  const handleToggleEPG = useCallback((visible: boolean) => {
    setEPGVisible(visible);
    if (onToggleEPG) {
      onToggleEPG(visible);
    }
  }, [onToggleEPG]);

  // Toggle EPG visibility with keyboard
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'g' && e.ctrlKey) {
        e.preventDefault();
        handleToggleEPG(!epgVisible);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [epgVisible, handleToggleEPG]);

  // Sync showEPG prop with internal state
  useEffect(() => {
    setEPGVisible(showEPG);
  }, [showEPG]);

  // Calculate player dimensions based on EPG visibility
  const getPlayerDimensions = (): CSSProperties => {
    const responsiveEnabled = props.responsive?.enabled !== false;
    if (!responsiveEnabled) return props.style || {};

    const { width, height } = dimensions;
    
    // Base responsive style
    let calculatedStyle: CSSProperties = {
      width: '100vw',
      height: epgVisible ? '35vh' : '100vh', // 35% when EPG is visible, 100% when hidden
      maxWidth: '100vw',
      maxHeight: epgVisible ? '35vh' : '100vh',
      boxSizing: 'border-box',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: epgVisible ? 50 : 1000, // Lower z-index when EPG is visible
      backgroundColor: '#000000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 0,
      padding: 0,
      transition: 'height 0.3s ease, max-height 0.3s ease',
      ...props.style,
    };

    return calculatedStyle;
  };

  // Checkout return bridge handling
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

  // Initialize player
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
        } catch (_) {}
      }

      // Resolve paywall config
      let paywallCfg = props.paywall as any;
      if (!paywallCfg && props.paywallConfigUrl) {
        try {
          const resp = await fetch(props.paywallConfigUrl);
          if (resp.ok) paywallCfg = await resp.json();
        } catch(_) {}
      }
      
      // Merge email authentication configuration
      if (props.emailAuth?.enabled) {
        if (!paywallCfg) {
          paywallCfg = {
            enabled: true,
            apiBase: 'http://localhost:3000',
            userId: 'user-' + Math.random().toString(36).substr(2, 9),
            videoId: 'video-' + Math.random().toString(36).substr(2, 9),
            gateways: ['stripe'],
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

        // Apply theme
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
        if (!cancelled) {
          setPlayerReady(true);
          props.onReady?.(player);
        }
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
  ]);

  // Update free preview duration at runtime
  useEffect(() => {
    const p = playerRef.current as any;
    if (p && typeof p.setFreeDuration === 'function' && typeof props.freeDuration !== 'undefined') {
      try { p.setFreeDuration(props.freeDuration as number); } catch(_) {}
    }
  }, [props.freeDuration]);

  // Update paywall config at runtime
  useEffect(() => {
    const p = playerRef.current as any;
    if (p && typeof p.setPaywallConfig === 'function' && props.paywall) {
      const paywall = props.paywall as any;
      if (paywall.enabled && (paywall.apiBase || paywall.userId || paywall.videoId)) {
        try { 
          console.log('[WebPlayerViewWithEPG] Updating paywall config:', paywall);
          p.setPaywallConfig(paywall); 
        } catch(err) {
          console.warn('[WebPlayerViewWithEPG] Failed to update paywall config:', err);
        }
      }
    }
  }, [JSON.stringify(props.paywall)]);

  // Respond to theme updates
  useEffect(() => {
    const p = playerRef.current as any;
    try {
      if (p && typeof p.setTheme === 'function') {
        p.setTheme(props.playerTheme as any);
      }
    } catch (_) {}
  }, [JSON.stringify(props.playerTheme)]);

  const playerStyle = getPlayerDimensions();
  
  // Prepare EPG config with action handlers
  const epgConfigWithHandlers = {
    ...epgConfig,
    onFavorite: onEPGFavorite,
    onRecord: onEPGRecord,
    onSetReminder: onEPGSetReminder,
    onCatchup: onEPGCatchup,
    onProgramSelect: onEPGProgramSelect,
    onChannelSelect: onEPGChannelSelect,
  };

  return (
    <div 
      className={`uvf-player-with-epg-container ${props.className || ''}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000',
        zIndex: 50,
      }}
    >
      {/* Video Player */}
      <div 
        ref={containerRef} 
        className={`uvf-responsive-container ${props.className || ''}`}
        style={playerStyle}
      />

      {/* EPG Toggle Button */}
      {epg && playerReady && (
        <button
          onClick={() => handleToggleEPG(!epgVisible)}
          style={{
            position: 'fixed',
            top: epgVisible ? '32vh' : '20px',
            right: '20px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: epgVisible ? '#ff6b35' : 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.3s ease',
            transform: epgVisible ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = `scale(1.1) ${epgVisible ? 'rotate(180deg)' : 'rotate(0deg)'}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = `scale(1) ${epgVisible ? 'rotate(180deg)' : 'rotate(0deg)'}`;
          }}
          title={epgVisible ? 'Hide EPG (Ctrl+G)' : 'Show EPG (Ctrl+G)'}
        >
          📺
        </button>
      )}

      {/* EPG Overlay */}
      {epg && (
        <EPGOverlay
          data={epg}
          config={epgConfigWithHandlers}
          visible={epgVisible}
          onToggle={handleToggleEPG}
        />
      )}

      {/* Instructions Toast */}
      {epg && playerReady && !epgVisible && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            zIndex: 100,
            animation: 'fadeInOut 4s ease-in-out',
            pointerEvents: 'none',
          }}
        >
          Press <strong>Ctrl+G</strong> or click the 📺 button to show the Electronic Program Guide
        </div>
      )}

      <style>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; }
          10%, 90% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default WebPlayerViewWithEPG;