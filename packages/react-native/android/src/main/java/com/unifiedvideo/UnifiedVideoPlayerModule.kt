package com.unifiedvideo

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.View
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.exoplayer2.*
import com.google.android.exoplayer2.analytics.AnalyticsListener
import com.google.android.exoplayer2.drm.DefaultDrmSessionManager
import com.google.android.exoplayer2.drm.DrmSessionManager
import com.google.android.exoplayer2.drm.FrameworkMediaDrm
import com.google.android.exoplayer2.drm.HttpMediaDrmCallback
import com.google.android.exoplayer2.source.MediaSource
import com.google.android.exoplayer2.source.ProgressiveMediaSource
import com.google.android.exoplayer2.source.dash.DashMediaSource
import com.google.android.exoplayer2.source.hls.HlsMediaSource
import com.google.android.exoplayer2.trackselection.AdaptiveTrackSelection
import com.google.android.exoplayer2.trackselection.DefaultTrackSelector
import com.google.android.exoplayer2.ui.PlayerView
import com.google.android.exoplayer2.upstream.DataSource
import com.google.android.exoplayer2.upstream.DefaultBandwidthMeter
import com.google.android.exoplayer2.upstream.DefaultDataSourceFactory
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource
import com.google.android.exoplayer2.util.MimeTypes
import com.google.android.exoplayer2.util.Util
import com.google.android.exoplayer2.video.VideoSize
import java.util.*
import kotlin.collections.ArrayList

class UnifiedVideoPlayerModule(private val reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext), Player.Listener, AnalyticsListener {

    private var exoPlayer: ExoPlayer? = null
    private var playerView: PlayerView? = null
    private var trackSelector: DefaultTrackSelector? = null
    private var dataSourceFactory: DataSource.Factory? = null
    private val handler = Handler(Looper.getMainLooper())
    private var progressRunnable: Runnable? = null
    private var currentSource: ReadableMap? = null
    private var availableQualities: ArrayList<VideoQuality> = ArrayList()
    private var currentQualityIndex = -1

    data class VideoQuality(
        val height: Int,
        val width: Int,
        val bitrate: Int,
        val label: String,
        val index: Int
    )

    override fun getName(): String = "UnifiedVideoPlayer"

    @ReactMethod
    fun initialize(config: ReadableMap) {
        handler.post {
            try {
                // Initialize ExoPlayer
                val bandwidthMeter = DefaultBandwidthMeter.Builder(reactContext).build()
                
                trackSelector = DefaultTrackSelector(
                    reactContext,
                    AdaptiveTrackSelection.Factory()
                ).apply {
                    setParameters(
                        buildUponParameters()
                            .setMaxVideoSizeSd()
                            .setAllowVideoMixedMimeTypeAdaptiveness(true)
                            .build()
                    )
                }

                exoPlayer = ExoPlayer.Builder(reactContext)
                    .setTrackSelector(trackSelector!!)
                    .setBandwidthMeter(bandwidthMeter)
                    .build()
                    .apply {
                        addListener(this@UnifiedVideoPlayerModule)
                        addAnalyticsListener(this@UnifiedVideoPlayerModule)
                    }

                // Initialize data source factory
                dataSourceFactory = DefaultDataSourceFactory(
                    reactContext,
                    Util.getUserAgent(reactContext, "UnifiedVideoPlayer")
                )

                sendEvent("onReady", null)
            } catch (e: Exception) {
                sendError("INIT_ERROR", "Failed to initialize player: ${e.message}")
            }
        }
    }

    @ReactMethod
    fun load(source: ReadableMap) {
        currentSource = source
        val url = source.getString("url") ?: run {
            sendError("INVALID_URL", "Video URL is required")
            return
        }

        handler.post {
            try {
                val uri = Uri.parse(url)
                val mediaSource = createMediaSource(uri, source)
                
                exoPlayer?.apply {
                    setMediaSource(mediaSource)
                    prepare()
                    
                    // Apply config if provided
                    source.getBoolean("autoPlay").let { autoPlay ->
                        playWhenReady = autoPlay
                    }
                }
                
                // Extract available qualities after loading
                extractQualities()
                
            } catch (e: Exception) {
                sendError("LOAD_ERROR", "Failed to load video: ${e.message}")
            }
        }
    }

    private fun createMediaSource(uri: Uri, source: ReadableMap): MediaSource {
        val drmSessionManager = if (source.hasKey("drm")) {
            createDrmSessionManager(source.getMap("drm")!!)
        } else {
            DrmSessionManager.DRM_UNSUPPORTED
        }

        return when (val type = Util.inferContentType(uri)) {
            C.TYPE_DASH -> {
                DashMediaSource.Factory(dataSourceFactory!!)
                    .setDrmSessionManager(drmSessionManager)
                    .createMediaSource(MediaItem.fromUri(uri))
            }
            C.TYPE_HLS -> {
                HlsMediaSource.Factory(dataSourceFactory!!)
                    .setDrmSessionManager(drmSessionManager)
                    .setAllowChunklessPreparation(true)
                    .createMediaSource(MediaItem.fromUri(uri))
            }
            C.TYPE_OTHER -> {
                ProgressiveMediaSource.Factory(dataSourceFactory!!)
                    .setDrmSessionManager(drmSessionManager)
                    .createMediaSource(MediaItem.fromUri(uri))
            }
            else -> {
                throw IllegalArgumentException("Unsupported type: $type")
            }
        }
    }

