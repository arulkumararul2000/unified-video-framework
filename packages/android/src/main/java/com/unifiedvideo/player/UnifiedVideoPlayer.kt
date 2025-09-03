/**
 * UnifiedVideoPlayer.kt
 * Unified Video Framework - Android Native SDK
 */

package com.unifiedvideo.player

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.google.android.exoplayer2.*
import com.google.android.exoplayer2.analytics.AnalyticsListener
import com.google.android.exoplayer2.drm.*
import com.google.android.exoplayer2.source.MediaSource
import com.google.android.exoplayer2.source.ProgressiveMediaSource
import com.google.android.exoplayer2.source.dash.DashMediaSource
import com.google.android.exoplayer2.source.hls.HlsMediaSource
import com.google.android.exoplayer2.source.smoothstreaming.SsMediaSource
import com.google.android.exoplayer2.trackselection.DefaultTrackSelector
import com.google.android.exoplayer2.ui.PlayerView
import com.google.android.exoplayer2.ui.StyledPlayerView
import com.google.android.exoplayer2.upstream.DefaultDataSource
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource
import com.google.android.exoplayer2.util.MimeTypes
import com.google.android.exoplayer2.util.Util
import com.google.android.exoplayer2.video.VideoSize
import java.util.UUID

// Player Configuration
data class PlayerConfiguration(
    val autoPlay: Boolean = false,
    val controls: Boolean = true,
    val muted: Boolean = false,
    val loop: Boolean = false,
    val preload: String = "auto",
    val startTime: Long = 0,
    val playbackSpeed: Float = 1.0f,
    val volume: Float = 1.0f,
    val debug: Boolean = false,
    val useStyledControls: Boolean = true,
    val allowBackgroundPlayback: Boolean = false
) {
    class Builder {
        private var autoPlay: Boolean = false
        private var controls: Boolean = true
        private var muted: Boolean = false
        private var loop: Boolean = false
        private var preload: String = "auto"
        private var startTime: Long = 0
        private var playbackSpeed: Float = 1.0f
        private var volume: Float = 1.0f
        private var debug: Boolean = false
        private var useStyledControls: Boolean = true
        private var allowBackgroundPlayback: Boolean = false

        fun setAutoPlay(autoPlay: Boolean) = apply { this.autoPlay = autoPlay }
        fun setControls(controls: Boolean) = apply { this.controls = controls }
        fun setMuted(muted: Boolean) = apply { this.muted = muted }
        fun setLoop(loop: Boolean) = apply { this.loop = loop }
        fun setPreload(preload: String) = apply { this.preload = preload }
        fun setStartTime(startTime: Long) = apply { this.startTime = startTime }
        fun setPlaybackSpeed(speed: Float) = apply { this.playbackSpeed = speed }
        fun setVolume(volume: Float) = apply { this.volume = volume }
        fun setDebug(debug: Boolean) = apply { this.debug = debug }
        fun setUseStyledControls(styled: Boolean) = apply { this.useStyledControls = styled }
        fun setAllowBackgroundPlayback(allow: Boolean) = apply { this.allowBackgroundPlayback = allow }

        fun build() = PlayerConfiguration(
            autoPlay, controls, muted, loop, preload, startTime,
            playbackSpeed, volume, debug, useStyledControls, allowBackgroundPlayback
        )
    }
}

// Media Source
data class MediaSource(
    val url: String,
    val type: String? = null,
    val drm: DRMConfiguration? = null,
    val metadata: Map<String, Any>? = null,
    val subtitles: List<SubtitleTrack>? = null
) {
    companion object {
        fun detectType(url: String): String {
            return when {
                url.contains(".m3u8") -> "hls"
                url.contains(".mpd") -> "dash"
                url.contains(".ism") -> "smoothstreaming"
                url.contains(".mp4") -> "mp4"
                url.contains(".webm") -> "webm"
                url.contains(".mkv") -> "mkv"
                else -> "mp4"
            }
        }
    }
}

// DRM Configuration
data class DRMConfiguration(
    val type: String, // widevine, playready, clearkey
    val licenseUrl: String,
    val headers: Map<String, String>? = null,
    val multiSession: Boolean = false,
    val forceDefaultLicenseUri: Boolean = false
)

