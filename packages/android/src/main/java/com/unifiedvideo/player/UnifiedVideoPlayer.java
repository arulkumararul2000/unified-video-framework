/**
 * UnifiedVideoPlayer.java
 * Unified Video Framework - Android Native SDK (Java Version)
 */

package com.unifiedvideo.player;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Surface;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.unifiedvideo.player.services.PlayerHolder;
import com.unifiedvideo.player.services.PlaybackService;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.google.android.exoplayer2.C;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.LoadControl;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.PlaybackException;
import com.google.android.exoplayer2.PlaybackParameters;
import com.google.android.exoplayer2.Player;
import com.google.android.exoplayer2.Timeline;
import com.google.android.exoplayer2.analytics.AnalyticsListener;
import com.google.android.exoplayer2.drm.DefaultDrmSessionManager;
import com.google.android.exoplayer2.drm.DrmSessionManager;
import com.google.android.exoplayer2.drm.DrmSessionManagerProvider;
import com.google.android.exoplayer2.drm.FrameworkMediaDrm;
import com.google.android.exoplayer2.drm.HttpMediaDrmCallback;
import com.google.android.exoplayer2.source.LoadEventInfo;
import com.google.android.exoplayer2.source.MediaLoadData;
import com.google.android.exoplayer2.source.MediaSource;
import com.google.android.exoplayer2.source.ProgressiveMediaSource;
import com.google.android.exoplayer2.source.dash.DashMediaSource;
import com.google.android.exoplayer2.source.hls.HlsMediaSource;
import com.google.android.exoplayer2.source.smoothstreaming.SsMediaSource;
import com.google.android.exoplayer2.trackselection.DefaultTrackSelector;
import com.google.android.exoplayer2.ui.PlayerView;
import com.google.android.exoplayer2.ui.StyledPlayerView;
import com.google.android.exoplayer2.upstream.DefaultDataSource;
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource;
import com.google.android.exoplayer2.util.MimeTypes;
import com.google.android.exoplayer2.util.Util;
import com.google.android.exoplayer2.video.VideoSize;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

// New imports
import android.app.Activity;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.os.Build;
import android.util.Rational;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.drawable.Icon;

import com.unifiedvideo.player.analytics.AnalyticsProvider;
import com.unifiedvideo.player.cast.CastManager;
import com.unifiedvideo.player.cast.CastManager.SubtitleItem;
import com.unifiedvideo.player.overlay.WatermarkOverlayView;

import androidx.appcompat.widget.AppCompatButton;
import androidx.appcompat.widget.AppCompatTextView;
import androidx.mediarouter.app.MediaRouteButton;
import com.google.android.gms.cast.framework.CastButtonFactory;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManagerListener;

import android.view.Gravity;

/**
 * Main Unified Video Player class for Android (Java implementation)
 */
public class UnifiedVideoPlayer {

    private static final String TAG = "UnifiedVideoPlayer";

    // Player components
    private ExoPlayer exoPlayer;
    private View playerView;
    private ViewGroup container;
    private PlayerConfiguration configuration;
    private MediaSourceInfo currentSource;
    private DefaultTrackSelector trackSelector;

    // Overlay
    private WatermarkOverlayView watermarkOverlay;

    // Analytics
    private final List<AnalyticsProvider> analyticsProviders = new ArrayList<>();

    // Cast
    private CastManager castManager;
    private MediaRouteButton castButton;
    private AppCompatButton stopCastBtn;
    private AppCompatTextView subtitleBtn;
    private SessionManagerListener<CastSession> castSessionListener;

    // Context
    private final Context context;

    // Handler for progress updates
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable updateProgressHandler;
    private Runnable watermarkRandomizer;

    // State properties
    private PlayerState state = PlayerState.IDLE;
    private boolean isPlaying = false;
    private long duration = 0;
    private long currentPosition = 0;
    private long bufferedPosition = 0;
    private float volume = 1.0f;

    // Event listeners
    private PlayerEventListener eventListener;

    /**
     * Player states
     */
    public enum PlayerState {
        IDLE,
        LOADING,
        READY,
        PLAYING,
        PAUSED,
        BUFFERING,
        SEEKING,
        ENDED,
        ERROR
    }

