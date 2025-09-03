/**
 * PlayerConfiguration.java
 * Player configuration for UnifiedVideoPlayer
 */

package com.unifiedvideo.player;

/**
 * Player configuration class
 */
public class PlayerConfiguration {
    public final boolean autoPlay;
    public final boolean controls;
    public final boolean muted;
    public final boolean loop;
    public final String preload;
    public final long startTime;
    public final float playbackSpeed;
    public final float volume;
    public final boolean debug;
    public final boolean useStyledControls;
    public final boolean allowBackgroundPlayback;

    private PlayerConfiguration(Builder builder) {
        this.autoPlay = builder.autoPlay;
        this.controls = builder.controls;
        this.muted = builder.muted;
        this.loop = builder.loop;
        this.preload = builder.preload;
        this.startTime = builder.startTime;
        this.playbackSpeed = builder.playbackSpeed;
        this.volume = builder.volume;
        this.debug = builder.debug;
        this.useStyledControls = builder.useStyledControls;
        this.allowBackgroundPlayback = builder.allowBackgroundPlayback;
    }

    /**
     * Builder class for PlayerConfiguration
     */
    public static class Builder {
        private boolean autoPlay = false;
        private boolean controls = true;
        private boolean muted = false;
        private boolean loop = false;
        private String preload = "auto";
        private long startTime = 0;
        private float playbackSpeed = 1.0f;
        private float volume = 1.0f;
        private boolean debug = false;
        private boolean useStyledControls = true;
        private boolean allowBackgroundPlayback = false;

        public Builder() {
        }

        public Builder setAutoPlay(boolean autoPlay) {
            this.autoPlay = autoPlay;
            return this;
        }

        public Builder setControls(boolean controls) {
            this.controls = controls;
            return this;
        }

        public Builder setMuted(boolean muted) {
            this.muted = muted;
            return this;
        }

        public Builder setLoop(boolean loop) {
            this.loop = loop;
            return this;
        }

        public Builder setPreload(String preload) {
            this.preload = preload;
            return this;
        }

        public Builder setStartTime(long startTime) {
            this.startTime = startTime;
            return this;
        }

        public Builder setPlaybackSpeed(float speed) {
            this.playbackSpeed = speed;
            return this;
        }

        public Builder setVolume(float volume) {
            this.volume = volume;
            return this;
        }

        public Builder setDebug(boolean debug) {
            this.debug = debug;
            return this;
        }

        public Builder setUseStyledControls(boolean styled) {
            this.useStyledControls = styled;
            return this;
        }

        public Builder setAllowBackgroundPlayback(boolean allow) {
            this.allowBackgroundPlayback = allow;
            return this;
        }

        public PlayerConfiguration build() {
            return new PlayerConfiguration(this);
        }
    }

    @Override
    public String toString() {
        return "PlayerConfiguration{" +
                "autoPlay=" + autoPlay +
                ", controls=" + controls +
                ", muted=" + muted +
                ", loop=" + loop +
                ", preload='" + preload + '\'' +
                ", startTime=" + startTime +
                ", playbackSpeed=" + playbackSpeed +
                ", volume=" + volume +
                ", debug=" + debug +
                ", useStyledControls=" + useStyledControls +
                ", allowBackgroundPlayback=" + allowBackgroundPlayback +
                '}';
    }
}

/**
 * Media source information class
 */
class MediaSourceInfo {
    public final String url;
    public final String type;
    public final DRMConfiguration drm;
    public final java.util.Map<String, Object> metadata;
    public final java.util.List<SubtitleTrack> subtitles;

    public MediaSourceInfo(String url) {
        this(url, detectType(url), null, null, null);
    }

    public MediaSourceInfo(String url, String type) {
        this(url, type, null, null, null);
    }

    public MediaSourceInfo(String url, String type, DRMConfiguration drm, 
                          java.util.Map<String, Object> metadata, 
                          java.util.List<SubtitleTrack> subtitles) {
        this.url = url;
        this.type = type;
        this.drm = drm;
        this.metadata = metadata;
        this.subtitles = subtitles;
    }

    public static String detectType(String url) {
        if (url.contains(".m3u8")) return "hls";
        if (url.contains(".mpd")) return "dash";
        if (url.contains(".ism")) return "smoothstreaming";
        if (url.contains(".mp4")) return "mp4";
        if (url.contains(".webm")) return "webm";
        if (url.contains(".mkv")) return "mkv";
        return "mp4";
    }
}

/**
 * DRM configuration class
 */
class DRMConfiguration {
    public final String type; // widevine, playready, clearkey
    public final String licenseUrl;
    public final java.util.Map<String, String> headers;
    public final boolean multiSession;
    public final boolean forceDefaultLicenseUri;

    public DRMConfiguration(String type, String licenseUrl) {
        this(type, licenseUrl, null, false, false);
    }

    public DRMConfiguration(String type, String licenseUrl, 
                           java.util.Map<String, String> headers,
                           boolean multiSession, 
                           boolean forceDefaultLicenseUri) {
        this.type = type;
        this.licenseUrl = licenseUrl;
        this.headers = headers;
        this.multiSession = multiSession;
        this.forceDefaultLicenseUri = forceDefaultLicenseUri;
    }
}

/**
 * Subtitle track class
 */
class SubtitleTrack {
    public final String url;
    public final String language;
    public final String label;
    public final String kind; // subtitles, captions
    public final String mimeType;

    public SubtitleTrack(String url, String language, String label) {
        this(url, language, label, "subtitles", "text/vtt");
    }

    public SubtitleTrack(String url, String language, String label, String kind, String mimeType) {
        this.url = url;
        this.language = language;
        this.label = label;
        this.kind = kind;
        this.mimeType = mimeType;
    }
}