// Subtitle Track
data class SubtitleTrack(
    val url: String,
    val language: String,
    val label: String,
    val kind: String = "subtitles", // subtitles, captions
    val mimeType: String = MimeTypes.TEXT_VTT
)

// Player State
enum class PlayerState {
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

// Main Player Class
class UnifiedVideoPlayer(private val context: Context) {

    companion object {
        private const val TAG = "UnifiedVideoPlayer"
    }

    // Properties
    private var exoPlayer: ExoPlayer? = null
    private var playerView: View? = null
    private var container: ViewGroup? = null
    private var configuration: PlayerConfiguration? = null
    private var currentSource: MediaSource? = null
    private var trackSelector: DefaultTrackSelector? = null
    
    private val mainHandler = Handler(Looper.getMainLooper())
    private var updateProgressHandler: Runnable? = null
    
    // State properties
    var state: PlayerState = PlayerState.IDLE
        private set
    
    var isPlaying: Boolean = false
        private set
    
    var duration: Long = 0
        private set
    
    var currentPosition: Long = 0
        private set
    
    var bufferedPosition: Long = 0
        private set
    
    var volume: Float = 1.0f
        private set
    
    // Event callbacks
    var onReady: (() -> Unit)? = null
    var onPlay: (() -> Unit)? = null
    var onPause: (() -> Unit)? = null
    var onTimeUpdate: ((Long) -> Unit)? = null
    var onBuffering: ((Boolean) -> Unit)? = null
    var onSeek: ((Long) -> Unit)? = null
    var onEnded: (() -> Unit)? = null
    var onError: ((Exception) -> Unit)? = null
    var onLoadedMetadata: ((Map<String, Any>) -> Unit)? = null
    var onVolumeChange: ((Float) -> Unit)? = null
    var onStateChange: ((PlayerState) -> Unit)? = null
    var onProgress: ((Long) -> Unit)? = null
    var onVideoSizeChanged: ((Int, Int) -> Unit)? = null
    
    // Initialization
    fun initialize(
        container: ViewGroup,
        configuration: PlayerConfiguration? = null
    ) {
        this.container = container
        this.configuration = configuration ?: PlayerConfiguration()
        
        setupPlayer()
        applyConfiguration()
    }
    
    private fun setupPlayer() {
        // Create track selector for adaptive streaming
        trackSelector = DefaultTrackSelector(context).apply {
            setParameters(buildUponParameters().setMaxVideoSizeSd())
        }
        
        // Create player
        exoPlayer = ExoPlayer.Builder(context)
            .setTrackSelector(trackSelector!!)
            .build()
            .apply {
                addListener(playerEventListener)
                addAnalyticsListener(analyticsListener)
            }
        
        // Create player view
        playerView = if (configuration?.useStyledControls == true) {
            StyledPlayerView(context).apply {
                player = exoPlayer
                useController = configuration?.controls ?: true
                controllerShowTimeoutMs = 3000
                controllerHideOnTouch = true
                setShowBuffering(StyledPlayerView.SHOW_BUFFERING_WHEN_PLAYING)
            }
        } else {
            PlayerView(context).apply {
                player = exoPlayer
                useController = configuration?.controls ?: true
                controllerShowTimeoutMs = 3000
                controllerHideOnTouch = true
            }
        }
        
        // Add to container
        playerView?.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        container?.addView(playerView)
        
        // Start progress updates
        startProgressUpdates()
        
        updateState(PlayerState.IDLE)
    }
    
    private fun applyConfiguration() {
        val config = configuration ?: return
        
        exoPlayer?.apply {
            setVolume(config.volume)
            playbackParameters = PlaybackParameters(config.playbackSpeed)
            repeatMode = if (config.loop) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
            
            if (config.muted) {
                setVolume(0f)
            }
        }
        
        if (config.debug) {
            enableDebugLogging()
        }
    }
    
    // Loading Content
    fun load(source: MediaSource) {
        currentSource = source
        updateState(PlayerState.LOADING)
        
        val uri = Uri.parse(source.url)
        val mediaSource = createMediaSource(uri, source)
        
        exoPlayer?.apply {
            setMediaSource(mediaSource)
            prepare()
            
            // Apply start time if configured
            configuration?.startTime?.let { startTime ->
                if (startTime > 0) {
                    seekTo(startTime)
                }
            }
            
            // Auto-play if configured
            if (configuration?.autoPlay == true) {
                play()
            }
        }
        
        // Load subtitles if provided
        source.subtitles?.let { loadSubtitles(it) }
    }
    
