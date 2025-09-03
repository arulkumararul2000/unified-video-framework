package com.unifiedvideo.player.pip;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.google.android.exoplayer2.ExoPlayer;
import com.unifiedvideo.player.services.PlayerHolder;

/**
 * Receives PiP action intents to control playback.
 */
public class PipActionReceiver extends BroadcastReceiver {
    public static final String ACTION_PLAY = "com.unifiedvideo.player.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.unifiedvideo.player.ACTION_PAUSE";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        ExoPlayer player = PlayerHolder.getPlayer();
        if (player == null) return;
        switch (intent.getAction()) {
            case ACTION_PLAY:
                try { player.play(); } catch (Exception e) { Log.w("PipAction", "play failed", e); }
                break;
            case ACTION_PAUSE:
                try { player.pause(); } catch (Exception e) { Log.w("PipAction", "pause failed", e); }
                break;
        }
    }
}

