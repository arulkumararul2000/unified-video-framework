import { VideoPlayer } from './VideoPlayer';
import { VideoPlayerConfig, PlatformInfo } from './interfaces';
export declare class PlayerFactory {
    private static platformDetector;
    static createPlayer(container: HTMLElement | any, config?: VideoPlayerConfig): Promise<VideoPlayer>;
    static getPlatformInfo(): PlatformInfo;
    static isFeatureSupported(feature: string): boolean;
    private static getFeatureSupport;
    static getOptimizedConfig(baseConfig?: VideoPlayerConfig): VideoPlayerConfig;
}
//# sourceMappingURL=PlayerFactory.d.ts.map