    fun load(url: String) {
        val source = MediaSource(
            url = url,
            type = MediaSource.detectType(url)
        )
        load(source)
    }
    
    private fun createMediaSource(uri: Uri, source: MediaSource): com.google.android.exoplayer2.source.MediaSource {
        val dataSourceFactory = DefaultDataSource.Factory(context)
        
        // Configure DRM if needed
        val drmSessionManagerProvider = source.drm?.let { drm ->
            createDrmSessionManagerProvider(drm)
        }
        
        val mediaItem = MediaItem.Builder()
            .setUri(uri)
            .apply {
                source.drm?.let { drm ->
                    setDrmConfiguration(
                        MediaItem.DrmConfiguration.Builder(getDrmUuid(drm.type))
                            .setLicenseUri(drm.licenseUrl)
                            .setMultiSession(drm.multiSession)
                            .setForceDefaultLicenseUri(drm.forceDefaultLicenseUri)
                            .apply {
                                drm.headers?.let { headers ->
                                    setLicenseRequestHeaders(headers)
                                }
                            }
                            .build()
                    )
                }
            }
            .build()
        
        // Create appropriate media source based on type
        val type = source.type ?: MediaSource.detectType(source.url)
        
        return when (type) {
            "hls" -> HlsMediaSource.Factory(dataSourceFactory)
                .setDrmSessionManagerProvider(drmSessionManagerProvider)
                .createMediaSource(mediaItem)
            
            "dash" -> DashMediaSource.Factory(dataSourceFactory)
                .setDrmSessionManagerProvider(drmSessionManagerProvider)
                .createMediaSource(mediaItem)
            
            "smoothstreaming" -> SsMediaSource.Factory(dataSourceFactory)
                .setDrmSessionManagerProvider(drmSessionManagerProvider)
                .createMediaSource(mediaItem)
            
            else -> ProgressiveMediaSource.Factory(dataSourceFactory)
                .setDrmSessionManagerProvider(drmSessionManagerProvider)
                .createMediaSource(mediaItem)
        }
    }
    
    private fun createDrmSessionManagerProvider(drm: DRMConfiguration): DrmSessionManagerProvider {
        val drmCallback = HttpMediaDrmCallback(
            drm.licenseUrl,
            DefaultHttpDataSource.Factory()
        ).apply {
            drm.headers?.forEach { (key, value) ->
                setKeyRequestProperty(key, value)
            }
        }
        
        return DrmSessionManagerProvider { mediaItem ->
            val drmSessionManager = DefaultDrmSessionManager.Builder()
                .setUuidAndExoMediaDrmProvider(
                    getDrmUuid(drm.type),
                    FrameworkMediaDrm.DEFAULT_PROVIDER
                )
                .build(drmCallback)
            
            drmSessionManager.setMode(DefaultDrmSessionManager.MODE_PLAYBACK, emptyByteArray())
            drmSessionManager
        }
    }
    
    private fun getDrmUuid(drmType: String): UUID {
        return when (drmType.lowercase()) {
            "widevine" -> C.WIDEVINE_UUID
            "playready" -> C.PLAYREADY_UUID
            "clearkey" -> C.CLEARKEY_UUID
            else -> C.WIDEVINE_UUID
        }
    }
    
    private fun loadSubtitles(subtitles: List<SubtitleTrack>) {
        // ExoPlayer handles subtitles through MediaItem configuration
        // This would be implemented with side-loaded subtitle tracks
        subtitles.forEach { subtitle ->
            Log.d(TAG, "Loading subtitle: ${subtitle.label} (${subtitle.language})")
            // Implementation would add subtitle tracks to the media source
        }
    }
    
    // Playback Control
    fun play() {
        exoPlayer?.play()
        isPlaying = true
        updateState(PlayerState.PLAYING)
        onPlay?.invoke()
    }
    
    fun pause() {
        exoPlayer?.pause()
        isPlaying = false
        updateState(PlayerState.PAUSED)
        onPause?.invoke()
    }
    
