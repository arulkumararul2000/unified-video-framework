import React from 'react';
import { ViewStyle } from 'react-native';
import Video from 'react-native-video';
import { IVideoPlayer, PlayerConfig, PlayerError } from '@unified-video/core';
interface ReactNativePlayerProps {
    style?: ViewStyle;
    config?: PlayerConfig;
    onReady?: () => void;
    onError?: (error: PlayerError) => void;
}
export interface ReactNativePlayerRef extends IVideoPlayer {
    getVideoRef: () => Video | null;
}
export declare const ReactNativePlayer: React.ForwardRefExoticComponent<ReactNativePlayerProps & React.RefAttributes<ReactNativePlayerRef>>;
export {};
//# sourceMappingURL=ReactNativePlayer.d.ts.map