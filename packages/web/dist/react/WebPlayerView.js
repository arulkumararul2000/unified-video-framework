import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebPlayer } from "../WebPlayer.js";
import { GoogleAdsManager } from "../ads/GoogleAdsManager.js";
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
    const internalPlayerRef = useRef(null);
    const playerRef = props.playerRef || internalPlayerRef;
    const [dimensions, setDimensions] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    });
    const [epgVisible, setEPGVisible] = useState(props.showEPG || false);
    const [playerReady, setPlayerReady] = useState(false);
    const [epgComponentLoaded, setEPGComponentLoaded] = useState(false);
    const adsManagerRef = useRef(null);
    const adContainerRef = useRef(null);
    const [isAdPlaying, setIsAdPlaying] = useState(false);
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
            exposeAPIsToParent(player);
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
            let watermarkConfig;
            if (typeof props.watermark === 'boolean') {
                watermarkConfig = { enabled: props.watermark };
            }
            else {
                watermarkConfig = props.watermark;
            }
            const config = {
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
                qualityFilter: props.qualityFilter,
                premiumQualities: props.premiumQualities,
                navigation: props.navigation,
                chapters: props.chapters ? {
                    enabled: props.chapters.enabled ?? false,
                    data: props.chapters.data,
                    dataUrl: props.chapters.dataUrl,
                    autoHide: props.chapters.autoHide ?? true,
                    autoHideDelay: props.chapters.autoHideDelay ?? 5000,
                    showChapterMarkers: props.chapters.showChapterMarkers ?? true,
                    skipButtonPosition: props.chapters.skipButtonPosition ?? 'bottom-right',
                    customStyles: props.chapters.customStyles,
                    userPreferences: {
                        autoSkipIntro: props.chapters.userPreferences?.autoSkipIntro ?? false,
                        autoSkipRecap: props.chapters.userPreferences?.autoSkipRecap ?? false,
                        autoSkipCredits: props.chapters.userPreferences?.autoSkipCredits ?? false,
                        showSkipButtons: props.chapters.userPreferences?.showSkipButtons ?? true,
                        skipButtonTimeout: props.chapters.userPreferences?.skipButtonTimeout ?? 5000,
                        rememberChoices: props.chapters.userPreferences?.rememberChoices ?? true,
                        resumePlaybackAfterSkip: props.chapters.userPreferences?.resumePlaybackAfterSkip ?? true,
                    }
                } : { enabled: false }
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
                    if (props.qualityFilter && typeof player.setQualityFilter === 'function') {
                        player.setQualityFilter(props.qualityFilter);
                    }
                    if (props.settingsScrollbar) {
                        applySettingsScrollbar(player, props.settingsScrollbar);
                    }
                    if (props.autoFocusPlayer && typeof player.focusPlayer === 'function') {
                        player.focusPlayer();
                    }
                    if (props.showFullscreenTipOnMount && typeof player.showFullscreenTip === 'function') {
                        player.showFullscreenTip();
                    }
                    if (props.epg && typeof player.setEPGData === 'function') {
                        player.setEPGData(props.epg);
                    }
                    if (typeof player.on === 'function') {
                        player.on('epgToggle', () => {
                            handleToggleEPG(!epgVisible);
                        });
                    }
                    if (props.onChapterChange && typeof player.on === 'function') {
                        player.on('chapterchange', props.onChapterChange);
                    }
                    if (props.onSegmentEntered && typeof player.on === 'function') {
                        player.on('segmententered', props.onSegmentEntered);
                    }
                    if (props.onSegmentExited && typeof player.on === 'function') {
                        player.on('segmentexited', props.onSegmentExited);
                    }
                    if (props.onSegmentSkipped && typeof player.on === 'function') {
                        player.on('segmentskipped', props.onSegmentSkipped);
                    }
                    if (props.onChapterSegmentEntered && typeof player.on === 'function') {
                        player.on('chapterSegmentEntered', props.onChapterSegmentEntered);
                    }
                    if (props.onChapterSegmentSkipped && typeof player.on === 'function') {
                        player.on('chapterSegmentSkipped', props.onChapterSegmentSkipped);
                    }
                    if (props.onChapterSkipButtonShown && typeof player.on === 'function') {
                        player.on('chapterSkipButtonShown', props.onChapterSkipButtonShown);
                    }
                    if (props.onChapterSkipButtonHidden && typeof player.on === 'function') {
                        player.on('chapterSkipButtonHidden', props.onChapterSkipButtonHidden);
                    }
                    if (props.onChaptersLoaded && typeof player.on === 'function') {
                        player.on('chaptersLoaded', props.onChaptersLoaded);
                    }
                    if (props.onChaptersLoadError && typeof player.on === 'function') {
                        player.on('chaptersLoadError', props.onChaptersLoadError);
                    }
                    if (props.onNavigationBackClicked && typeof player.on === 'function') {
                        player.on('navigationBackClicked', props.onNavigationBackClicked);
                    }
                    if (props.onNavigationCloseClicked && typeof player.on === 'function') {
                        player.on('navigationCloseClicked', props.onNavigationCloseClicked);
                    }
                    if (props.onPlay && typeof player.on === 'function') {
                        player.on('onPlay', props.onPlay);
                    }
                    if (props.onPause && typeof player.on === 'function') {
                        player.on('onPause', props.onPause);
                    }
                    if (props.onEnded && typeof player.on === 'function') {
                        player.on('onEnded', props.onEnded);
                    }
                    if (props.onTimeUpdate && typeof player.on === 'function') {
                        player.on('onTimeUpdate', (currentTime) => {
                            props.onTimeUpdate?.({
                                currentTime,
                                duration: player.getDuration ? player.getDuration() : 0
                            });
                        });
                    }
                    if (props.onProgress && typeof player.on === 'function') {
                        player.on('onProgress', (buffered) => {
                            props.onProgress?.({ buffered });
                        });
                    }
                    if (props.onVolumeChange && typeof player.on === 'function') {
                        player.on('onVolumeChanged', (volume) => {
                            const state = player.getState ? player.getState() : {};
                            props.onVolumeChange?.({ volume, muted: state.isMuted || false });
                        });
                    }
                    if (props.onQualityChange && typeof player.on === 'function') {
                        player.on('onQualityChanged', props.onQualityChange);
                    }
                    if (props.onBuffering && typeof player.on === 'function') {
                        player.on('onBuffering', props.onBuffering);
                    }
                    if (props.onFullscreenChange && typeof player.on === 'function') {
                        player.on('onFullscreenChanged', props.onFullscreenChange);
                    }
                    if (props.onPictureInPictureChange && typeof player.on === 'function') {
                        player.on('onPictureInPicturechange', props.onPictureInPictureChange);
                    }
                    if (props.googleAds) {
                        setTimeout(async () => {
                            try {
                                const adContainer = adContainerRef.current;
                                const videoElement = player.video || player.getVideoElement?.();
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
                                const adsManager = new GoogleAdsManager(videoElement, adContainer, {
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
                                });
                                await adsManager.initialize();
                                adsManagerRef.current = adsManager;
                                console.log('Google Ads initialized successfully');
                                const handleFirstPlay = () => {
                                    if (adsManagerRef.current) {
                                        adsManagerRef.current.initAdDisplayContainer();
                                        adsManagerRef.current.requestAds();
                                    }
                                    videoElement.removeEventListener('play', handleFirstPlay);
                                };
                                videoElement.addEventListener('play', handleFirstPlay, { once: true });
                            }
                            catch (adsError) {
                                console.error('Failed to initialize Google Ads:', adsError);
                                props.googleAds?.onAdError?.(adsError);
                            }
                        }, 100);
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
            if (adsManagerRef.current) {
                adsManagerRef.current.destroy();
                adsManagerRef.current = null;
            }
            if (playerRef.current) {
                playerRef.current.destroy().catch(() => { });
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
    const filterQualities = useCallback((qualities) => {
        if (!props.qualityFilter || qualities.length === 0) {
            return qualities;
        }
        const filter = props.qualityFilter;
        let filtered = [...qualities];
        if (filter.allowedHeights && filter.allowedHeights.length > 0) {
            filtered = filtered.filter(q => filter.allowedHeights.includes(q.height));
        }
        if (filter.allowedLabels && filter.allowedLabels.length > 0) {
            filtered = filtered.filter(q => filter.allowedLabels.includes(q.label));
        }
        if (filter.minHeight !== undefined) {
            filtered = filtered.filter(q => q.height >= filter.minHeight);
        }
        if (filter.maxHeight !== undefined) {
            filtered = filtered.filter(q => q.height <= filter.maxHeight);
        }
        return filtered;
    }, [props.qualityFilter]);
    const exposeAPIsToParent = useCallback((player) => {
        const p = player;
        if (props.onChapterAPI) {
            const chapterAPI = {
                loadChapters: (chapters) => p.loadChapters ? p.loadChapters(chapters) : Promise.resolve(),
                loadChaptersFromUrl: (url) => p.loadChaptersFromUrl ? p.loadChaptersFromUrl(url) : Promise.resolve(),
                getCurrentSegment: () => p.getCurrentSegment ? p.getCurrentSegment() : null,
                skipToSegment: (segmentId) => p.skipToSegment && p.skipToSegment(segmentId),
                getSegments: () => p.getSegments ? p.getSegments() : [],
                updateChapterConfig: (config) => p.updateChapterConfig && p.updateChapterConfig(config),
                hasChapters: () => p.hasChapters ? p.hasChapters() : false,
                getChapters: () => p.getChapters ? p.getChapters() : null,
                getCoreChapters: () => p.getCoreChapters ? p.getCoreChapters() : [],
                getCoreSegments: () => p.getCoreSegments ? p.getCoreSegments() : [],
                getCurrentChapterInfo: () => p.getCurrentChapterInfo ? p.getCurrentChapterInfo() : null,
                seekToChapter: (chapterId) => p.seekToChapter && p.seekToChapter(chapterId),
                getNextChapter: () => p.getNextChapter ? p.getNextChapter() : null,
                getPreviousChapter: () => p.getPreviousChapter ? p.getPreviousChapter() : null,
            };
            props.onChapterAPI(chapterAPI);
        }
        if (props.onQualityAPI) {
            const allQualities = p.getQualities ? p.getQualities() : [];
            const filteredQualities = filterQualities(allQualities);
            const indexMap = new Map();
            filteredQualities.forEach((quality, filteredIndex) => {
                const originalIndex = allQualities.findIndex(q => q.id === quality.id);
                indexMap.set(filteredIndex, originalIndex);
            });
            const qualityAPI = {
                getQualities: () => filteredQualities,
                getCurrentQuality: () => {
                    const current = p.getCurrentQuality ? p.getCurrentQuality() : null;
                    if (!current)
                        return null;
                    return filteredQualities.find(q => q.id === current.id) || null;
                },
                setQuality: (filteredIndex) => {
                    const originalIndex = indexMap.get(filteredIndex);
                    if (originalIndex !== undefined && p.setQuality) {
                        p.setQuality(originalIndex);
                    }
                },
                setAutoQuality: (enabled) => p.setAutoQuality && p.setAutoQuality(enabled),
            };
            props.onQualityAPI(qualityAPI);
        }
        if (props.onEPGAPI) {
            const epgAPI = {
                setEPGData: (data) => p.setEPGData && p.setEPGData(data),
                showEPGButton: () => p.showEPGButton && p.showEPGButton(),
                hideEPGButton: () => p.hideEPGButton && p.hideEPGButton(),
                isEPGButtonVisible: () => p.isEPGButtonVisible ? p.isEPGButtonVisible() : false,
            };
            props.onEPGAPI(epgAPI);
        }
        if (props.onUIHelperAPI) {
            const uiAPI = {
                focusPlayer: () => p.focusPlayer && p.focusPlayer(),
                showFullscreenTip: () => p.showFullscreenTip && p.showFullscreenTip(),
                triggerFullscreenButton: () => p.triggerFullscreenButton && p.triggerFullscreenButton(),
                showTemporaryMessage: (message) => p.showTemporaryMessage && p.showTemporaryMessage(message),
                showFullscreenInstructions: () => p.showFullscreenInstructions && p.showFullscreenInstructions(),
                enterFullscreenSynchronously: () => p.enterFullscreenSynchronously && p.enterFullscreenSynchronously(),
            };
            props.onUIHelperAPI(uiAPI);
        }
        if (props.onFullscreenAPI) {
            const fullscreenAPI = {
                enterFullscreen: () => p.enterFullscreen ? p.enterFullscreen() : Promise.resolve(),
                exitFullscreen: () => p.exitFullscreen ? p.exitFullscreen() : Promise.resolve(),
                toggleFullscreen: () => p.toggleFullscreen ? p.toggleFullscreen() : Promise.resolve(),
                enterPictureInPicture: () => p.enterPictureInPicture ? p.enterPictureInPicture() : Promise.resolve(),
                exitPictureInPicture: () => p.exitPictureInPicture ? p.exitPictureInPicture() : Promise.resolve(),
            };
            props.onFullscreenAPI(fullscreenAPI);
        }
        if (props.onPlaybackAPI) {
            const playbackAPI = {
                play: () => p.play ? p.play() : Promise.resolve(),
                pause: () => p.pause && p.pause(),
                requestPause: () => p.requestPause && p.requestPause(),
                seek: (time) => p.seek && p.seek(time),
                setVolume: (level) => p.setVolume && p.setVolume(level),
                mute: () => p.mute && p.mute(),
                unmute: () => p.unmute && p.unmute(),
                toggleMute: () => p.toggleMute && p.toggleMute(),
                setPlaybackRate: (rate) => p.setPlaybackRate && p.setPlaybackRate(rate),
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
    const applySettingsScrollbar = useCallback((player, config) => {
        const p = player;
        if (config.style && typeof p.setSettingsScrollbarStyle === 'function') {
            p.setSettingsScrollbarStyle(config.style);
        }
        if ((config.widthPx !== undefined || config.intensity !== undefined) &&
            typeof p.setSettingsScrollbarConfig === 'function') {
            p.setSettingsScrollbarConfig({
                widthPx: config.widthPx,
                intensity: config.intensity,
            });
        }
    }, []);
    useEffect(() => {
        const p = playerRef.current;
        if (p && props.settingsScrollbar && playerReady) {
            applySettingsScrollbar(p, props.settingsScrollbar);
        }
    }, [JSON.stringify(props.settingsScrollbar), playerReady, applySettingsScrollbar]);
    useEffect(() => {
        if (playerRef.current && playerReady) {
            exposeAPIsToParent(playerRef.current);
        }
    }, [playerReady, exposeAPIsToParent]);
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
        props.googleAds && (React.createElement("div", { ref: adContainerRef, className: "uvf-ad-container", style: {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2147483647,
                pointerEvents: isAdPlaying ? 'auto' : 'none',
                display: isAdPlaying ? 'block' : 'none',
            } })),
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