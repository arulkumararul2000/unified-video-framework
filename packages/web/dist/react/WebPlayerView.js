"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebPlayerView = void 0;
const react_1 = __importStar(require("react"));
const WebPlayer_1 = require("../WebPlayer");
const WebPlayerView = (props) => {
    const containerRef = (0, react_1.useRef)(null);
    const playerRef = (0, react_1.useRef)(null);
    const [dimensions, setDimensions] = (0, react_1.useState)({
        width: typeof window !== 'undefined' ? window.innerWidth : 1920,
        height: typeof window !== 'undefined' ? window.innerHeight : 1080,
    });
    (0, react_1.useEffect)(() => {
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
            maxWidth: responsive.maxWidth || '100%',
            maxHeight: responsive.maxHeight || '70vh',
            breakpoints: {
                mobile: responsive.breakpoints?.mobile || 768,
                tablet: responsive.breakpoints?.tablet || 1024,
            },
            mobilePortrait: {
                maxHeight: responsive.mobilePortrait?.maxHeight || '50vh',
                aspectRatio: responsive.mobilePortrait?.aspectRatio,
            },
            mobileLandscape: {
                maxHeight: responsive.mobileLandscape?.maxHeight || '85vh',
                aspectRatio: responsive.mobileLandscape?.aspectRatio,
            },
            tablet: {
                maxWidth: responsive.tablet?.maxWidth || '90%',
                maxHeight: responsive.tablet?.maxHeight || '65vh',
            },
        };
        const isMobile = width < defaults.breakpoints.mobile;
        const isTablet = width >= defaults.breakpoints.mobile && width < defaults.breakpoints.tablet;
        const isPortrait = height > width;
        const isLandscape = width > height;
        let calculatedStyle = {
            width: '100%',
            boxSizing: 'border-box',
            position: 'relative',
            margin: '0 auto',
            ...props.style,
        };
        if (isMobile && isPortrait) {
            const mobileAspectRatio = defaults.mobilePortrait.aspectRatio || defaults.aspectRatio;
            const calculatedHeight = Math.min(width / mobileAspectRatio, height * 0.5);
            calculatedStyle = {
                ...calculatedStyle,
                width: '100vw',
                maxWidth: '100vw',
                height: `${calculatedHeight}px`,
                maxHeight: '50vh',
                minHeight: '200px',
                aspectRatio: 'unset',
            };
        }
        else if (isMobile && isLandscape) {
            const mobileAspectRatio = defaults.mobileLandscape.aspectRatio || defaults.aspectRatio;
            const calculatedHeight = Math.min(width / mobileAspectRatio, height * 0.85);
            calculatedStyle = {
                ...calculatedStyle,
                width: '100vw',
                maxWidth: '100vw',
                height: `${calculatedHeight}px`,
                maxHeight: '85vh',
                minHeight: '180px',
                aspectRatio: 'unset',
            };
        }
        else if (isTablet) {
            const calculatedHeight = Math.min((width * 0.9) / defaults.aspectRatio, height * 0.65);
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
    (0, react_1.useEffect)(() => {
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
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        async function boot() {
            if (!containerRef.current)
                return;
            const player = new WebPlayer_1.WebPlayer();
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
    ]);
    (0, react_1.useEffect)(() => {
        const p = playerRef.current;
        if (p && typeof p.setFreeDuration === 'function' && typeof props.freeDuration !== 'undefined') {
            try {
                p.setFreeDuration(props.freeDuration);
            }
            catch (_) { }
        }
    }, [props.freeDuration]);
    (0, react_1.useEffect)(() => {
        const p = playerRef.current;
        if (p && typeof p.setPaywallConfig === 'function' && props.paywall) {
            try {
                p.setPaywallConfig(props.paywall);
            }
            catch (_) { }
        }
    }, [JSON.stringify(props.paywall)]);
    (0, react_1.useEffect)(() => {
        const p = playerRef.current;
        try {
            if (p && typeof p.setTheme === 'function') {
                p.setTheme(props.playerTheme);
            }
        }
        catch (_) { }
    }, [JSON.stringify(props.playerTheme)]);
    const responsiveStyle = getResponsiveDimensions();
    return (react_1.default.createElement("div", { ref: containerRef, className: `uvf-responsive-container ${props.className || ''}`, style: responsiveStyle }));
};
exports.WebPlayerView = WebPlayerView;
exports.default = exports.WebPlayerView;
//# sourceMappingURL=WebPlayerView.js.map