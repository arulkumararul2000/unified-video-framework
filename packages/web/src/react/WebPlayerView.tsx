// @ts-nocheck
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import type { VideoSource, SubtitleTrack, VideoMetadata, PlayerConfig } from '../../core/dist';
import { WebPlayer } from '../WebPlayer';
import { GoogleAdsManager } from '../ads/GoogleAdsManager';
// EPG imports - conditionally loaded
import type { EPGData, EPGConfig, EPGProgram, EPGProgramRow } from './types/EPGTypes';
let EPGOverlay: React.ComponentType<any> | null = null;

// Lazy load EPG components to avoid bundle size impact when not used
const loadEPGComponents = async () => {
  if (!EPGOverlay) {
    try {
      const epgModule = await import('./components/EPGOverlay');
      EPGOverlay = epgModule.default;
    } catch (error) {
      console.warn('Failed to load EPG components:', error);
    }
  }
  return EPGOverlay;
};

// Chapter API interface exposed to parent component
export interface ChapterAPI {
  loadChapters: (chapters: any) => Promise<void>;
  loadChaptersFromUrl: (url: string) => Promise<void>;
  getCurrentSegment: () => any | null;
  skipToSegment: (segmentId: string) => void;
  getSegments: () => any[];
  updateChapterConfig: (config: any) => void;
  hasChapters: () => boolean;
  getChapters: () => any | null;
  getCoreChapters: () => any[];
  getCoreSegments: () => any[];
  getCurrentChapterInfo: () => any | null;
  seekToChapter: (chapterId: string) => void;
  getNextChapter: () => any | null;
  getPreviousChapter: () => any | null;
}

// Quality control API
export interface QualityAPI {
  getQualities: () => any[];
  getCurrentQuality: () => any | null;
  setQuality: (index: number) => void;
  setAutoQuality: (enabled: boolean) => void;
}

// EPG API interface
export interface EPGControlAPI {
  setEPGData: (data: any) => void;
  showEPGButton: () => void;
  hideEPGButton: () => void;
  isEPGButtonVisible: () => boolean;
}

// UI Helper API
export interface UIHelperAPI {
  focusPlayer: () => void;
  showFullscreenTip: () => void;
  triggerFullscreenButton: () => void;
  showTemporaryMessage: (message: string) => void;
  showFullscreenInstructions: () => void;
  enterFullscreenSynchronously: () => void;
}

// Fullscreen API
export interface FullscreenAPI {
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  enterPictureInPicture: () => Promise<void>;
  exitPictureInPicture: () => Promise<void>;
}

// Playback control API
export interface PlaybackAPI {
  play: () => Promise<void>;
  pause: () => void;
  requestPause: () => void;
  seek: (time: number) => void;
  setVolume: (level: number) => void;
  mute: () => void;
  unmute: () => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  getState: () => any;
}

