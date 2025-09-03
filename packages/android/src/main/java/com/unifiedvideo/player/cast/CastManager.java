package com.unifiedvideo.player.cast;

import android.net.Uri;
import android.util.Log;

import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.SessionManagerListener;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;

import java.util.ArrayList;
import java.util.List;

/**
 * Minimal Cast manager to load media on a remote receiver.
 * Host app is expected to provide a Cast button via CastButtonFactory.
 */
public class CastManager {
    private static final String TAG = "UVF-CastManager";

    private final CastContext castContext;

    public CastManager() {
        this.castContext = CastContext.getSharedInstance();
    }

    public boolean hasSession() {
        CastSession session = castContext.getSessionManager().getCurrentCastSession();
        return session != null && session.isConnected();
    }

    public void startCasting(String url, String contentType, String title, List<SubtitleItem> subtitles, String activeSubtitleLabel) {
        try {
            CastSession session = castContext.getSessionManager().getCurrentCastSession();
            if (session == null) {
                Log.w(TAG, "No Cast session available");
                return;
            }
            RemoteMediaClient rmc = session.getRemoteMediaClient();
            if (rmc == null) {
                Log.w(TAG, "RemoteMediaClient is null");
                return;
            }

            MediaMetadata md = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MOVIE);
            md.putString(MediaMetadata.KEY_TITLE, title != null ? title : "Unified Player");

            MediaInfo.Builder mediaInfo = new MediaInfo.Builder(url)
                    .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                    .setContentType(contentType)
                    .setMetadata(md);

            // Subtitles
            if (subtitles != null && !subtitles.isEmpty()) {
                List<com.google.android.gms.cast.media.Track> tracks = new ArrayList<>();
                long nextId = 1;
                Long activeId = null;
                for (SubtitleItem sub : subtitles) {
                    com.google.android.gms.cast.media.Track t =
                            new com.google.android.gms.cast.media.Track.Builder(nextId, com.google.android.gms.cast.media.Track.TYPE_TEXT)
                                    .setSubtype(com.google.android.gms.cast.media.Track.SUBTYPE_SUBTITLES)
                                    .setContentId(sub.url)
                                    .setContentType(sub.contentType != null ? sub.contentType : inferSubtitleContentType(sub.url))
                                    .setLanguage(sub.language)
                                    .setName(sub.label != null ? sub.label : sub.language)
                                    .build();
                    if (sub.label != null && sub.label.equalsIgnoreCase(activeSubtitleLabel)) {
                        activeId = nextId;
                    }
                    tracks.add(t);
                    nextId++;
                }
                mediaInfo.setMediaTracks(tracks);

                MediaLoadRequestData.Builder load = new MediaLoadRequestData.Builder()
                        .setMediaInfo(mediaInfo.build())
                        .setAutoplay(true);
                if (activeId != null) {
                    List<Long> activeTrackIds = new ArrayList<>();
                    activeTrackIds.add(activeId);
                    load.setActiveTrackIds(activeTrackIds);
                }
                rmc.load(load.build());
            } else {
                rmc.load(new MediaLoadRequestData.Builder()
                        .setMediaInfo(mediaInfo.build())
                        .setAutoplay(true)
                        .build());
            }
        } catch (Exception e) {
            Log.e(TAG, "Cast load failed", e);
        }
    }

    public void stopCasting() {
        try {
            CastSession session = castContext.getSessionManager().getCurrentCastSession();
            if (session != null) {
                RemoteMediaClient rmc = session.getRemoteMediaClient();
                if (rmc != null) {
                    rmc.stop();
                }
                castContext.getSessionManager().endCurrentSession(true);
            }
        } catch (Exception ignored) {}
    }

    public void addSessionManagerListener(SessionManagerListener<CastSession> listener) {
        try { castContext.getSessionManager().addSessionManagerListener(listener, CastSession.class); } catch (Exception ignored) {}
    }

    public void removeSessionManagerListener(SessionManagerListener<CastSession> listener) {
        try { castContext.getSessionManager().removeSessionManagerListener(listener, CastSession.class); } catch (Exception ignored) {}
    }

    private String inferSubtitleContentType(String url) {
        String u = url != null ? url.toLowerCase() : "";
        if (u.endsWith(".vtt")) return "text/vtt";
        if (u.endsWith(".srt")) return "application/x-subrip";
        if (u.endsWith(".ttml") || u.endsWith(".dfxp") || u.endsWith(".xml")) return "application/ttml+xml";
        return "text/vtt";
    }

    public static class SubtitleItem {
        public final String url;
        public final String language;
        public final String label;
        public final String contentType;

        public SubtitleItem(String url, String language, String label, String contentType) {
            this.url = url;
            this.language = language;
            this.label = label;
            this.contentType = contentType;
        }
    }
}

