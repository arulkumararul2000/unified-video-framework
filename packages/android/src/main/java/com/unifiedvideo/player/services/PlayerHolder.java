package com.unifiedvideo.player.services;

import com.google.android.exoplayer2.ExoPlayer;

/**
 * Holds a reference to the current ExoPlayer for background service and PiP actions.
 */
public class PlayerHolder {
    private static volatile ExoPlayer player;

    public static void setPlayer(ExoPlayer p) {
        player = p;
    }

    public static ExoPlayer getPlayer() {
        return player;
    }
}

