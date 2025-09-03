// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { VideoSource, SubtitleTrack, VideoMetadata, PlayerConfig } from '@unified-video/core';
import { WebPlayer } from '../WebPlayer';

export type WebPlayerViewProps = {
  // Player config
  autoPlay?: boolean;
  muted?: boolean;
  enableAdaptiveBitrate?: boolean;
  debug?: boolean;
  freeDuration?: number;

  // Source config
  url: string;
  type?: 'mp4' | 'hls' | 'dash' | 'webm' | 'auto';
  subtitles?: SubtitleTrack[];
  metadata?: VideoMetadata;

  // Optional Google Cast sender SDK loader
  cast?: boolean;

  // Styling
  className?: string;
  style?: CSSProperties;
  // Dynamic theming: pass a single accent color string or an object with fields
  // { accent, accent2, iconColor, textPrimary, textSecondary }
  playerTheme?: string | { accent?: string; accent2?: string; iconColor?: string; textPrimary?: string; textSecondary?: string };

  // Callbacks
  onReady?: (player: WebPlayer) => void;
  onError?: (error: unknown) => void;
};

export const WebPlayerView: React.FC<WebPlayerViewProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<WebPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!containerRef.current) return;

      const player = new WebPlayer();
      playerRef.current = player;

      // Optionally load Google Cast sender SDK
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
        } catch (_) {
          // ignore load issues in SSR or restricted environments
        }
      }

      const config: PlayerConfig = {
        autoPlay: props.autoPlay ?? false,
        muted: props.muted ?? false,
        enableAdaptiveBitrate: props.enableAdaptiveBitrate ?? true,
        debug: props.debug ?? false,
        freeDuration: props.freeDuration,
      };

      try {
        await player.initialize(containerRef.current, config);

        // Apply theme before loading source (so poster and UI show themed styles)
        try {
          if (props.playerTheme && (player as any).setTheme) {
            (player as any).setTheme(props.playerTheme as any);
          }
        } catch (_) {}

        const source: VideoSource = {
          url: props.url,
          type: props.type ?? 'auto',
          subtitles: props.subtitles,
          metadata: props.metadata,
        };

        await player.load(source);
        if (!cancelled) props.onReady?.(player);
      } catch (err) {
        if (!cancelled) props.onError?.(err);
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
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
  ])

  // Respond to theme updates without reinitializing the player
  useEffect(() => {
    const p = playerRef.current as any;
    try {
      if (p && typeof p.setTheme === 'function') {
        p.setTheme(props.playerTheme as any);
      }
    } catch (_) {}
  }, [JSON.stringify(props.playerTheme)]);

  return <div ref={containerRef} className={props.className} style={props.style} />;
};

export default WebPlayerView;

