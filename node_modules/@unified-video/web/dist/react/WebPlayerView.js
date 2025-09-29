import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebPlayer } from '../WebPlayer';
let EPGOverlay = null;
const loadEPGComponents = async () => {
    if (!EPGOverlay) {
        try {
            const epgModule = await import('./components/EPGOverlay');
            EPGOverlay = epgModule.default;
        }
        catch (error) {
            console.warn('Failed to load EPG components:', error);
        }
    }
    return EPGOverlay;
};
export const WebPlayerView = (props) => {
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const [dimensions, setDimensions] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    });
    const [epgVisible, setEPGVisible] = useState(props.showEPG || false);
    const [playerReady, setPlayerReady] = useState(false);
    const [epgComponentLoaded, setEPGComponentLoaded] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const responsiveEnabled = props.responsive?.enabled !== false;
        if (!responsiveEnabled)
            return;
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
    const handleToggleEPG = useCallback((visible) => {
        setEPGVisible(visible);
        if (props.onToggleEPG) {
            props.onToggleEPG(visible);
        }
    }, [props.onToggleEPG]);
    useEffect(() => {
        if (props.epg && !epgComponentLoaded) {
            console.log('🔄 Loading EPG components...');
            loadEPGComponents().then((component) => {
                console.log('📦 EPG component loaded:', !!component);
                if (component) {
                    console.log('✅ Setting epgComponentLoaded to true');
                    setEPGComponentLoaded(true);
                }
                else {
                    console.error('❌ EPG component is null');
                }
            }).catch((error) => {
                console.error('❌ Failed to load EPG components:', error);
            });
        }
    }, [props.epg, epgComponentLoaded]);
    useEffect(() => {
        if (props.showEPG !== undefined) {
            setEPGVisible(props.showEPG);
        }
    }, [props.showEPG]);
    useEffect(() => {
        if (!props.epg)
            return;
        const handleKeyPress = (e) => {
            if (e.key === 'g' && e.ctrlKey) {
                e.preventDefault();
                handleToggleEPG(!epgVisible);
            }
        };
        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [props.epg, epgVisible, handleToggleEPG]);
    const getResponsiveDimensions = () => {
        const responsiveEnabled = props.responsive?.enabled !== false;
        if (!responsiveEnabled)
            return props.style || {};
        const { width, height } = dimensions;
        const responsive = props.responsive || {};
        const defaults = {
            aspectRatio: responsive.aspectRatio || 16 / 9,
            maxWidth: responsive.maxWidth || '100vw',
            maxHeight: responsive.maxHeight || '100vh',
            breakpoints: {
                mobile: responsive.breakpoints?.mobile || 768,
                tablet: responsive.breakpoints?.tablet || 1024,
            },
            mobilePortrait: {
                maxHeight: responsive.mobilePortrait?.maxHeight || '100vh',
                aspectRatio: responsive.mobilePortrait?.aspectRatio,
            },
            mobileLandscape: {
                maxHeight: responsive.mobileLandscape?.maxHeight || '100vh',
                aspectRatio: responsive.mobileLandscape?.aspectRatio,
            },
            tablet: {
                maxWidth: responsive.tablet?.maxWidth || '100vw',
                maxHeight: responsive.tablet?.maxHeight || '100vh',
            },
        };
        const isMobile = width < defaults.breakpoints.mobile;
        const isTablet = width >= defaults.breakpoints.mobile && width < defaults.breakpoints.tablet;
        const isPortrait = height > width;
        const isLandscape = width > height;
        const playerHeight = props.epg && epgVisible ? '35vh' : '100vh';
        const playerMaxHeight = props.epg && epgVisible ? '35vh' : '100vh';
        const playerZIndex = props.epg && epgVisible ? 50 : 1000;
        let calculatedStyle = {
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
            ...props.style,
        };
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
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const popup = (params.get('popup') || '').toLowerCase() === '1';
            const status = (params.get('rental') || '').toLowerCase();
            const orderId = params.get('order_id') || '';
            const sessionId = params.get('session_id') || '';
            if (popup && (status === 'success' || status === 'cancel')) {
                try {
                    window.opener?.postMessage({ type: 'uvfCheckout', status, orderId, sessionId }, '*');
                }
                catch (_) { }
                try {
                    window.close();
                }
                catch (_) { }
            }
        }
        catch (_) { }
    }, []);
    useEffect(() => {
        let cancelled = false;
        async function boot() {
            if (!containerRef.current)
                return;
            const player = new WebPlayer();
            playerRef.current = player;
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
                }
                catch (_) {
                }
            }
            let paywallCfg = props.paywall;
            if (!paywallCfg && props.paywallConfigUrl) {
                try {
                    const resp = await fetch(props.paywallConfigUrl);
                    if (resp.ok)
                        paywallCfg = await resp.json();
                }
                catch (_) { }
            }
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
            const config = {
                autoPlay: props.autoPlay ?? false,
                muted: props.muted ?? false,
                enableAdaptiveBitrate: props.enableAdaptiveBitrate ?? true,
                debug: props.debug ?? false,
                freeDuration: props.freeDuration,
                paywall: paywallCfg
            };
            try {
                await player.initialize(containerRef.current, config);
                try {
                    if (props.playerTheme && player.setTheme) {
                        player.setTheme(props.playerTheme);
                    }
                }
                catch (_) { }
                const source = {
                    url: props.url,
                    type: props.type ?? 'auto',
                    subtitles: props.subtitles,
                    metadata: props.metadata,
                };
                await player.load(source);
                if (!cancelled) {
                    setPlayerReady(true);
                    if (props.epg && typeof player.setEPGData === 'function') {
                        player.setEPGData(props.epg);
                    }
                    if (typeof player.on === 'function') {
                        player.on('epgToggle', () => {
                            handleToggleEPG(!epgVisible);
                        });
                    }
                    props.onReady?.(player);
                }
            }
            catch (err) {
                if (!cancelled)
                    props.onError?.(err);
            }
        }
        void boot();
        return () => {
            cancelled = true;
            if (playerRef.current) {
                playerRef.current.destroy().catch(() => { });
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
    useEffect(() => {
        const p = playerRef.current;
        if (p && typeof p.setFreeDuration === 'function' && typeof props.freeDuration !== 'undefined') {
            try {
                p.setFreeDuration(props.freeDuration);
            }
            catch (_) { }
        }
    }, [props.freeDuration]);
    useEffect(() => {
        const p = playerRef.current;
        if (p && typeof p.setPaywallConfig === 'function' && props.paywall) {
            const paywall = props.paywall;
            if (paywall.enabled && (paywall.apiBase || paywall.userId || paywall.videoId)) {
                try {
                    console.log('[WebPlayerView] Updating paywall config:', paywall);
                    p.setPaywallConfig(paywall);
                }
                catch (err) {
                    console.warn('[WebPlayerView] Failed to update paywall config:', err);
                }
            }
        }
    }, [JSON.stringify(props.paywall)]);
    useEffect(() => {
        const p = playerRef.current;
        try {
            if (p && typeof p.setTheme === 'function') {
                p.setTheme(props.playerTheme);
            }
        }
        catch (_) { }
    }, [JSON.stringify(props.playerTheme)]);
    const responsiveStyle = getResponsiveDimensions();
    const epgConfigWithHandlers = {
        ...props.epgConfig,
        onFavorite: props.onEPGFavorite,
        onRecord: props.onEPGRecord,
        onSetReminder: props.onEPGSetReminder,
        onCatchup: props.onEPGCatchup,
        onProgramSelect: props.onEPGProgramSelect,
        onChannelSelect: props.onEPGChannelSelect,
    };
    return (React.createElement("div", { className: `uvf-player-container ${props.epg ? 'with-epg' : ''} ${props.className || ''}`, style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000',
            zIndex: 40,
        } },
        React.createElement("div", { ref: containerRef, className: `uvf-responsive-container ${props.className || ''}`, style: responsiveStyle }),
        props.epg && EPGOverlay && epgComponentLoaded && (React.createElement("div", { style: {
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: epgVisible ? '65vh' : '0',
                zIndex: 150,
                transition: 'height 0.3s ease',
                overflow: 'hidden',
                backgroundColor: 'rgba(0,0,0,0.95)'
            } },
            React.createElement(EPGOverlay, { data: props.epg, config: epgConfigWithHandlers, visible: epgVisible, onToggle: handleToggleEPG }))),
        props.epg && playerReady && !epgVisible && (React.createElement("div", { style: {
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
            } },
            "Press ",
            React.createElement("strong", null, "Ctrl+G"),
            " or click the \uD83D\uDCFA button to show the Electronic Program Guide")),
        React.createElement("style", null, `
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; }
          10%, 90% { opacity: 1; }
        }
      `)));
};
export default WebPlayerView;
//# sourceMappingURL=WebPlayerView.js.map