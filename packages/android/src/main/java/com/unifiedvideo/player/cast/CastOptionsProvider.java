package com.unifiedvideo.player.cast;

import android.content.Context;

import com.google.android.gms.cast.framework.CastOptions;
import com.google.android.gms.cast.framework.OptionsProvider;
import com.google.android.gms.cast.framework.SessionProvider;

import java.util.List;

/**
 * Provides CastOptions to the Cast framework. Referenced from AndroidManifest.
 */
public class CastOptionsProvider implements OptionsProvider {
    @Override
    public CastOptions getCastOptions(Context context) {
        // Use default media receiver; apps can replace via setter in CastManager
        String receiverAppId = com.google.android.gms.cast.framework.media.CastMediaOptions.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID;
        return new CastOptions.Builder()
                .setReceiverApplicationId(receiverAppId)
                .build();
    }

    @Override
    public List<SessionProvider> getAdditionalSessionProviders(Context context) {
        return null;
    }
}