    private fun createDrmSessionManager(drmConfig: ReadableMap): DrmSessionManager {
        val licenseUrl = drmConfig.getString("licenseUrl") ?: throw IllegalArgumentException("License URL required")
        val drmType = drmConfig.getString("type") ?: "widevine"
        
        val drmSchemeUuid = when (drmType) {
            "widevine" -> C.WIDEVINE_UUID
            "playready" -> C.PLAYREADY_UUID
            "clearkey" -> C.CLEARKEY_UUID
            else -> throw IllegalArgumentException("Unsupported DRM type: $drmType")
        }

        val httpDataSourceFactory = DefaultHttpDataSource.Factory()
            .setUserAgent(Util.getUserAgent(reactContext, "UnifiedVideoPlayer"))

        // Add headers if provided
        if (drmConfig.hasKey("headers")) {
            val headers = drmConfig.getMap("headers")
            headers?.let { headerMap ->
                val httpHeaders = HashMap<String, String>()
                val iterator = headerMap.keySetIterator()
                while (iterator.hasNextKey()) {
                    val key = iterator.nextKey()
                    httpHeaders[key] = headerMap.getString(key) ?: ""
                }
                httpDataSourceFactory.setDefaultRequestProperties(httpHeaders)
            }
        }

        val drmCallback = HttpMediaDrmCallback(licenseUrl, httpDataSourceFactory)
        
        return DefaultDrmSessionManager.Builder()
            .setUuidAndExoMediaDrmProvider(drmSchemeUuid, FrameworkMediaDrm.DEFAULT_PROVIDER)
            .build(drmCallback)
    }

    private fun extractQualities() {
        val player = exoPlayer ?: return
        val selector = trackSelector ?: return
        
        availableQualities.clear()
        
        val trackGroups = selector.currentMappedTrackInfo
        if (trackGroups != null) {
            for (rendererIndex in 0 until trackGroups.rendererCount) {
                if (trackGroups.getRendererType(rendererIndex) == C.TRACK_TYPE_VIDEO) {
                    val trackGroupArray = trackGroups.getTrackGroups(rendererIndex)
                    
                    for (groupIndex in 0 until trackGroupArray.length) {
                        val trackGroup = trackGroupArray[groupIndex]
                        
                        for (trackIndex in 0 until trackGroup.length) {
                            val format = trackGroup.getFormat(trackIndex)
                            
                            val quality = VideoQuality(
                                height = format.height,
                                width = format.width,
                                bitrate = format.bitrate,
                                label = "${format.height}p",
                                index = availableQualities.size
                            )
                            availableQualities.add(quality)
                        }
                    }
                }
            }
        }
        
        // Send available qualities to JS
        val qualitiesArray = WritableNativeArray()
        availableQualities.forEach { quality ->
            val qualityMap = WritableNativeMap().apply {
                putInt("height", quality.height)
                putInt("width", quality.width)
                putInt("bitrate", quality.bitrate)
                putString("label", quality.label)
                putInt("index", quality.index)
            }
            qualitiesArray.pushMap(qualityMap)
        }
        
        val event = WritableNativeMap().apply {
            putArray("qualities", qualitiesArray)
        }
        sendEvent("onQualitiesAvailable", event)
    }

    @ReactMethod
    fun play() {
        handler.post {
            exoPlayer?.play()
            sendEvent("onPlay", null)
        }
    }

    @ReactMethod
    fun pause() {
        handler.post {
            exoPlayer?.pause()
            sendEvent("onPause", null)
        }
    }

    @ReactMethod
    fun seek(time: Double) {
        handler.post {
            exoPlayer?.seekTo((time * 1000).toLong())
            sendEvent("onSeeking", null)
        }
    }

    @ReactMethod
    fun setVolume(volume: Double) {
        handler.post {
            exoPlayer?.volume = volume.toFloat()
            val event = WritableNativeMap().apply {
                putDouble("volume", volume)
            }
            sendEvent("onVolumeChanged", event)
        }
    }

    @ReactMethod
    fun setPlaybackRate(rate: Double) {
        handler.post {
            exoPlayer?.setPlaybackSpeed(rate.toFloat())
        }
    }

