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
exports.PlayerFactory = void 0;
const interfaces_1 = require("./interfaces");
const PlatformDetector_1 = require("./utils/PlatformDetector");
class PlayerFactory {
    static async createPlayer(container, config = {}) {
        const platform = this.platformDetector.detect();
        console.log(`Creating player for platform: ${platform.type}`);
        switch (platform.type) {
            case interfaces_1.PlatformType.IOS:
                const { IOSPlayer } = await Promise.resolve().then(() => __importStar(require('@video-framework/react-native')));
                return new IOSPlayer(container, config);
            case interfaces_1.PlatformType.ANDROID:
                const { AndroidPlayer } = await Promise.resolve().then(() => __importStar(require('@video-framework/react-native')));
                return new AndroidPlayer(container, config);
            case interfaces_1.PlatformType.TIZEN:
                const { TizenPlayer } = await Promise.resolve().then(() => __importStar(require('@video-framework/enact')));
                return new TizenPlayer(container, config);
            case interfaces_1.PlatformType.WEBOS:
                const { WebOSPlayer } = await Promise.resolve().then(() => __importStar(require('@video-framework/enact')));
                return new WebOSPlayer(container, config);
            case interfaces_1.PlatformType.ROKU:
                const { RokuPlayer } = await Promise.resolve().then(() => __importStar(require('@video-framework/roku')));
                return new RokuPlayer(container, config);
            case interfaces_1.PlatformType.ANDROID_TV:
                const { AndroidTVPlayer } = await Promise.resolve().then(() => __importStar(require('@video-framework/react-native')));
                return new AndroidTVPlayer(container, config);
            case interfaces_1.PlatformType.APPLE_TV:
                const { AppleTVPlayer } = await Promise.resolve().then(() => __importStar(require('@video-framework/react-native')));
                return new AppleTVPlayer(container, config);
            case interfaces_1.PlatformType.WINDOWS:
                const { WindowsPlayer } = await Promise.resolve().then(() => __importStar(require('@video-framework/web')));
                return new WindowsPlayer(container, config);
            case interfaces_1.PlatformType.WEB:
            default:
                const { HTML5Player } = await Promise.resolve().then(() => __importStar(require('@video-framework/web')));
                return new HTML5Player(container, config);
        }
    }
    static getPlatformInfo() {
        return this.platformDetector.detect();
    }
    static isFeatureSupported(feature) {
        const platform = this.platformDetector.detect();
        return this.getFeatureSupport(platform.type, feature);
    }
    static getFeatureSupport(platform, feature) {
        const featureMatrix = {
            'drm-fairplay': [interfaces_1.PlatformType.IOS, interfaces_1.PlatformType.APPLE_TV],
            'drm-widevine': [
                interfaces_1.PlatformType.ANDROID,
                interfaces_1.PlatformType.ANDROID_TV,
                interfaces_1.PlatformType.TIZEN,
                interfaces_1.PlatformType.WEBOS,
                interfaces_1.PlatformType.WEB
            ],
            'drm-playready': [
                interfaces_1.PlatformType.TIZEN,
                interfaces_1.PlatformType.WEBOS,
                interfaces_1.PlatformType.ROKU,
                interfaces_1.PlatformType.WINDOWS
            ],
            'picture-in-picture': [
                interfaces_1.PlatformType.IOS,
                interfaces_1.PlatformType.ANDROID,
                interfaces_1.PlatformType.WEB
            ],
            'airplay': [interfaces_1.PlatformType.IOS, interfaces_1.PlatformType.APPLE_TV],
            'chromecast': [interfaces_1.PlatformType.ANDROID, interfaces_1.PlatformType.WEB],
            'offline-playback': [
                interfaces_1.PlatformType.IOS,
                interfaces_1.PlatformType.ANDROID,
                interfaces_1.PlatformType.WEB
            ],
            '4k-playback': [
                interfaces_1.PlatformType.TIZEN,
                interfaces_1.PlatformType.WEBOS,
                interfaces_1.PlatformType.APPLE_TV,
                interfaces_1.PlatformType.ANDROID_TV,
                interfaces_1.PlatformType.ROKU
            ],
            'hdr': [
                interfaces_1.PlatformType.TIZEN,
                interfaces_1.PlatformType.WEBOS,
                interfaces_1.PlatformType.APPLE_TV,
                interfaces_1.PlatformType.ROKU
            ],
            'spatial-audio': [interfaces_1.PlatformType.IOS, interfaces_1.PlatformType.APPLE_TV],
            'remote-control': [
                interfaces_1.PlatformType.TIZEN,
                interfaces_1.PlatformType.WEBOS,
                interfaces_1.PlatformType.ROKU,
                interfaces_1.PlatformType.ANDROID_TV,
                interfaces_1.PlatformType.APPLE_TV
            ]
        };
        return featureMatrix[feature]?.includes(platform) || false;
    }
    static getOptimizedConfig(baseConfig = {}) {
        const platform = this.platformDetector.detect();
        const platformConfigs = {
            [interfaces_1.PlatformType.IOS]: {
                playsInline: true,
                muted: true,
                pictureInPicture: true
            },
            [interfaces_1.PlatformType.ANDROID]: {
                playsInline: true,
                muted: true
            },
            [interfaces_1.PlatformType.TIZEN]: {
                controls: false,
                adaptiveBitrate: {
                    autoLevelEnabled: true,
                    startLevel: -1
                }
            },
            [interfaces_1.PlatformType.WEBOS]: {
                controls: false,
                adaptiveBitrate: {
                    autoLevelEnabled: true,
                    startLevel: -1
                }
            },
            [interfaces_1.PlatformType.ROKU]: {
                controls: false,
                adaptiveBitrate: {
                    autoLevelEnabled: true
                }
            },
            [interfaces_1.PlatformType.ANDROID_TV]: {
                controls: false,
                adaptiveBitrate: {
                    autoLevelEnabled: true,
                    maxBitrate: 8000000
                }
            },
            [interfaces_1.PlatformType.APPLE_TV]: {
                controls: false,
                adaptiveBitrate: {
                    autoLevelEnabled: true,
                    maxBitrate: 10000000
                }
            },
            [interfaces_1.PlatformType.WINDOWS]: {
                controls: true,
                pictureInPicture: false
            },
            [interfaces_1.PlatformType.WEB]: {
                controls: true,
                playsInline: true,
                pictureInPicture: true
            }
        };
        const platformConfig = platformConfigs[platform.type] || {};
        return {
            ...baseConfig,
            ...platformConfig,
            ...Object.keys(baseConfig).reduce((acc, key) => {
                if (baseConfig[key] !== undefined) {
                    acc[key] = baseConfig[key];
                }
                return acc;
            }, {})
        };
    }
}
exports.PlayerFactory = PlayerFactory;
PlayerFactory.platformDetector = new PlatformDetector_1.PlatformDetector();
//# sourceMappingURL=PlayerFactory.js.map