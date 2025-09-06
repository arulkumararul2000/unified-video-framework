"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoPlayerFactory = void 0;
class VideoPlayerFactory {
    static async create(platform, container, config) {
        switch (platform) {
            case 'web':
                try {
                    const WebModule = await eval('import("@unified-video/web")');
                    if (WebModule?.WebPlayer) {
                        const player = new WebModule.WebPlayer();
                        await player.initialize(container, config);
                        return player;
                    }
                }
                catch (e) {
                }
                break;
            case 'ios':
            case 'android':
                try {
                    const RNModule = await eval('import("@unified-video/react-native")');
                    if (RNModule?.ReactNativePlayer) {
                        return RNModule.ReactNativePlayer;
                    }
                }
                catch (e) {
                }
                break;
            case 'tizen':
            case 'webos':
                try {
                    const EnactModule = await eval('import("@unified-video/enact")');
                    if (EnactModule?.EnactPlayer) {
                        const player = new EnactModule.EnactPlayer();
                        await player.initialize(container, config);
                        return player;
                    }
                }
                catch (e) {
                }
                break;
            case 'roku':
                try {
                    const RokuModule = await eval('import("@unified-video/roku")');
                    if (RokuModule?.RokuPlayer) {
                        const player = new RokuModule.RokuPlayer();
                        await player.initialize(container, config);
                        return player;
                    }
                }
                catch (e) {
                }
                break;
            default:
                throw new Error(`Platform '${platform}' is not supported`);
        }
        throw new Error(`Failed to load player for platform '${platform}'`);
    }
    static detectPlatform() {
        if (typeof global !== 'undefined' && global.nativeCallSyncHook) {
            try {
                const RN = eval('require("react-native")');
                if (RN && RN.Platform) {
                    return RN.Platform.OS;
                }
            }
            catch (e) {
            }
        }
        if (typeof window !== 'undefined') {
            const userAgent = window.navigator.userAgent.toLowerCase();
            if (userAgent.includes('tizen'))
                return 'tizen';
            if (userAgent.includes('webos'))
                return 'webos';
            if (userAgent.includes('roku'))
                return 'roku';
            if (userAgent.includes('android') && userAgent.includes('tv')) {
                return 'androidtv';
            }
            if (userAgent.includes('appletv'))
                return 'appletv';
            if (userAgent.includes('windows'))
                return 'windows';
            return 'web';
        }
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            return 'web';
        }
        throw new Error('Unable to detect platform');
    }
    static async createForCurrentPlatform(container, config) {
        const platform = this.detectPlatform();
        return this.create(platform, container, config);
    }
}
exports.VideoPlayerFactory = VideoPlayerFactory;
//# sourceMappingURL=VideoPlayerFactory.js.map