export type WebPlayerViewProps = {
  // Player config
  autoPlay?: boolean;
  muted?: boolean;
  volume?: number;
  controls?: boolean;
  loop?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  crossOrigin?: 'anonymous' | 'use-credentials';
  playsInline?: boolean;
  defaultQuality?: number;
  enableAdaptiveBitrate?: boolean;
  debug?: boolean;
  freeDuration?: number;
  
  // Custom controls configuration
  customControls?: boolean;
  settings?: {
    enabled?: boolean;    // Show settings button (default: true)
    speed?: boolean;      // Show playback speed options (default: true)
    quality?: boolean;    // Show quality options (default: true)
    subtitles?: boolean;  // Show subtitle options (default: true)
  };
  
  // Quality level filtering
  qualityFilter?: {
    allowedHeights?: number[];       // e.g., [720, 1080] - only show these heights
    allowedLabels?: string[];        // e.g., ['720p', '1080p'] - only show these labels
    minHeight?: number;              // e.g., 720 - hide qualities below this
    maxHeight?: number;              // e.g., 1080 - hide qualities above this
  };
  
  // Premium quality levels (pay-to-unlock)
  premiumQualities?: {
    enabled?: boolean;                         // Enable premium quality feature (default: false)
    requiredHeights?: number[];                // Heights that require premium (e.g., [1080, 1440, 2160])
    requiredLabels?: string[];                 // Labels that require premium (e.g., ['1080p', '4K'])
    minPremiumHeight?: number;                 // All qualities >= this require premium (e.g., 1080)
    isPremiumUser?: boolean;                   // Is current user premium? (default: false)
    premiumLabel?: string;                     // Label to show for locked qualities (default: '🔒 Premium')
    onPremiumQualityClick?: (quality: { height: number; label: string }) => void;  // Called when locked quality clicked
    unlockUrl?: string;                        // URL to redirect for unlocking (e.g., '/subscribe')
  };
  
  // Framework branding control
  showFrameworkBranding?: boolean;
  
  // Watermark configuration (can be boolean for simple enable/disable or object for full config)
  watermark?: boolean | {
    enabled?: boolean;
    text?: string;
    showTime?: boolean;
    updateInterval?: number;
    randomPosition?: boolean;
    position?: {
      x?: number | 'left' | 'center' | 'right' | 'random';
      y?: number | 'top' | 'center' | 'bottom' | 'random';
    };
    style?: {
      fontSize?: number;
      fontFamily?: string;
      opacity?: number;
      color?: string;
      gradientColors?: [string, string];
    };
  };
  // Paywall with Email Authentication
  paywall?: import('../../core/dist').PaywallConfig;
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

  // Settings customization
  settingsScrollbar?: {
    style?: 'default' | 'compact' | 'overlay';
    widthPx?: number;
    intensity?: number;
  };
  
  // Auto-focus player on mount
  autoFocusPlayer?: boolean;
  
  // Show fullscreen tip on mount
  showFullscreenTipOnMount?: boolean;
  
  // Player instance ref (for imperative control)
  playerRef?: React.RefObject<WebPlayer>;
  
  // API callbacks - expose imperative APIs to parent
  onChapterAPI?: (api: ChapterAPI) => void;
  onQualityAPI?: (api: QualityAPI) => void;
  onEPGAPI?: (api: EPGControlAPI) => void;
  onUIHelperAPI?: (api: UIHelperAPI) => void;
  onFullscreenAPI?: (api: FullscreenAPI) => void;
  onPlaybackAPI?: (api: PlaybackAPI) => void;
  
  // Callbacks
  onReady?: (player: WebPlayer) => void;
  onError?: (error: unknown) => void;
  
  // Additional player event callbacks
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onTimeUpdate?: (data: { currentTime: number; duration: number }) => void;
  onProgress?: (data: { buffered: number }) => void;
  onVolumeChange?: (data: { volume: number; muted: boolean }) => void;
  onQualityChange?: (quality: any) => void;
  onBuffering?: (isBuffering: boolean) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onPictureInPictureChange?: (isPiP: boolean) => void;

  // EPG (Electronic Program Guide) support
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
  
  // Chapter & Skip Configuration
  chapters?: {
    enabled?: boolean;                    // Enable/disable chapters (default: false)
    data?: {                             // Chapter data
      videoId: string;
      duration: number;
      segments: Array<{
        id: string;
        type: 'intro' | 'recap' | 'content' | 'credits' | 'ad' | 'sponsor' | 'offensive';
        startTime: number;
        endTime: number;
        title: string;
        skipLabel?: string;               // Custom skip button text
        description?: string;
        thumbnail?: string;
        autoSkip?: boolean;               // Enable auto-skip for this segment
        autoSkipDelay?: number;           // Countdown delay in seconds
        metadata?: Record<string, any>;
      }>;
    };
    dataUrl?: string;                    // URL to fetch chapters from API
    autoHide?: boolean;                  // Auto-hide skip button after showing (default: true)  
    autoHideDelay?: number;             // Hide delay in milliseconds (default: 5000)
    showChapterMarkers?: boolean;        // Show progress bar markers (default: true)
    skipButtonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'; // Default: 'bottom-right'
    customStyles?: {                     // Custom styling for skip elements
      skipButton?: {
        backgroundColor?: string;
        borderColor?: string;
        textColor?: string;
        fontSize?: string;
        borderRadius?: string;
        padding?: string;
        fontWeight?: string;
      };
      progressMarkers?: {
        intro?: string;                  // Color for intro markers
        recap?: string;                  // Color for recap markers  
        credits?: string;                // Color for credits markers
        ad?: string;                     // Color for ad markers
      };
    };
    userPreferences?: {                  // User skip preferences
      autoSkipIntro?: boolean;          // Auto-skip intro segments (default: false)
      autoSkipRecap?: boolean;          // Auto-skip recap segments (default: false)  
      autoSkipCredits?: boolean;        // Auto-skip credits segments (default: false)
      showSkipButtons?: boolean;        // Show skip buttons (default: true)
      skipButtonTimeout?: number;       // Button timeout in milliseconds (default: 5000)
      rememberChoices?: boolean;        // Remember user preferences (default: true)
      resumePlaybackAfterSkip?: boolean; // Resume playback after skipping (default: true)
    };
  };

  // Navigation Configuration
  navigation?: {
    backButton?: {
      enabled?: boolean;
      icon?: 'arrow' | 'chevron' | 'custom';     // Icon type
      customIcon?: string;                       // Custom icon URL or SVG string
      title?: string;                            // Button title/tooltip
      ariaLabel?: string;                        // Accessibility label
      onClick?: () => void | Promise<void>;      // Custom click handler
      href?: string;                             // URL to navigate to
      replace?: boolean;                         // Use history.replaceState instead of navigation
    };
    closeButton?: {
      enabled?: boolean;
      icon?: 'x' | 'close' | 'custom';          // Icon type
      customIcon?: string;                       // Custom icon URL or SVG string
      title?: string;                            // Button title/tooltip
      ariaLabel?: string;                        // Accessibility label
      onClick?: () => void | Promise<void>;      // Custom click handler
      exitFullscreen?: boolean;                  // Exit fullscreen when clicked
      closeModal?: boolean;                      // Hide/close player modal when clicked
    };
  };
  
  // Navigation Event Callbacks
  onNavigationBackClicked?: () => void;         // Back button clicked
  onNavigationCloseClicked?: () => void;        // Close button clicked

  // Google Ads Configuration
  googleAds?: {
    adTagUrl: string;                    // VAST/VMAP ad tag URL
    midrollTimes?: number[];            // Mid-roll ad times in seconds [30, 60, 120]
    companionAdSlots?: Array<{          // Companion ad containers
      containerId: string;
      width: number;
      height: number;
    }>;
    onAdStart?: () => void;             // Called when ad starts
    onAdEnd?: () => void;               // Called when ad ends
    onAdError?: (error: any) => void;   // Called on ad error
    onAllAdsComplete?: () => void;      // Called when all ads complete
  };
  
  // Chapter Event Callbacks
  onChapterChange?: (chapter: any) => void;                                    // Core chapter changed
  onSegmentEntered?: (segment: any) => void;                                  // Segment entered  
  onSegmentExited?: (segment: any) => void;                                   // Segment exited
  onSegmentSkipped?: (segment: any) => void;                                  // Segment skipped
  onChapterSegmentEntered?: (data: { segment: any; timestamp: number }) => void;  // Web-specific segment entered
  onChapterSegmentSkipped?: (data: { fromSegment: any; toSegment?: any; timestamp: number }) => void; // Web-specific segment skipped
  onChapterSkipButtonShown?: (data: { segment: any; position: string }) => void;   // Skip button shown
  onChapterSkipButtonHidden?: (data: { segment: any; reason: string }) => void;    // Skip button hidden  
  onChaptersLoaded?: (data: { segmentCount: number; chapters: any[] }) => void;    // Chapters loaded
  onChaptersLoadError?: (data: { error: Error; url?: string }) => void;            // Chapters load error
};

