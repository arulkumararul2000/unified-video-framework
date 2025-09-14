import React, { useEffect, useRef, useState } from 'react';
import { WebPlayer } from '../WebPlayer';
export const WebPlayerView = (props) => {
    const containerRef = useRef(null);
    const playerRef = useRef(null);
    const [dimensions, setDimensions] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    });
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
        let calculatedStyle = {
            width: '100vw',
            height: '100vh',
            maxWidth: '100vw',
            maxHeight: '100vh',
            boxSizing: 'border-box',
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 1000,
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 0,
            padding: 0,
            ...props.style,
        };
        if (isMobile && isPortrait) {
            calculatedStyle = {
                ...calculatedStyle,
                width: '100vw',
                height: '100vh',
                maxWidth: '100vw',
                maxHeight: '100vh',
                position: 'fixed',
                top: 0,
                left: 0,
            };
        }
        else if (isMobile && isLandscape) {
            calculatedStyle = {
                ...calculatedStyle,
                width: '100vw',
                height: '100vh',
                maxWidth: '100vw',
                maxHeight: '100vh',
                position: 'fixed',
                top: 0,
                left: 0,
            };
        }
        else if (isTablet) {
            calculatedStyle = {
                ...calculatedStyle,
                width: '100vw',
                height: '100vh',
                maxWidth: '100vw',
                maxHeight: '100vh',
                position: 'fixed',
                top: 0,
                left: 0,
            };
        }
        else {
            calculatedStyle = {
                ...calculatedStyle,
                width: '100vw',
                height: '100vh',
                maxWidth: '100vw',
                maxHeight: '100vh',
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
                if (!cancelled)
                    props.onReady?.(player);
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
    return (React.createElement("div", { ref: containerRef, className: `uvf-responsive-container ${props.className || ''}`, style: responsiveStyle }));
};
export default WebPlayerView;
//# sourceMappingURL=WebPlayerView.js.map