    fun stop() {
        exoPlayer?.apply {
            stop()
            seekTo(0)
        }
        isPlaying = false
        updateState(PlayerState.IDLE)
    }
    
    fun togglePlayPause() {
        if (isPlaying) {
            pause()
        } else {
            play()
        }
    }
    
    fun seekTo(position: Long) {
        updateState(PlayerState.SEEKING)
        exoPlayer?.seekTo(position)
        onSeek?.invoke(position)
    }
    
    fun seekForward(seconds: Int = 10) {
        val newPosition = currentPosition + (seconds * 1000)
        seekTo(minOf(newPosition, duration))
    }
    
    fun seekBackward(seconds: Int = 10) {
        val newPosition = currentPosition - (seconds * 1000)
        seekTo(maxOf(newPosition, 0))
    }
    
    // Volume Control
    fun setVolume(volume: Float) {
        val clampedVolume = volume.coerceIn(0f, 1f)
        this.volume = clampedVolume
        exoPlayer?.volume = clampedVolume
        onVolumeChange?.invoke(clampedVolume)
    }
    
    fun mute() {
        exoPlayer?.volume = 0f
    }
    
    fun unmute() {
        exoPlayer?.volume = volume
    }
    
    fun toggleMute() {
        exoPlayer?.let {
            if (it.volume == 0f) {
                unmute()
            } else {
                mute()
            }
        }
    }
    
    // Playback Speed
    fun setPlaybackSpeed(speed: Float) {
        exoPlayer?.setPlaybackSpeed(speed)
    }
    
    fun getPlaybackSpeed(): Float {
        return exoPlayer?.playbackParameters?.speed ?: 1.0f
    }
    
    // Quality Selection
    fun setVideoQuality(quality: String) {
        when (quality) {
            "auto" -> trackSelector?.setParameters(
                trackSelector!!.buildUponParameters().clearVideoSizeConstraints()
            )
            "hd" -> trackSelector?.setParameters(
                trackSelector!!.buildUponParameters()
                    .setMaxVideoSize(1920, 1080)
                    .setMinVideoSize(1280, 720)
            )
            "sd" -> trackSelector?.setParameters(
                trackSelector!!.buildUponParameters().setMaxVideoSizeSd()
            )
            "low" -> trackSelector?.setParameters(
                trackSelector!!.buildUponParameters()
                    .setMaxVideoSize(854, 480)
            )
        }
    }
    
    // State Management
    private fun updateState(newState: PlayerState) {
        state = newState
        onStateChange?.invoke(newState)
        
        if (configuration?.debug == true) {
            Log.d(TAG, "State changed to: $newState")
        }
    }
    
    // Progress Updates
    private fun startProgressUpdates() {
        updateProgressHandler = object : Runnable {
            override fun run() {
                exoPlayer?.let {
                    currentPosition = it.currentPosition
                    bufferedPosition = it.bufferedPosition
                    duration = it.duration
                    
                    onTimeUpdate?.invoke(currentPosition)
                    onProgress?.invoke(bufferedPosition)
                }
                mainHandler.postDelayed(this, 100)
            }
        }
        updateProgressHandler?.let { mainHandler.post(it) }
    }
    
    private fun stopProgressUpdates() {
        updateProgressHandler?.let { mainHandler.removeCallbacks(it) }
    }
    
    // Player Event Listener
    private val playerEventListener = object : Player.Listener {
        
        override fun onPlaybackStateChanged(playbackState: Int) {
            when (playbackState) {
                Player.STATE_IDLE -> updateState(PlayerState.IDLE)
                Player.STATE_BUFFERING -> {
                    updateState(PlayerState.BUFFERING)
                    onBuffering?.invoke(true)
                }
                Player.STATE_READY -> {
                    if (state == PlayerState.LOADING || state == PlayerState.BUFFERING) {
                        updateState(PlayerState.READY)
                        onReady?.invoke()
                        emitLoadedMetadata()
                    }
                    if (state == PlayerState.BUFFERING) {
                        onBuffering?.invoke(false)
                    }
                    if (exoPlayer?.isPlaying == true) {
                        updateState(PlayerState.PLAYING)
                    }
                }
                Player.STATE_ENDED -> {
                    updateState(PlayerState.ENDED)
                    onEnded?.invoke()
                    
                    if (configuration?.loop == true) {
                        seekTo(0)
                        play()
                    }
                }
            }
        }
        
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            this@UnifiedVideoPlayer.isPlaying = isPlaying
            if (isPlaying) {
                updateState(PlayerState.PLAYING)
            } else if (state == PlayerState.PLAYING) {
                updateState(PlayerState.PAUSED)
            }
        }
        