    @ReactMethod
    fun setQuality(index: Int) {
        if (index < 0 || index >= availableQualities.size) return
        
        handler.post {
            currentQualityIndex = index
            val quality = availableQualities[index]
            
            // Apply quality selection to track selector
            trackSelector?.let { selector ->
                val parametersBuilder = selector.buildUponParameters()
                parametersBuilder.setMaxVideoSize(quality.width, quality.height)
                parametersBuilder.setMaxVideoBitrate(quality.bitrate)
                selector.setParameters(parametersBuilder.build())
            }
            
            val event = WritableNativeMap().apply {
                putInt("height", quality.height)
                putInt("width", quality.width)
                putInt("bitrate", quality.bitrate)
                putString("label", quality.label)
                putInt("index", quality.index)
            }
            sendEvent("onQualityChanged", event)
        }
    }

    @ReactMethod
    fun getQualities(callback: Callback) {
        val qualitiesArray = WritableNativeArray()
        availableQualities.forEach { quality ->
            val qualityMap = WritableNativeMap().apply {
                putInt("height", quality.height)
                putInt("width", quality.width)
                putInt("bitrate", quality.bitrate)
                putString("label", quality.label)
                putInt("index", quality.index)
            }
            qualitiesArray.pushMap(qualityMap)
        }
        callback.invoke(null, qualitiesArray)
    }

    @ReactMethod
    fun getCurrentTime(callback: Callback) {
        val currentPosition = exoPlayer?.currentPosition ?: 0
        callback.invoke(currentPosition / 1000.0)
    }

    @ReactMethod
    fun getDuration(callback: Callback) {
        val duration = exoPlayer?.duration ?: 0
        callback.invoke(if (duration > 0) duration / 1000.0 else 0)
    }

    @ReactMethod
    fun enterFullscreen() {
        handler.post {
            playerView?.let { view ->
                // Implementation for fullscreen
                val event = WritableNativeMap().apply {
                    putBoolean("isFullscreen", true)
                }
                sendEvent("onFullscreenChanged", event)
            }
        }
    }

    @ReactMethod
    fun exitFullscreen() {
        handler.post {
            playerView?.let { view ->
                // Implementation for exit fullscreen
                val event = WritableNativeMap().apply {
                    putBoolean("isFullscreen", false)
                }
                sendEvent("onFullscreenChanged", event)
            }
        }
    }

    @ReactMethod
    fun destroy() {
        handler.post {
            stopProgressTimer()
            exoPlayer?.apply {
                stop()
                release()
            }
            exoPlayer = null
            playerView = null
            trackSelector = null
            availableQualities.clear()
        }
    }

    // Player.Listener implementation
    override fun onPlaybackStateChanged(playbackState: Int) {
        when (playbackState) {
            Player.STATE_READY -> {
                sendEvent("onReady", null)
                startProgressTimer()
            }
            Player.STATE_ENDED -> {
                sendEvent("onEnded", null)
                stopProgressTimer()
            }
            Player.STATE_BUFFERING -> {
                val event = WritableNativeMap().apply {
                    putBoolean("isBuffering", true)
                }
                sendEvent("onBuffering", event)
            }
            Player.STATE_IDLE -> {
                stopProgressTimer()
            }
        }
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
        if (isPlaying) {
            startProgressTimer()
        } else {
            stopProgressTimer()
        }
    }

    override fun onPlayerError(error: PlaybackException) {
        val errorMap = WritableNativeMap().apply {
            putString("code", "PLAYBACK_ERROR")
            putString("message", error.message ?: "Unknown playback error")
        }
        sendEvent("onError", errorMap)
    }

    override fun onVideoSizeChanged(videoSize: VideoSize) {
        val event = WritableNativeMap().apply {
            putInt("width", videoSize.width)
            putInt("height", videoSize.height)
        }
        sendEvent("onVideoSizeChanged", event)
    }

    override fun onRenderedFirstFrame() {
        val event = WritableNativeMap().apply {
            putDouble("duration", (exoPlayer?.duration ?: 0) / 1000.0)
        }
        sendEvent("onLoadedMetadata", event)
    }

    // Progress timer
    private fun startProgressTimer() {
        stopProgressTimer()
        progressRunnable = object : Runnable {
            override fun run() {
                exoPlayer?.let { player ->
                    val currentTime = player.currentPosition / 1000.0
                    val bufferedPercentage = player.bufferedPercentage
                    
                    val event = WritableNativeMap().apply {
                        putDouble("currentTime", currentTime)
                    }
                    sendEvent("onTimeUpdate", event)
                    
                    val progressEvent = WritableNativeMap().apply {
                        putDouble("bufferedPercentage", bufferedPercentage.toDouble())
                    }
                    sendEvent("onProgress", progressEvent)
                }
                handler.postDelayed(this, 250)
            }
        }
        handler.post(progressRunnable!!)
    }

    private fun stopProgressTimer() {
        progressRunnable?.let {
            handler.removeCallbacks(it)
        }
        progressRunnable = null
    }

    // Event sending
    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun sendError(code: String, message: String) {
        val errorMap = WritableNativeMap().apply {
            putString("code", code)
            putString("message", message)
        }
        sendEvent("onError", errorMap)
    }
}