export const WebPlayerView: React.FC<WebPlayerViewProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalPlayerRef = useRef<WebPlayer | null>(null);
  // Use external ref if provided, otherwise use internal
  const playerRef = props.playerRef || internalPlayerRef;
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });
  
  // EPG state
  const [epgVisible, setEPGVisible] = useState(props.showEPG || false);
  const [playerReady, setPlayerReady] = useState(false);
  const [epgComponentLoaded, setEPGComponentLoaded] = useState(false);
  
  // Google Ads state
  const adsManagerRef = useRef<GoogleAdsManager | null>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  
  /**
   * Generate ad chapter segments from googleAds cue points
   * Handles pre-roll (0), mid-rolls, and post-roll (-1)
   */
  const generateAdMarkers = useCallback((cuePoints: number[], videoDuration: number) => {
    if (!cuePoints || cuePoints.length === 0) return [];
    
    return cuePoints.map((time, index) => {
      // Handle special cue point values
      let actualTime = time;
      let title = 'Ad Break';
      
      if (time === 0) {
        // Pre-roll ad at the beginning
        actualTime = 0;
        title = 'Pre-roll Ad';
      } else if (time === -1) {
        // Post-roll ad at the end
        actualTime = videoDuration > 0 ? videoDuration - 0.1 : 0;
        title = 'Post-roll Ad';
      } else {
        // Mid-roll ad at specific time
        title = `Mid-roll Ad ${index + 1}`;
      }
      
      return {
        id: `ad-${index}-${time}`,
        type: 'ad' as const,
        startTime: actualTime,
        endTime: actualTime + 0.1, // Ad markers are instantaneous points
        title,
        skipLabel: 'Skip Ad',
        description: `Advertisement at ${formatAdTime(actualTime)}`,
        autoSkip: false,
        showSkipButton: false,  // Don't show skip button for ads (Google IMA handles this)
        metadata: {
          adBreakIndex: index,
          originalTime: time,
          isPreroll: time === 0,
          isPostroll: time === -1,
          source: 'google-ads',
        },
      };
    });
  }, []);
  
  /**
   * Format time for ad marker labels (MM:SS)
   */
  const formatAdTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  /**
   * Merge ad markers with existing chapter data
   */
  const mergeAdMarkersWithChapters = useCallback((chapters: any, adMarkers: any[], videoDuration: number) => {
    if (adMarkers.length === 0) return chapters;
    
    // Preserve custom styles from chapters prop or use defaults
    const customStyles = chapters?.customStyles || {};
    
    // If no chapters exist, create new chapter data with ad markers
    if (!chapters || !chapters.data) {
      return {
        enabled: true,
        showChapterMarkers: true,
        customStyles,  // Preserve custom styles
        data: {
          videoId: 'auto-generated',
          duration: videoDuration,
          segments: adMarkers,
        },
      };
    }
    
    // Merge ad markers with existing segments
    const existingSegments = chapters.data?.segments || [];
    const allSegments = [...existingSegments, ...adMarkers]
      .sort((a, b) => a.startTime - b.startTime); // Sort by time
    
    return {
      ...chapters,
      enabled: true,
      showChapterMarkers: true,
      customStyles,  // Preserve custom styles
      data: {
        ...chapters.data,
        segments: allSegments,
      },
    };
  }, []);

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

  // EPG toggle handler
  const handleToggleEPG = useCallback((visible: boolean) => {
    setEPGVisible(visible);
    if (props.onToggleEPG) {
      props.onToggleEPG(visible);
    }
  }, [props.onToggleEPG]);

  // Load EPG components when needed
  useEffect(() => {
    if (props.epg && !epgComponentLoaded) {
      console.log('🔄 Loading EPG components...');
      loadEPGComponents().then((component) => {
        console.log('📦 EPG component loaded:', !!component);
        if (component) {
          console.log('✅ Setting epgComponentLoaded to true');
          setEPGComponentLoaded(true);
        } else {
          console.error('❌ EPG component is null');
        }
      }).catch((error) => {
        console.error('❌ Failed to load EPG components:', error);
      });
    }
  }, [props.epg, epgComponentLoaded]);

  // Sync showEPG prop with internal state
  useEffect(() => {
    if (props.showEPG !== undefined) {
      setEPGVisible(props.showEPG);
    }
  }, [props.showEPG]);

  // Toggle EPG visibility with keyboard
  useEffect(() => {
    if (!props.epg) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'g' && e.ctrlKey) {
        e.preventDefault();
        handleToggleEPG(!epgVisible);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [props.epg, epgVisible, handleToggleEPG]);

  // Calculate responsive dimensions based on current viewport
  const getResponsiveDimensions = (): CSSProperties => {
    // Enable responsive by default unless explicitly disabled
    const responsiveEnabled = props.responsive?.enabled !== false;
    if (!responsiveEnabled) return props.style || {};

    const { width, height } = dimensions;
    const responsive = props.responsive || {};
    
    // Default configuration - Fullscreen cinematic experience by default
    const defaults = {
      aspectRatio: responsive.aspectRatio || 16/9,
      maxWidth: responsive.maxWidth || '100vw',
      maxHeight: responsive.maxHeight || '100vh',
      breakpoints: {
        mobile: responsive.breakpoints?.mobile || 768,
        tablet: responsive.breakpoints?.tablet || 1024,
      },
      mobilePortrait: {
        maxHeight: responsive.mobilePortrait?.maxHeight || '100vh', // Full viewport height
        aspectRatio: responsive.mobilePortrait?.aspectRatio,
      },
      mobileLandscape: {
        maxHeight: responsive.mobileLandscape?.maxHeight || '100vh', // Full viewport height
        aspectRatio: responsive.mobileLandscape?.aspectRatio,
      },
      tablet: {
        maxWidth: responsive.tablet?.maxWidth || '100vw',
        maxHeight: responsive.tablet?.maxHeight || '100vh', // Full viewport height
      },
    };

    const isMobile = width < defaults.breakpoints.mobile;
    const isTablet = width >= defaults.breakpoints.mobile && width < defaults.breakpoints.tablet;
    const isPortrait = height > width;
    const isLandscape = width > height;

    // Adjust height based on EPG visibility
    const playerHeight = props.epg && epgVisible ? '35vh' : '100vh';
    const playerMaxHeight = props.epg && epgVisible ? '35vh' : '100vh';
    const playerZIndex = props.epg && epgVisible ? 50 : 1000;
    
    // Base responsive style - Fullscreen cinematic experience
    let calculatedStyle: CSSProperties = {
      width: '100vw',
      height: playerHeight,
      maxWidth: '100vw',
      maxHeight: playerMaxHeight,
      boxSizing: 'border-box',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: playerZIndex,
      backgroundColor: '#000000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: 0,
      padding: 0,
      transition: 'height 0.3s ease, max-height 0.3s ease',
      ...props.style, // Apply user styles first, then override as needed
    };

    // Mobile Portrait - Full viewport
    if (isMobile && isPortrait) {
      calculatedStyle = {
        ...calculatedStyle,
        width: '100vw',
        height: playerHeight,
        maxWidth: '100vw',
        maxHeight: playerMaxHeight,
        position: 'fixed',
        top: 0,
        left: 0,
      };
    }
    // Mobile Landscape - Full viewport
    else if (isMobile && isLandscape) {
      calculatedStyle = {
        ...calculatedStyle,
        width: '100vw',
        height: playerHeight,
        maxWidth: '100vw',
        maxHeight: playerMaxHeight,
        position: 'fixed',
        top: 0,
        left: 0,
      };
    }
    // Tablet - Full viewport
    else if (isTablet) {
      calculatedStyle = {
        ...calculatedStyle,
        width: '100vw',
        height: playerHeight,
        maxWidth: '100vw',
        maxHeight: playerMaxHeight,
        position: 'fixed',
        top: 0,
        left: 0,
      };
    }
    // Desktop - Full viewport cinematic experience
    else {
      calculatedStyle = {
        ...calculatedStyle,
        width: '100vw',
        height: playerHeight,
        maxWidth: '100vw',
        maxHeight: playerMaxHeight,
        position: 'fixed',
        top: 0,
        left: 0,
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
      
      // Expose all APIs to parent component via callbacks
      exposeAPIsToParent(player);

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

      // Normalize watermark config - handle both boolean and object formats
      let watermarkConfig;
      if (typeof props.watermark === 'boolean') {
        watermarkConfig = { enabled: props.watermark };
      } else {
        watermarkConfig = props.watermark;
      }
      
      // Auto-enable chapters if Google Ads is configured (for ad markers)
      let chaptersConfig = props.chapters;
      if (props.googleAds && !chaptersConfig) {
        // Create minimal chapter config to enable ad markers
        chaptersConfig = {
          enabled: true,
          showChapterMarkers: true,
        };
      }
      
      const config: PlayerConfig = {
        autoPlay: props.autoPlay ?? false,
        muted: props.muted ?? false,
        volume: props.volume ?? 1.0,
        controls: props.controls ?? true,
        loop: props.loop ?? false,
        preload: props.preload ?? 'metadata',
        crossOrigin: props.crossOrigin,
        playsInline: props.playsInline ?? true,
        defaultQuality: props.defaultQuality,
        enableAdaptiveBitrate: props.enableAdaptiveBitrate ?? true,
        debug: props.debug ?? false,
        freeDuration: props.freeDuration,
        paywall: paywallCfg,
        customControls: props.customControls,
        settings: props.settings,
        showFrameworkBranding: props.showFrameworkBranding,
        watermark: watermarkConfig,
        qualityFilter: props.qualityFilter,  // Add quality filter to config
        premiumQualities: props.premiumQualities,  // Add premium qualities config
        // Navigation configuration
        navigation: props.navigation,
        // Chapter configuration (auto-enabled for Google Ads markers)
        chapters: chaptersConfig ? {
          enabled: chaptersConfig.enabled ?? (props.googleAds ? true : false),
          data: chaptersConfig.data,
          dataUrl: chaptersConfig.dataUrl,
          autoHide: chaptersConfig.autoHide ?? true,
          autoHideDelay: chaptersConfig.autoHideDelay ?? 5000,
          showChapterMarkers: chaptersConfig.showChapterMarkers ?? true,
          skipButtonPosition: chaptersConfig.skipButtonPosition ?? 'bottom-right',
          customStyles: chaptersConfig.customStyles,
          userPreferences: {
            autoSkipIntro: chaptersConfig.userPreferences?.autoSkipIntro ?? false,
            autoSkipRecap: chaptersConfig.userPreferences?.autoSkipRecap ?? false,
            autoSkipCredits: chaptersConfig.userPreferences?.autoSkipCredits ?? false,
            showSkipButtons: chaptersConfig.userPreferences?.showSkipButtons ?? true,
            skipButtonTimeout: chaptersConfig.userPreferences?.skipButtonTimeout ?? 5000,
            rememberChoices: chaptersConfig.userPreferences?.rememberChoices ?? true,
            resumePlaybackAfterSkip: chaptersConfig.userPreferences?.resumePlaybackAfterSkip ?? true,
          }
        } : { enabled: false }
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
        if (!cancelled) {
          setPlayerReady(true);
          
          // Apply quality filter if provided
          if (props.qualityFilter && typeof (player as any).setQualityFilter === 'function') {
            (player as any).setQualityFilter(props.qualityFilter);
          }
          
          // Apply settings scrollbar configuration if provided
          if (props.settingsScrollbar) {
            applySettingsScrollbar(player, props.settingsScrollbar);
          }
          
          // Auto-focus player if requested
          if (props.autoFocusPlayer && typeof (player as any).focusPlayer === 'function') {
            (player as any).focusPlayer();
          }
          
          // Show fullscreen tip if requested
          if (props.showFullscreenTipOnMount && typeof (player as any).showFullscreenTip === 'function') {
            (player as any).showFullscreenTip();
          }
          
          // Helper function to inject ad markers
          const injectAdMarkersFromTimes = (adTimes: number[]) => {
            if (!adTimes || adTimes.length === 0) return;
            
            const duration = (player as any).getDuration?.() || 0;
            if (duration > 0) {
              const adMarkers = generateAdMarkers(adTimes, duration);
              const mergedChapters = mergeAdMarkersWithChapters(props.chapters, adMarkers, duration);
              
              // Inject ad markers into the chapter system
              if (typeof (player as any).loadChapters === 'function' && mergedChapters.data) {
                (player as any).loadChapters(mergedChapters.data);
                console.log('✅ Ad markers injected:', adMarkers.length, 'markers at times:', adTimes);
              }
            }
          };
          
          // Generate and inject ad markers if Google Ads is configured
          if (props.googleAds) {
            const videoDuration = (player as any).getDuration?.() || 0;
            
            // If midrollTimes are explicitly provided, use them immediately
            if (props.googleAds.midrollTimes && props.googleAds.midrollTimes.length > 0) {
              const injectAdMarkers = () => {
                injectAdMarkersFromTimes(props.googleAds!.midrollTimes!);
              };
              
              // Try immediately first
              if (videoDuration > 0) {
                injectAdMarkers();
              } else {
                // Otherwise wait for loadedmetadata event
                const videoElement = (player as any).video || (player as any).getVideoElement?.();
                if (videoElement) {
                  videoElement.addEventListener('loadedmetadata', injectAdMarkers, { once: true });
                }
              }
            }
            // If no midrollTimes, markers will be injected when ad manager reports cue points
            // (handled in Google Ads initialization below)
          }
          
          // Set up EPG integration
          if (props.epg && typeof (player as any).setEPGData === 'function') {
            (player as any).setEPGData(props.epg);
          }
          
          // Listen for EPG toggle events from the player controls
          if (typeof (player as any).on === 'function') {
            (player as any).on('epgToggle', () => {
              handleToggleEPG(!epgVisible);
            });
          }
          
          // Chapter event listeners
          if (props.onChapterChange && typeof (player as any).on === 'function') {
            (player as any).on('chapterchange', props.onChapterChange);
          }
          if (props.onSegmentEntered && typeof (player as any).on === 'function') {
            (player as any).on('segmententered', props.onSegmentEntered);
          }
          if (props.onSegmentExited && typeof (player as any).on === 'function') {
            (player as any).on('segmentexited', props.onSegmentExited);
          }
          if (props.onSegmentSkipped && typeof (player as any).on === 'function') {
            (player as any).on('segmentskipped', props.onSegmentSkipped);
          }
          if (props.onChapterSegmentEntered && typeof (player as any).on === 'function') {
            (player as any).on('chapterSegmentEntered', props.onChapterSegmentEntered);
          }
          if (props.onChapterSegmentSkipped && typeof (player as any).on === 'function') {
            (player as any).on('chapterSegmentSkipped', props.onChapterSegmentSkipped);
          }
          if (props.onChapterSkipButtonShown && typeof (player as any).on === 'function') {
            (player as any).on('chapterSkipButtonShown', props.onChapterSkipButtonShown);
          }
          if (props.onChapterSkipButtonHidden && typeof (player as any).on === 'function') {
            (player as any).on('chapterSkipButtonHidden', props.onChapterSkipButtonHidden);
          }
          if (props.onChaptersLoaded && typeof (player as any).on === 'function') {
            (player as any).on('chaptersLoaded', props.onChaptersLoaded);
          }
          if (props.onChaptersLoadError && typeof (player as any).on === 'function') {
            (player as any).on('chaptersLoadError', props.onChaptersLoadError);
          }
          
          // Navigation event listeners
          if (props.onNavigationBackClicked && typeof (player as any).on === 'function') {
            (player as any).on('navigationBackClicked', props.onNavigationBackClicked);
          }
          if (props.onNavigationCloseClicked && typeof (player as any).on === 'function') {
            (player as any).on('navigationCloseClicked', props.onNavigationCloseClicked);
          }
          
          // Additional event listeners
          if (props.onPlay && typeof (player as any).on === 'function') {
            (player as any).on('onPlay', props.onPlay);
          }
          if (props.onPause && typeof (player as any).on === 'function') {
            (player as any).on('onPause', props.onPause);
          }
          if (props.onEnded && typeof (player as any).on === 'function') {
            (player as any).on('onEnded', props.onEnded);
          }
          if (props.onTimeUpdate && typeof (player as any).on === 'function') {
            (player as any).on('onTimeUpdate', (currentTime: number) => {
              props.onTimeUpdate?.({ 
                currentTime, 
                duration: (player as any).getDuration ? (player as any).getDuration() : 0 
              });
            });
          }
          if (props.onProgress && typeof (player as any).on === 'function') {
            (player as any).on('onProgress', (buffered: number) => {
              props.onProgress?.({ buffered });
            });
          }
          if (props.onVolumeChange && typeof (player as any).on === 'function') {
            (player as any).on('onVolumeChanged', (volume: number) => {
              const state = (player as any).getState ? (player as any).getState() : {};
              props.onVolumeChange?.({ volume, muted: state.isMuted || false });
            });
          }
          if (props.onQualityChange && typeof (player as any).on === 'function') {
            (player as any).on('onQualityChanged', props.onQualityChange);
          }
          if (props.onBuffering && typeof (player as any).on === 'function') {
            (player as any).on('onBuffering', props.onBuffering);
          }
          if (props.onFullscreenChange && typeof (player as any).on === 'function') {
            (player as any).on('onFullscreenChanged', props.onFullscreenChange);
          }
          if (props.onPictureInPictureChange && typeof (player as any).on === 'function') {
            (player as any).on('onPictureInPicturechange', props.onPictureInPictureChange);
          }
          
          // Initialize Google Ads if configured
          if (props.googleAds) {
            // Small delay to ensure ad container is properly mounted in DOM
            setTimeout(async () => {
              try {
                const adContainer = adContainerRef.current;
                const videoElement = (player as any).video || (player as any).getVideoElement?.();
                
                // Validate both elements exist and are in the DOM
                if (!adContainer) {
                  console.warn('Ad container element not found');
                  return;
                }
                
                if (!videoElement) {
                  console.warn('Video element not found');
                  return;
                }
                
                if (!document.body.contains(adContainer)) {
                  console.warn('Ad container not attached to DOM');
                  return;
                }
                
                console.log('Initializing Google Ads...', { adContainer, videoElement });
                
                const adsManager = new GoogleAdsManager(
                  videoElement,
                  adContainer,
                  {
                    adTagUrl: props.googleAds.adTagUrl,
                    midrollTimes: props.googleAds.midrollTimes,
                    companionAdSlots: props.googleAds.companionAdSlots,
                    onAdStart: () => {
                      setIsAdPlaying(true);
                      props.googleAds?.onAdStart?.();
                    },
                    onAdEnd: () => {
                      setIsAdPlaying(false);
                      props.googleAds?.onAdEnd?.();
                    },
                    onAdError: (error) => {
                      setIsAdPlaying(false);
                      props.googleAds?.onAdError?.(error);
                    },
                    onAllAdsComplete: () => {
                      setIsAdPlaying(false);
                      props.googleAds?.onAllAdsComplete?.();
                    },
                    onAdCuePoints: (cuePoints: number[]) => {
                      // Inject markers from VMAP cue points (if midrollTimes not provided)
                      if (!props.googleAds?.midrollTimes || props.googleAds.midrollTimes.length === 0) {
                        console.log('🔵 Using VMAP cue points for ad markers:', cuePoints);
                        injectAdMarkersFromTimes(cuePoints);
                      }
                    },
                  }
                );
                
                await adsManager.initialize();
                adsManagerRef.current = adsManager;
                
                console.log('Google Ads initialized successfully');
                
                // Initialize ad display container on first play
                const handleFirstPlay = () => {
                  if (adsManagerRef.current) {
                    adsManagerRef.current.initAdDisplayContainer();
                    adsManagerRef.current.requestAds();
                  }
                  videoElement.removeEventListener('play', handleFirstPlay);
                };
                videoElement.addEventListener('play', handleFirstPlay, { once: true });
              } catch (adsError) {
                console.error('Failed to initialize Google Ads:', adsError);
                props.googleAds?.onAdError?.(adsError);
              }
            }, 100); // Small delay to ensure DOM is ready
          }
          
          props.onReady?.(player);
        }
      } catch (err) {
        if (!cancelled) props.onError?.(err);
      }
    }

    void boot();

    return () => {
      cancelled = true;
      
      // Cleanup ads manager
      if (adsManagerRef.current) {
        adsManagerRef.current.destroy();
        adsManagerRef.current = null;
      }
      
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [
    props.autoPlay,
    props.muted,
    props.volume,
    props.controls,
    props.loop,
    props.preload,
    props.crossOrigin,
    props.playsInline,
    props.defaultQuality,
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
    props.customControls,
    JSON.stringify(props.settings),
    props.showFrameworkBranding,
    JSON.stringify(props.watermark),
    JSON.stringify(props.navigation),
    JSON.stringify(props.googleAds),
    JSON.stringify(props.qualityFilter),
    JSON.stringify(props.premiumQualities),
  ]);
  
  // Helper function to filter quality levels based on qualityFilter prop
  const filterQualities = useCallback((qualities: any[]) => {
    if (!props.qualityFilter || qualities.length === 0) {
      return qualities;
    }
    
    const filter = props.qualityFilter;
    let filtered = [...qualities];
    
    // Filter by allowed heights
    if (filter.allowedHeights && filter.allowedHeights.length > 0) {
      filtered = filtered.filter(q => filter.allowedHeights!.includes(q.height));
    }
    
    // Filter by allowed labels
    if (filter.allowedLabels && filter.allowedLabels.length > 0) {
      filtered = filtered.filter(q => filter.allowedLabels!.includes(q.label));
    }
    
    // Filter by minimum height
    if (filter.minHeight !== undefined) {
      filtered = filtered.filter(q => q.height >= filter.minHeight!);
    }
    
    // Filter by maximum height
    if (filter.maxHeight !== undefined) {
      filtered = filtered.filter(q => q.height <= filter.maxHeight!);
    }
    
    return filtered;
  }, [props.qualityFilter]);
  
  // Helper function to expose all APIs to parent
  const exposeAPIsToParent = useCallback((player: WebPlayer) => {
    const p = player as any;
    
    // Chapter API
    if (props.onChapterAPI) {
      const chapterAPI: ChapterAPI = {
        loadChapters: (chapters: any) => p.loadChapters ? p.loadChapters(chapters) : Promise.resolve(),
        loadChaptersFromUrl: (url: string) => p.loadChaptersFromUrl ? p.loadChaptersFromUrl(url) : Promise.resolve(),
        getCurrentSegment: () => p.getCurrentSegment ? p.getCurrentSegment() : null,
        skipToSegment: (segmentId: string) => p.skipToSegment && p.skipToSegment(segmentId),
        getSegments: () => p.getSegments ? p.getSegments() : [],
        updateChapterConfig: (config: any) => p.updateChapterConfig && p.updateChapterConfig(config),
        hasChapters: () => p.hasChapters ? p.hasChapters() : false,
        getChapters: () => p.getChapters ? p.getChapters() : null,
        getCoreChapters: () => p.getCoreChapters ? p.getCoreChapters() : [],
        getCoreSegments: () => p.getCoreSegments ? p.getCoreSegments() : [],
        getCurrentChapterInfo: () => p.getCurrentChapterInfo ? p.getCurrentChapterInfo() : null,
        seekToChapter: (chapterId: string) => p.seekToChapter && p.seekToChapter(chapterId),
        getNextChapter: () => p.getNextChapter ? p.getNextChapter() : null,
        getPreviousChapter: () => p.getPreviousChapter ? p.getPreviousChapter() : null,
      };
      props.onChapterAPI(chapterAPI);
    }
    
    // Quality API with filtering
    if (props.onQualityAPI) {
      const allQualities = p.getQualities ? p.getQualities() : [];
      const filteredQualities = filterQualities(allQualities);
      
      // Create a mapping from filtered index to original index
      const indexMap = new Map<number, number>();
      filteredQualities.forEach((quality, filteredIndex) => {
        const originalIndex = allQualities.findIndex(q => q.id === quality.id);
        indexMap.set(filteredIndex, originalIndex);
      });
      
      const qualityAPI: QualityAPI = {
        // Return only filtered qualities
        getQualities: () => filteredQualities,
        
        // Get current quality if it's in the filtered list
        getCurrentQuality: () => {
          const current = p.getCurrentQuality ? p.getCurrentQuality() : null;
          if (!current) return null;
          return filteredQualities.find(q => q.id === current.id) || null;
        },
        
        // Map filtered index to original index before setting
        setQuality: (filteredIndex: number) => {
          const originalIndex = indexMap.get(filteredIndex);
          if (originalIndex !== undefined && p.setQuality) {
            p.setQuality(originalIndex);
          }
        },
        
        setAutoQuality: (enabled: boolean) => p.setAutoQuality && p.setAutoQuality(enabled),
      };
      props.onQualityAPI(qualityAPI);
    }
    
    // EPG API
    if (props.onEPGAPI) {
      const epgAPI: EPGControlAPI = {
        setEPGData: (data: any) => p.setEPGData && p.setEPGData(data),
        showEPGButton: () => p.showEPGButton && p.showEPGButton(),
        hideEPGButton: () => p.hideEPGButton && p.hideEPGButton(),
        isEPGButtonVisible: () => p.isEPGButtonVisible ? p.isEPGButtonVisible() : false,
      };
      props.onEPGAPI(epgAPI);
    }
    
    // UI Helper API
    if (props.onUIHelperAPI) {
      const uiAPI: UIHelperAPI = {
        focusPlayer: () => p.focusPlayer && p.focusPlayer(),
        showFullscreenTip: () => p.showFullscreenTip && p.showFullscreenTip(),
        triggerFullscreenButton: () => p.triggerFullscreenButton && p.triggerFullscreenButton(),
        showTemporaryMessage: (message: string) => p.showTemporaryMessage && p.showTemporaryMessage(message),
        showFullscreenInstructions: () => p.showFullscreenInstructions && p.showFullscreenInstructions(),
        enterFullscreenSynchronously: () => p.enterFullscreenSynchronously && p.enterFullscreenSynchronously(),
      };
      props.onUIHelperAPI(uiAPI);
    }
    
    // Fullscreen API
    if (props.onFullscreenAPI) {
      const fullscreenAPI: FullscreenAPI = {
        enterFullscreen: () => p.enterFullscreen ? p.enterFullscreen() : Promise.resolve(),
        exitFullscreen: () => p.exitFullscreen ? p.exitFullscreen() : Promise.resolve(),
        toggleFullscreen: () => p.toggleFullscreen ? p.toggleFullscreen() : Promise.resolve(),
        enterPictureInPicture: () => p.enterPictureInPicture ? p.enterPictureInPicture() : Promise.resolve(),
        exitPictureInPicture: () => p.exitPictureInPicture ? p.exitPictureInPicture() : Promise.resolve(),
      };
      props.onFullscreenAPI(fullscreenAPI);
    }
    
    // Playback API
    if (props.onPlaybackAPI) {
      const playbackAPI: PlaybackAPI = {
        play: () => p.play ? p.play() : Promise.resolve(),
        pause: () => p.pause && p.pause(),
        requestPause: () => p.requestPause && p.requestPause(),
        seek: (time: number) => p.seek && p.seek(time),
        setVolume: (level: number) => p.setVolume && p.setVolume(level),
        mute: () => p.mute && p.mute(),
        unmute: () => p.unmute && p.unmute(),
        toggleMute: () => p.toggleMute && p.toggleMute(),
        setPlaybackRate: (rate: number) => p.setPlaybackRate && p.setPlaybackRate(rate),
        getPlaybackRate: () => p.getPlaybackRate ? p.getPlaybackRate() : 1,
        getCurrentTime: () => p.getCurrentTime ? p.getCurrentTime() : 0,
        getDuration: () => p.getDuration ? p.getDuration() : 0,
        getState: () => p.getState ? p.getState() : {},
      };
      props.onPlaybackAPI(playbackAPI);
    }
  }, [
    props.onChapterAPI,
    props.onQualityAPI,
    props.onEPGAPI,
    props.onUIHelperAPI,
    props.onFullscreenAPI,
    props.onPlaybackAPI,
    filterQualities,
  ]);
  
  // Helper function to apply settings scrollbar configuration
  const applySettingsScrollbar = useCallback((player: WebPlayer, config: NonNullable<typeof props.settingsScrollbar>) => {
    const p = player as any;
    
    // Apply scrollbar style
    if (config.style && typeof p.setSettingsScrollbarStyle === 'function') {
      p.setSettingsScrollbarStyle(config.style);
    }
    
    // Apply scrollbar config (width and intensity)
    if ((config.widthPx !== undefined || config.intensity !== undefined) && 
        typeof p.setSettingsScrollbarConfig === 'function') {
      p.setSettingsScrollbarConfig({
        widthPx: config.widthPx,
        intensity: config.intensity,
      });
    }
  }, []);
  
  // Apply settings scrollbar changes at runtime
  useEffect(() => {
    const p = playerRef.current as any;
    if (p && props.settingsScrollbar && playerReady) {
      applySettingsScrollbar(p, props.settingsScrollbar);
    }
  }, [JSON.stringify(props.settingsScrollbar), playerReady, applySettingsScrollbar]);
  
  // Re-expose APIs when player is ready (handles hot reloading)
  useEffect(() => {
    if (playerRef.current && playerReady) {
      exposeAPIsToParent(playerRef.current);
    }
  }, [playerReady, exposeAPIsToParent]);

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
      // Only update if paywall is enabled and properly configured
      const paywall = props.paywall as any;
      if (paywall.enabled && (paywall.apiBase || paywall.userId || paywall.videoId)) {
        try { 
          console.log('[WebPlayerView] Updating paywall config:', paywall);
          p.setPaywallConfig(paywall); 
        } catch(err) {
          console.warn('[WebPlayerView] Failed to update paywall config:', err);
        }
      }
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
  
  // Prepare EPG config with action handlers
  const epgConfigWithHandlers = {
    ...props.epgConfig,
    onFavorite: props.onEPGFavorite,
    onRecord: props.onEPGRecord,
    onSetReminder: props.onEPGSetReminder,
    onCatchup: props.onEPGCatchup,
    onProgramSelect: props.onEPGProgramSelect,
    onChannelSelect: props.onEPGChannelSelect,
  };
  
  return (
    <div 
      className={`uvf-player-container ${props.epg ? 'with-epg' : ''} ${props.className || ''}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000',
        zIndex: 40,
      }}
    >
      {/* Video Player */}
      <div 
        ref={containerRef} 
        className={`uvf-responsive-container ${props.className || ''}`}
        style={responsiveStyle}
      />
      
      {/* Google Ads Container - positioned over the video player and controls */}
      {props.googleAds && (
        <div 
          ref={adContainerRef}
          className="uvf-ad-container"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2147483647, // Maximum z-index - ads must be on top of everything
            pointerEvents: isAdPlaying ? 'auto' : 'none', // Allow interaction only when ad is playing
            display: isAdPlaying ? 'block' : 'none', // Hide container when no ad
          }}
        />
      )}

      {/* EPG Overlay */}
      {props.epg && EPGOverlay && epgComponentLoaded && (
        <div style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          height: epgVisible ? '65vh' : '0', 
          zIndex: 150,
          transition: 'height 0.3s ease',
          overflow: 'hidden',
          backgroundColor: 'rgba(0,0,0,0.95)'
        }}>
          <EPGOverlay
            data={props.epg}
            config={epgConfigWithHandlers}
            visible={epgVisible}
            onToggle={handleToggleEPG}
          />
        </div>
      )}
      
      {/* Instructions Toast */}
      {props.epg && playerReady && !epgVisible && (
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

export default WebPlayerView;

