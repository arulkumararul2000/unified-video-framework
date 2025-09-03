package com.unifiedvideo.player.analytics;

import java.util.Map;

public interface AnalyticsProvider {
    String getName();
    void track(String event, Map<String, Object> data);
}

