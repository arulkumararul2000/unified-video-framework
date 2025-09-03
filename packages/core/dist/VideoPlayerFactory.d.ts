import { IVideoPlayer, PlayerConfig } from './interfaces/IVideoPlayer';
export type Platform = 'web' | 'ios' | 'android' | 'tizen' | 'webos' | 'roku' | 'androidtv' | 'appletv' | 'windows';
export declare class VideoPlayerFactory {
    static create(platform: Platform, container: HTMLElement | string | any, config?: PlayerConfig): Promise<IVideoPlayer>;
    static detectPlatform(): Platform;
    static createForCurrentPlatform(container: HTMLElement | string | any, config?: PlayerConfig): Promise<IVideoPlayer>;
}
//# sourceMappingURL=VideoPlayerFactory.d.ts.map