    /**
     * Event listener interface
     */
    public interface PlayerEventListener {
        void onReady();
        void onPlay();
        void onPause();
        void onTimeUpdate(long currentTime);
        void onBuffering(boolean isBuffering);
        void onSeek(long position);
        void onEnded();
        void onError(Exception error);
        void onLoadedMetadata(Map<String, Object> metadata);
        void onVolumeChange(float volume);
        void onStateChange(PlayerState state);
        void onProgress(long bufferedPosition);
        void onVideoSizeChanged(int width, int height);
    }

    /**
     * Constructor
     * @param context Android context
     */
    public UnifiedVideoPlayer(@NonNull Context context) {
        this.context = context.getApplicationContext();
    }

    /**
     * Initialize the player with container and configuration
     * @param container ViewGroup to hold the player view
     * @param configuration Player configuration (optional)
     */
    public void initialize(@NonNull ViewGroup container, @Nullable PlayerConfiguration configuration) {
        this.container = container;
        this.configuration = configuration != null ? configuration : new PlayerConfiguration.Builder().build();

        setupPlayer();
        applyConfiguration();
    }

    /**
     * Set event listener
     * @param listener Event listener implementation
     */
    public void setEventListener(PlayerEventListener listener) {
        this.eventListener = listener;
    }

    /**
     * Setup the player
     */
    private void setupPlayer() {
        // Create track selector for adaptive streaming
        trackSelector = new DefaultTrackSelector(context);
        trackSelector.setParameters(
            trackSelector.buildUponParameters()
                .setMaxVideoSizeSd()
                .build()
        );

        // Create player
        exoPlayer = new ExoPlayer.Builder(context)
            .setTrackSelector(trackSelector)
            .build();
        // Expose player to services (background & PiP actions)
        PlayerHolder.setPlayer(exoPlayer);

        // Add listeners
        exoPlayer.addListener(playerEventListener);
        exoPlayer.addAnalyticsListener(analyticsListener);

        // Create player view
        if (configuration.useStyledControls) {
            StyledPlayerView styledPlayerView = new StyledPlayerView(context);
            styledPlayerView.setPlayer(exoPlayer);
            styledPlayerView.setUseController(configuration.controls);
            styledPlayerView.setControllerShowTimeoutMs(3000);
            styledPlayerView.setControllerHideOnTouch(true);
            styledPlayerView.setShowBuffering(StyledPlayerView.SHOW_BUFFERING_WHEN_PLAYING);
            playerView = styledPlayerView;
        } else {
            PlayerView simplePlayerView = new PlayerView(context);
            simplePlayerView.setPlayer(exoPlayer);
            simplePlayerView.setUseController(configuration.controls);
            simplePlayerView.setControllerShowTimeoutMs(3000);
            simplePlayerView.setControllerHideOnTouch(true);
            playerView = simplePlayerView;
        }

        // Add to container
        FrameLayout.LayoutParams layoutParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        playerView.setLayoutParams(layoutParams);
        container.addView(playerView);

        // Add watermark overlay on top (optional by default)
        watermarkOverlay = new WatermarkOverlayView(context);
        watermarkOverlay.setLayoutParams(new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));
        watermarkOverlay.setAlphaFactor(0.3f);
        container.addView(watermarkOverlay);

        // Add Cast button (top-right)
        castButton = new MediaRouteButton(context);
        FrameLayout.LayoutParams castLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        castLp.gravity = Gravity.TOP | Gravity.END;
        castLp.topMargin = 16; castLp.rightMargin = 16;
        castButton.setLayoutParams(castLp);
        try { CastButtonFactory.setUpMediaRouteButton(context, castButton); } catch (Exception ignored) {}
        container.addView(castButton);

        // Stop Cast pill button (hidden until session active)
        stopCastBtn = new AppCompatButton(context);
        stopCastBtn.setText("Stop Casting");
        FrameLayout.LayoutParams stopLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        stopLp.gravity = Gravity.TOP | Gravity.END;
        stopLp.topMargin = 72; stopLp.rightMargin = 16;
        stopCastBtn.setLayoutParams(stopLp);
        stopCastBtn.setVisibility(View.GONE);
        stopCastBtn.setOnClickListener(v -> { if (castManager != null) castManager.stopCasting(); });
        container.addView(stopCastBtn);