        override fun onPlayerError(error: PlaybackException) {
            updateState(PlayerState.ERROR)
            onError?.invoke(error)
            
            if (configuration?.debug == true) {
                Log.e(TAG, "Player error: ${error.message}", error)
            }
        }
        
        override fun onVideoSizeChanged(videoSize: VideoSize) {
            onVideoSizeChanged?.invoke(videoSize.width, videoSize.height)
        }
        
        override fun onRenderedFirstFrame() {
            Log.d(TAG, "First frame rendered")
        }
    }
    
    // Analytics Listener
    private val analyticsListener = object : AnalyticsListener {
        override fun onLoadCompleted(
            eventTime: AnalyticsListener.EventTime,
            loadEventInfo: LoadEventInfo,
            mediaLoadData: MediaLoadData
        ) {
            Log.d(TAG, "Load completed: ${loadEventInfo.dataSpec.uri}")
        }
        
        override fun onBandwidthEstimate(
            eventTime: AnalyticsListener.EventTime,
            totalLoadTimeMs: Int,
            totalBytesLoaded: Long,
            bitrateEstimate: Long
        ) {
            if (configuration?.debug == true) {
                Log.d(TAG, "Bandwidth estimate: $bitrateEstimate bps")
            }
        }
    }
    
    private fun emitLoadedMetadata() {
        val metadata = mutableMapOf<String, Any>()
        
        exoPlayer?.let { player ->
            metadata["duration"] = player.duration
            
            player.videoFormat?.let { format ->
                metadata["width"] = format.width
                metadata["height"] = format.height
                metadata["frameRate"] = format.frameRate
                metadata["bitrate"] = format.bitrate
                metadata["codec"] = format.codecs ?: ""
            }
            
            player.audioFormat?.let { format ->
                metadata["audioChannels"] = format.channelCount
                metadata["audioSampleRate"] = format.sampleRate
                metadata["audioCodec"] = format.codecs ?: ""
            }
        }
        
        onLoadedMetadata?.invoke(metadata)
    }
    
    // Surface Control (for advanced use cases)
    fun setVideoSurface(surface: Surface?) {
        exoPlayer?.setVideoSurface(surface)
    }
    
    fun clearVideoSurface() {
        exoPlayer?.clearVideoSurface()
    }
    
    // Picture-in-Picture Support
    fun enterPictureInPicture(): Boolean {
        // Implementation depends on Activity context
        // This would trigger PiP mode if supported
        return false
    }
    
    // Debug
    private fun enableDebugLogging() {
        Log.d(TAG, "Debug mode enabled")
        Log.d(TAG, "Configuration: $configuration")
    }
    
    // Lifecycle Management
    fun onResume() {
        exoPlayer?.let {
            if (state == PlayerState.PLAYING) {
                it.play()
            }
        }
    }
    
    fun onPause() {
        if (configuration?.allowBackgroundPlayback == false) {
            exoPlayer?.pause()
        }
    }
    
    fun onStop() {
        if (configuration?.allowBackgroundPlayback == false) {
            exoPlayer?.stop()
        }
    }
    
    // Cleanup
    fun release() {
        stopProgressUpdates()
        
        exoPlayer?.apply {
            removeListener(playerEventListener)
            removeAnalyticsListener(analyticsListener)
            release()
        }
        
        playerView?.let {
            container?.removeView(it)
        }
        
        exoPlayer = null
        playerView = null
        container = null
        
        updateState(PlayerState.IDLE)
    }
}

// Extension functions for easier use
fun ExoPlayer.isBuffering(): Boolean {
    return playbackState == Player.STATE_BUFFERING
}

fun ExoPlayer.hasEnded(): Boolean {
    return playbackState == Player.STATE_ENDED
}
