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
    return react_1.default.createElement("div", { ref: containerRef, className: props.className, style: props.style });
};
exports.WebPlayerView = WebPlayerView;
exports.default = exports.WebPlayerView;
//# sourceMappingURL=WebPlayerView.js.map