        // Subtitle toggle button (cycles through tracks)
        subtitleBtn = new AppCompatTextView(context);
        subtitleBtn.setText("CC");
        subtitleBtn.setPadding(20, 10, 20, 10);
        subtitleBtn.setBackgroundColor(0x66000000);
        subtitleBtn.setTextColor(0xFFFFFFFF);
        FrameLayout.LayoutParams subLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        subLp.gravity = Gravity.TOP | Gravity.END;
        subLp.topMargin = 128; subLp.rightMargin = 16;
        subtitleBtn.setLayoutParams(subLp);
        subtitleBtn.setOnClickListener(v -> cycleSubtitle());
        container.addView(subtitleBtn);

        // Start progress updates
        startProgressUpdates();

        // Schedule watermark movement
        scheduleWatermark();

        updateState(PlayerState.IDLE);
    }

    /**
     * Apply configuration to the player
     */
    private void applyConfiguration() {
        if (configuration == null) return;

        exoPlayer.setVolume(configuration.volume);
        exoPlayer.setPlaybackParameters(new PlaybackParameters(configuration.playbackSpeed));
        
        if (configuration.loop) {
            exoPlayer.setRepeatMode(Player.REPEAT_MODE_ALL);
        } else {
            exoPlayer.setRepeatMode(Player.REPEAT_MODE_OFF);
        }

        if (configuration.muted) {
            exoPlayer.setVolume(0f);
        }

        if (configuration.debug) {
            enableDebugLogging();
        }
    }

    /**
     * Load media source
     * @param source Media source information
     */
    public void load(@NonNull MediaSourceInfo source) {
        currentSource = source;
        updateState(PlayerState.LOADING);

        Uri uri = Uri.parse(source.url);
        MediaSource mediaSource = createMediaSource(uri, source);

        exoPlayer.setMediaSource(mediaSource);
        exoPlayer.prepare();

        // Apply start time if configured
        if (configuration.startTime > 0) {
            seekTo(configuration.startTime);
        }

        // Auto-play if configured
        if (configuration.autoPlay) {
            play();
        }

        // Load subtitles if provided
        if (source.subtitles != null && !source.subtitles.isEmpty()) {
            loadSubtitles(source.subtitles);
        }
    }

    /**
     * Load media from URL
     * @param url Media URL
     */
    public void load(@NonNull String url) {
        MediaSourceInfo source = new MediaSourceInfo(url);
        load(source);
    }

    /**
     * Create ExoPlayer MediaSource
     */
    private MediaSource createMediaSource(Uri uri, MediaSourceInfo source) {
        DefaultDataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(context);

        // Configure DRM if needed
        DrmSessionManagerProvider drmSessionManagerProvider = null;
        if (source.drm != null) {
            drmSessionManagerProvider = createDrmSessionManagerProvider(source.drm);
        }

        MediaItem.Builder mediaItemBuilder = new MediaItem.Builder().setUri(uri);

        // Add DRM configuration
        if (source.drm != null) {
            MediaItem.DrmConfiguration drmConfig = new MediaItem.DrmConfiguration.Builder(getDrmUuid(source.drm.type))
                .setLicenseUri(source.drm.licenseUrl)
                .setMultiSession(source.drm.multiSession)
                .setForceDefaultLicenseUri(source.drm.forceDefaultLicenseUri)
                .setLicenseRequestHeaders(source.drm.headers != null ? source.drm.headers : new HashMap<>())
                .build();
            mediaItemBuilder.setDrmConfiguration(drmConfig);
        }

        // Attach side-loaded subtitles if provided
        if (source.subtitles != null && !source.subtitles.isEmpty()) {
            List<MediaItem.SubtitleConfiguration> subs = new ArrayList<>();
            for (SubtitleTrack st : source.subtitles) {
                MediaItem.SubtitleConfiguration subCfg = new MediaItem.SubtitleConfiguration.Builder(Uri.parse(st.url))
                        .setMimeType(st.mimeType != null ? st.mimeType : MimeTypes.TEXT_VTT)
                        .setLanguage(st.language)
                        .setLabel(st.label)
                        .build();
                subs.add(subCfg);
            }
            mediaItemBuilder.setSubtitleConfigurations(subs);
        }

        MediaItem mediaItem = mediaItemBuilder.build();

        // Create appropriate media source based on type
        String type = source.type != null ? source.type : MediaSourceInfo.detectType(source.url);

        switch (type) {
            case "hls":
                HlsMediaSource.Factory hlsFactory = new HlsMediaSource.Factory(dataSourceFactory);
                if (drmSessionManagerProvider != null) {
                    hlsFactory.setDrmSessionManagerProvider(drmSessionManagerProvider);
                }
                return hlsFactory.createMediaSource(mediaItem);

            case "dash":
                DashMediaSource.Factory dashFactory = new DashMediaSource.Factory(dataSourceFactory);
                if (drmSessionManagerProvider != null) {
                    dashFactory.setDrmSessionManagerProvider(drmSessionManagerProvider);
                }
                return dashFactory.createMediaSource(mediaItem);

            case "smoothstreaming":
                SsMediaSource.Factory ssFactory = new SsMediaSource.Factory(dataSourceFactory);
                if (drmSessionManagerProvider != null) {
                    ssFactory.setDrmSessionManagerProvider(drmSessionManagerProvider);
                }
                return ssFactory.createMediaSource(mediaItem);

            default:
                ProgressiveMediaSource.Factory progressiveFactory = new ProgressiveMediaSource.Factory(dataSourceFactory);
                if (drmSessionManagerProvider != null) {
                    progressiveFactory.setDrmSessionManagerProvider(drmSessionManagerProvider);
                }
                return progressiveFactory.createMediaSource(mediaItem);
        }
    }

    /**
     * Create DRM Session Manager Provider
     */
    private DrmSessionManagerProvider createDrmSessionManagerProvider(DRMConfiguration drm) {
        HttpMediaDrmCallback drmCallback = new HttpMediaDrmCallback(
            drm.licenseUrl,
            new DefaultHttpDataSource.Factory()
        );

        if (drm.headers != null) {
            for (Map.Entry<String, String> entry : drm.headers.entrySet()) {
                drmCallback.setKeyRequestProperty(entry.getKey(), entry.getValue());
            }
        }

        return new DrmSessionManagerProvider() {
            @Override
            public DrmSessionManager get(MediaItem mediaItem) {
                DefaultDrmSessionManager drmSessionManager = new DefaultDrmSessionManager.Builder()
                    .setUuidAndExoMediaDrmProvider(
                        getDrmUuid(drm.type),
                        FrameworkMediaDrm.DEFAULT_PROVIDER
                    )
                    .build(drmCallback);

                drmSessionManager.setMode(DefaultDrmSessionManager.MODE_PLAYBACK, new byte[0]);
                return drmSessionManager;
            }
        };
    }

    /**
     * Get DRM UUID from type
     */
    private UUID getDrmUuid(String drmType) {
        switch (drmType.toLowerCase()) {
            case "widevine":
                return C.WIDEVINE_UUID;
            case "playready":
                return C.PLAYREADY_UUID;
            case "clearkey":
                return C.CLEARKEY_UUID;
            default:
                return C.WIDEVINE_UUID;
        }
    }

    /**
     * Load subtitles
     */
    private void loadSubtitles(List<SubtitleTrack> subtitles) {
        // Subtitles are attached via MediaItem subtitle configurations in createMediaSource.
        for (SubtitleTrack subtitle : subtitles) {
            Log.d(TAG, "Subtitle configured: " + subtitle.label + " (" + subtitle.language + ")");
        }
    }

    // Playback Control Methods

    public void play() {
        exoPlayer.play();
        isPlaying = true;
        updateState(PlayerState.PLAYING);
        if (configuration != null && configuration.allowBackgroundPlayback) {
            try { PlaybackService.start(context); } catch (Exception ignored) {}
        }
        if (eventListener != null) eventListener.onPlay();
    }

    public void pause() {
        exoPlayer.pause();
        isPlaying = false;
        updateState(PlayerState.PAUSED);
        if (configuration != null && configuration.allowBackgroundPlayback) {
            try { PlaybackService.start(context); } catch (Exception ignored) {}
        }
        if (eventListener != null) eventListener.onPause();
    }

    public void stop() {
        exoPlayer.stop();
        exoPlayer.seekTo(0);
        isPlaying = false;
        updateState(PlayerState.IDLE);
    }

    public void togglePlayPause() {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }

    public void seekTo(long position) {
        updateState(PlayerState.SEEKING);
        exoPlayer.seekTo(position);
        if (eventListener != null) eventListener.onSeek(position);
    }

    public void seekForward(int seconds) {
        long newPosition = currentPosition + (seconds * 1000);
        seekTo(Math.min(newPosition, duration));
    }

    public void seekBackward(int seconds) {
        long newPosition = currentPosition - (seconds * 1000);
        seekTo(Math.max(newPosition, 0));
    }

    // Volume Control

    public void setVolume(float volume) {
        float clampedVolume = Math.max(0f, Math.min(1f, volume));
        this.volume = clampedVolume;
        exoPlayer.setVolume(clampedVolume);
        if (eventListener != null) eventListener.onVolumeChange(clampedVolume);
    }

    public void mute() {
        exoPlayer.setVolume(0f);
    }

    public void unmute() {
        exoPlayer.setVolume(volume);
    }

    public void toggleMute() {
        if (exoPlayer.getVolume() == 0f) {
            unmute();
        } else {
            mute();
        }
    }

    // Playback Speed

    public void setPlaybackSpeed(float speed) {
        exoPlayer.setPlaybackParameters(new PlaybackParameters(speed));
    }

    public float getPlaybackSpeed() {
        return exoPlayer.getPlaybackParameters().speed;
    }

    // Quality Selection

    public void setVideoQuality(String quality) {
        DefaultTrackSelector.Parameters.Builder parametersBuilder = trackSelector.buildUponParameters();

        switch (quality) {
            case "auto":
                trackSelector.setParameters(parametersBuilder.clearVideoSizeConstraints().build());
                break;
            case "hd":
                trackSelector.setParameters(
                    parametersBuilder
                        .setMaxVideoSize(1920, 1080)
                        .setMinVideoSize(1280, 720)
                        .build()
                );
                break;
            case "sd":
                trackSelector.setParameters(parametersBuilder.setMaxVideoSizeSd().build());
                break;
            case "low":
                trackSelector.setParameters(
                    parametersBuilder.setMaxVideoSize(854, 480).build()
                );
                break;
        }
    }

    // State Management

    private void updateState(PlayerState newState) {
        state = newState;
        if (eventListener != null) eventListener.onStateChange(newState);
        trackAnalytics("statechange", new HashMap<String, Object>() {{ put("state", newState.name()); }});

        if (configuration.debug) {
            Log.d(TAG, "State changed to: " + newState);
        }
    }

    // Progress Updates

    private void startProgressUpdates() {
        updateProgressHandler = new Runnable() {
            @Override
            public void run() {
                if (exoPlayer != null) {
                    currentPosition = exoPlayer.getCurrentPosition();
                    bufferedPosition = exoPlayer.getBufferedPosition();
                    duration = exoPlayer.getDuration();

                    if (eventListener != null) {
                        eventListener.onTimeUpdate(currentPosition);
                        eventListener.onProgress(bufferedPosition);
                    }
                }
                mainHandler.postDelayed(this, 100);
            }
        };
        mainHandler.post(updateProgressHandler);
    }

    private void stopProgressUpdates() {
        if (updateProgressHandler != null) {
            mainHandler.removeCallbacks(updateProgressHandler);
        }
        if (watermarkRandomizer != null) {
            mainHandler.removeCallbacks(watermarkRandomizer);
        }
    }

    private void scheduleWatermark() {
        if (watermarkOverlay == null) return;
        watermarkRandomizer = new Runnable() {
            @Override
            public void run() {
                try {
                    watermarkOverlay.randomize();
                } catch (Exception ignored) {}
                mainHandler.postDelayed(this, 5000);
            }
        };
        mainHandler.postDelayed(watermarkRandomizer, 5000);
    }

    // Player Event Listener

    private final Player.Listener playerEventListener = new Player.Listener() {
        @Override
        public void onPlaybackStateChanged(int playbackState) {
            switch (playbackState) {
                case Player.STATE_IDLE:
                    updateState(PlayerState.IDLE);
                    break;
                case Player.STATE_BUFFERING:
                    updateState(PlayerState.BUFFERING);
                    if (eventListener != null) eventListener.onBuffering(true);
                    break;
                case Player.STATE_READY:
                    if (state == PlayerState.LOADING || state == PlayerState.BUFFERING) {
                        updateState(PlayerState.READY);
                        if (eventListener != null) {
                            eventListener.onReady();
                            emitLoadedMetadata();
                        }
                    }
                    if (state == PlayerState.BUFFERING && eventListener != null) {
                        eventListener.onBuffering(false);
                    }
                    if (exoPlayer.isPlaying()) {
                        updateState(PlayerState.PLAYING);
                    }
                    break;
                case Player.STATE_ENDED:
                    updateState(PlayerState.ENDED);
                    if (eventListener != null) eventListener.onEnded();

                    if (configuration.loop) {
                        seekTo(0);
                        play();
                    }
                    break;
            }
        }

        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            UnifiedVideoPlayer.this.isPlaying = isPlaying;
            if (isPlaying) {
                updateState(PlayerState.PLAYING);
                trackAnalytics("play", null);
            } else if (state == PlayerState.PLAYING) {
                updateState(PlayerState.PAUSED);
                trackAnalytics("pause", null);
            }
        }

        @Override
        public void onPlayerError(PlaybackException error) {
            updateState(PlayerState.ERROR);
            if (eventListener != null) eventListener.onError(error);
            trackAnalytics("error", new HashMap<String, Object>() {{ put("message", error.getMessage()); }});

            if (configuration.debug) {
                Log.e(TAG, "Player error: " + error.getMessage(), error);
            }
        }

        @Override
        public void onVideoSizeChanged(VideoSize videoSize) {
            if (eventListener != null) {
                eventListener.onVideoSizeChanged(videoSize.width, videoSize.height);
            }
        }

        @Override
        public void onRenderedFirstFrame() {
            Log.d(TAG, "First frame rendered");
        }
    };

    // Analytics Listener

    private final AnalyticsListener analyticsListener = new AnalyticsListener() {
        @Override
        public void onLoadCompleted(AnalyticsListener.EventTime eventTime, LoadEventInfo loadEventInfo, MediaLoadData mediaLoadData) {
            Log.d(TAG, "Load completed: " + loadEventInfo.dataSpec.uri);
        }

        @Override
        public void onBandwidthEstimate(AnalyticsListener.EventTime eventTime, int totalLoadTimeMs, long totalBytesLoaded, long bitrateEstimate) {
            if (configuration.debug) {
                Log.d(TAG, "Bandwidth estimate: " + bitrateEstimate + " bps");
            }
        }
    };

    private void emitLoadedMetadata() {
        Map<String, Object> metadata = new HashMap<>();

        if (exoPlayer != null) {
            metadata.put("duration", exoPlayer.getDuration());

            if (exoPlayer.getVideoFormat() != null) {
                metadata.put("width", exoPlayer.getVideoFormat().width);
                metadata.put("height", exoPlayer.getVideoFormat().height);
                metadata.put("frameRate", exoPlayer.getVideoFormat().frameRate);
                metadata.put("bitrate", exoPlayer.getVideoFormat().bitrate);
                metadata.put("codec", exoPlayer.getVideoFormat().codecs != null ? exoPlayer.getVideoFormat().codecs : "");
            }

            if (exoPlayer.getAudioFormat() != null) {
                metadata.put("audioChannels", exoPlayer.getAudioFormat().channelCount);
                metadata.put("audioSampleRate", exoPlayer.getAudioFormat().sampleRate);
                metadata.put("audioCodec", exoPlayer.getAudioFormat().codecs != null ? exoPlayer.getAudioFormat().codecs : "");
            }
        }

        if (eventListener != null) {
            eventListener.onLoadedMetadata(metadata);
        }
        trackAnalytics("loadedmetadata", metadata);
    }

    // Surface Control (for advanced use cases)

    public void setVideoSurface(Surface surface) {
        exoPlayer.setVideoSurface(surface);
    }

    public void clearVideoSurface() {
        exoPlayer.clearVideoSurface();
    }

    // Debug

    private void enableDebugLogging() {
        Log.d(TAG, "Debug mode enabled");
        Log.d(TAG, "Configuration: " + configuration);
    }

    // Lifecycle Management

    public void onResume() {
        if (exoPlayer != null && state == PlayerState.PLAYING) {
            exoPlayer.play();
        }
    }

    /** Enter Picture-in-Picture mode (requires host Activity with android:supportsPictureInPicture="true"). */
    public boolean enterPictureInPicture(@NonNull Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                PendingIntent playPi = PendingIntent.getBroadcast(activity, 200,
                        new Intent("com.unifiedvideo.player.ACTION_PLAY"), Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                PendingIntent pausePi = PendingIntent.getBroadcast(activity, 201,
                        new Intent("com.unifiedvideo.player.ACTION_PAUSE"), Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);

                RemoteAction playAction = new RemoteAction(
                        Icon.createWithResource(activity, android.R.drawable.ic_media_play),
                        "Play",
                        "Play",
                        playPi
                );
                RemoteAction pauseAction = new RemoteAction(
                        Icon.createWithResource(activity, android.R.drawable.ic_media_pause),
                        "Pause",
                        "Pause",
                        pausePi
                );

                PictureInPictureParams params = new PictureInPictureParams.Builder()
                        .setAspectRatio(new Rational(16, 9))
                        .setActions(java.util.Arrays.asList(playAction, pauseAction))
                        .build();
                activity.enterPictureInPictureMode(params);
                return true;
            } catch (Exception e) {
                Log.w(TAG, "PiP entry failed", e);
            }
        }
        return false;
    }

    public void onPause() {
        if (!configuration.allowBackgroundPlayback && exoPlayer != null) {
            exoPlayer.pause();
        }
    }

    public void onStop() {
        if (!configuration.allowBackgroundPlayback && exoPlayer != null) {
            exoPlayer.stop();
        }
    }

    // Cleanup

    public void release() {
        stopProgressUpdates();
        try { PlaybackService.stop(context); } catch (Exception ignored) {}

        if (exoPlayer != null) {
            exoPlayer.removeListener(playerEventListener);
            exoPlayer.removeAnalyticsListener(analyticsListener);
            exoPlayer.release();
        }

        if (playerView != null && container != null) {
            container.removeView(playerView);
        }

        exoPlayer = null;
        playerView = null;
        container = null;

        updateState(PlayerState.IDLE);
    }

    // Getters

    public PlayerState getState() {
        return state;
    }

    public boolean isPlaying() {
        return isPlaying;
    }

    public long getDuration() {
        return duration;
    }

    public long getCurrentPosition() {
        return currentPosition;
    }

    public long getBufferedPosition() {
        return bufferedPosition;
    }

    public float getVolume() {
        return volume;
    }

    // Theming & Watermark
    public void setThemeColors(int accentStart, int accentEnd) {
        if (watermarkOverlay != null) {
            watermarkOverlay.setAccentColors(accentStart, accentEnd);
        }
    }

    public void setWatermarkEnabled(boolean enabled) {
        if (watermarkOverlay != null) {
            watermarkOverlay.setVisibility(enabled ? View.VISIBLE : View.GONE);
        }
    }

    // Analytics wiring
    public void addAnalyticsProvider(AnalyticsProvider provider) {
        if (provider != null) analyticsProviders.add(provider);
    }

    public void setAnalyticsProviders(List<AnalyticsProvider> providers) {
        analyticsProviders.clear();
        if (providers != null) analyticsProviders.addAll(providers);
    }

    private void trackAnalytics(String event, Map<String, Object> data) {
        if (analyticsProviders.isEmpty()) return;
        Map<String, Object> payload = new HashMap<>();
        if (data != null) payload.putAll(data);
        payload.put("timestamp", System.currentTimeMillis());
        payload.put("position", currentPosition);
        payload.put("duration", duration);
        for (AnalyticsProvider p : analyticsProviders) {
            try {
                p.track(event, payload);
            } catch (Exception ignored) {}
        }
    }

    // Casting API
    public void enableCasting() {
        if (castManager == null) castManager = new CastManager();
        if (castSessionListener == null) {
            castSessionListener = new SessionManagerListener<CastSession>() {
                @Override public void onSessionStarted(CastSession session, String s) { updateCastUi(true); }
                @Override public void onSessionResumed(CastSession session, boolean b) { updateCastUi(true); }
                @Override public void onSessionEnded(CastSession session, int i) { updateCastUi(false); }
                @Override public void onSessionSuspended(CastSession session, int i) { updateCastUi(false); }
                @Override public void onSessionStarting(CastSession session) {}
                @Override public void onSessionResuming(CastSession session, String s) {}
                @Override public void onSessionEnding(CastSession session) {}
                @Override public void onSessionResumeFailed(CastSession session, int i) {}
                @Override public void onSessionStartFailed(CastSession session, int i) { updateCastUi(false); }
            };
        }
        castManager.addSessionManagerListener(castSessionListener);
    }

    private void updateCastUi(boolean connected) {
        if (stopCastBtn != null) {
            stopCastBtn.post(() -> stopCastBtn.setVisibility(connected ? View.VISIBLE : View.GONE));
        }
    }

    public boolean isCastingAvailable() {
        if (castManager == null) return false;
        return castManager.hasSession();
    }

    public void castCurrentMedia() {
        if (castManager == null || currentSource == null) return;
        String ct = inferContentType(currentSource);
        List<SubtitleItem> subs = null;
        if (currentSource.subtitles != null && !currentSource.subtitles.isEmpty()) {
            subs = new ArrayList<>();
            for (SubtitleTrack st : currentSource.subtitles) {
                subs.add(new SubtitleItem(st.url, st.language, st.label, st.mimeType));
            }
        }
        castManager.startCasting(currentSource.url, ct, currentSource.metadata != null ? String.valueOf(currentSource.metadata.get("title")) : null, subs, null);
    }

    private String inferContentType(MediaSourceInfo src) {
        String u = src.url != null ? src.url.toLowerCase() : "";
        if (u.endsWith(".m3u8")) return "application/x-mpegURL";
        if (u.endsWith(".mpd")) return "application/dash+xml";
        if (u.endsWith(".webm")) return "video/webm";
        return "video/mp4";
    }
    // Subtitle selection helpers
    private int subtitleIndex = -1; // -1 off
    private void cycleSubtitle() {
        if (currentSource == null || currentSource.subtitles == null || currentSource.subtitles.isEmpty()) {
            // toggle off/on no-op
            disableSubtitles();
            return;
        }
        subtitleIndex++;
        if (subtitleIndex >= currentSource.subtitles.size()) subtitleIndex = -1; // off
        if (subtitleIndex == -1) {
            disableSubtitles();
        } else {
            SubtitleTrack st = currentSource.subtitles.get(subtitleIndex);
            setSubtitleLanguage(st.language);
        }
    }

    public void setSubtitleLanguage(String language) {
        try {
            exoPlayer.setTrackSelectionParameters(
                exoPlayer.getTrackSelectionParameters().buildUpon()
                    .setPreferredTextLanguage(language)
                    .setSelectUndeterminedTextLanguage(true)
                    .build()
            );
        } catch (Exception ignored) {}
    }

    public void disableSubtitles() {
        try {
            exoPlayer.setTrackSelectionParameters(
                exoPlayer.getTrackSelectionParameters().buildUpon()
                    .setPreferredTextLanguage(null)
                    .build()
            );
        } catch (Exception ignored) {}
    }
}
