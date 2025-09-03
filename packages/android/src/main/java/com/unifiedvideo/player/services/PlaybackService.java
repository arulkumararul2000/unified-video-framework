package com.unifiedvideo.player.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import com.google.android.exoplayer2.ExoPlayer;

/**
 * Foreground service for background playback. Minimal implementation.
 */
public class PlaybackService extends Service {
    private static final String CHANNEL_ID = "uvf_playback";
    private static final int NOTIFICATION_ID = 1001;

    private MediaSessionCompat mediaSession;

    @Override
    public void onCreate() {
        super.onCreate();
        mediaSession = new MediaSessionCompat(this, "UVF-Player");
        mediaSession.setActive(true);
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
    }

    private Notification buildNotification() {
        ExoPlayer player = PlayerHolder.getPlayer();
        boolean isPlaying = player != null && player.isPlaying();

        PlaybackStateCompat state = new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE)
                .setState(isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, player != null ? player.getCurrentPosition() : 0, 1.0f)
                .build();
        mediaSession.setPlaybackState(state);

        PendingIntent playIntent = PendingIntent.getBroadcast(this, 100,
                new Intent("com.unifiedvideo.player.ACTION_PLAY"), Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent pauseIntent = PendingIntent.getBroadcast(this, 101,
                new Intent("com.unifiedvideo.player.ACTION_PAUSE"), Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);

        NotificationCompat.Action playAction = new NotificationCompat.Action(android.R.drawable.ic_media_play, "Play", playIntent);
        NotificationCompat.Action pauseAction = new NotificationCompat.Action(android.R.drawable.ic_media_pause, "Pause", pauseIntent);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle("Playing video")
                .setContentText("Unified Video Player")
                .setOngoing(isPlaying)
                .addAction(isPlaying ? pauseAction : playAction)
                .setStyle(new MediaStyle().setMediaSession(mediaSession.getSessionToken()).setShowActionsInCompactView(0));

        return builder.build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(channel);
        }
    }

    // Static helpers
    public static void start(Context ctx) {
        Intent i = new Intent(ctx, PlaybackService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(i);
        } else {
            ctx.startService(i);
        }
    }

    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, PlaybackService.class));
    }
}

