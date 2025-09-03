/**
 * MainActivity.kt
 * UnifiedVideoPlayer Sample App
 * 
 * Example of integrating UnifiedVideoPlayer into an existing Android app
 */

package com.unifiedvideo.sampleapp

import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.snackbar.Snackbar
import com.unifiedvideo.player.*
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {
    
    companion object {
        private const val TAG = "SampleApp"
    }
    
    // UI Components
    private lateinit var playerContainer: FrameLayout
    private lateinit var playPauseButton: Button
    private lateinit var progressSeekBar: SeekBar
    private lateinit var currentTimeText: TextView
    private lateinit var durationText: TextView
    private lateinit var volumeSeekBar: SeekBar
    private lateinit var muteButton: Button
    private lateinit var loadingProgressBar: ProgressBar
    private lateinit var errorTextView: TextView
    private lateinit var skipBackwardButton: Button
    private lateinit var skipForwardButton: Button
    private lateinit var loadVideoButton: Button
    private lateinit var qualityButton: Button
    private lateinit var speedButton: Button
    
    // Player instance
    private lateinit var videoPlayer: UnifiedVideoPlayer
    private var isSeeking = false
    
    // Sample video URLs
    private val sampleVideos = listOf(
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" to "MP4 Video",
        "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8" to "HLS Stream",
        "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" to "Test Stream",
        "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd" to "DASH Stream"
    )
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        setupUI()
        setupVideoPlayer()
        loadSampleVideo()
    }
    
    private fun setupUI() {
        // Initialize UI components
        playerContainer = findViewById(R.id.playerContainer)
        playPauseButton = findViewById(R.id.playPauseButton)
        progressSeekBar = findViewById(R.id.progressSeekBar)
        currentTimeText = findViewById(R.id.currentTimeText)
        durationText = findViewById(R.id.durationText)
        volumeSeekBar = findViewById(R.id.volumeSeekBar)
        muteButton = findViewById(R.id.muteButton)
        loadingProgressBar = findViewById(R.id.loadingProgressBar)
        errorTextView = findViewById(R.id.errorTextView)
        skipBackwardButton = findViewById(R.id.skipBackwardButton)
        skipForwardButton = findViewById(R.id.skipForwardButton)
        loadVideoButton = findViewById(R.id.loadVideoButton)
        qualityButton = findViewById(R.id.qualityButton)
        speedButton = findViewById(R.id.speedButton)
        
        // Setup initial states
        errorTextView.visibility = View.GONE
        loadingProgressBar.visibility = View.GONE
        volumeSeekBar.max = 100
        volumeSeekBar.progress = 100
        
        // Setup click listeners
        setupClickListeners()
        setupSeekBarListeners()
    }
    
    private fun setupVideoPlayer() {
        // Create player instance
        videoPlayer = UnifiedVideoPlayer(this)
        
        // Configure player
        val config = PlayerConfiguration.Builder()
            .setAutoPlay(false)
            .setControls(false) // Using custom controls
            .setMuted(false)
            .setDebug(true)
            .setUseStyledControls(false)
            .setAllowBackgroundPlayback(false)
            .build()
        
        // Initialize with container
        videoPlayer.initialize(playerContainer, config)
        
        // Setup event listeners
        setupPlayerEventListeners()
    }
    
    private fun setupPlayerEventListeners() {
        // Ready event
        videoPlayer.onReady = {
            runOnUiThread {
                handlePlayerReady()
            }
        }
        
        // Play/Pause events
        videoPlayer.onPlay = {
            runOnUiThread {
                updatePlayPauseButton(true)
            }
        }
        
        videoPlayer.onPause = {
            runOnUiThread {
                updatePlayPauseButton(false)
            }
        }
        
        // Time updates
        videoPlayer.onTimeUpdate = { currentTime ->
            if (!isSeeking) {
                runOnUiThread {
                    updateProgress(currentTime)
                }
            }
        }
        
        // Buffering
        videoPlayer.onBuffering = { isBuffering ->
            runOnUiThread {
                handleBuffering(isBuffering)
            }
        }
        
        // Metadata loaded
        videoPlayer.onLoadedMetadata = { metadata ->
            runOnUiThread {
                handleMetadataLoaded(metadata)
            }
        }
        
        // Error handling
        videoPlayer.onError = { error ->
            runOnUiThread {
                handleError(error)
            }
        }
        
        // State changes
        videoPlayer.onStateChange = { state ->
            Log.d(TAG, "Player state changed: $state")
        }
        
        // Video ended
        videoPlayer.onEnded = {
            runOnUiThread {
                handleVideoEnded()
            }
        }
        
        // Video size changed
        videoPlayer.onVideoSizeChanged = { width, height ->
            Log.d(TAG, "Video size: ${width}x${height}")
        }
    }
    
    private fun setupClickListeners() {
        playPauseButton.setOnClickListener {
            videoPlayer.togglePlayPause()
        }
        
        muteButton.setOnClickListener {
            videoPlayer.toggleMute()
            muteButton.text = if (muteButton.text == "Mute") "Unmute" else "Mute"
        }
        
        skipBackwardButton.setOnClickListener {
            videoPlayer.seekBackward(10)
        }
        
        skipForwardButton.setOnClickListener {
            videoPlayer.seekForward(10)
        }
        
        loadVideoButton.setOnClickListener {
            showVideoSelectionDialog()
        }
        
        qualityButton.setOnClickListener {
            showQualitySelectionDialog()
        }
        
        speedButton.setOnClickListener {
            showSpeedSelectionDialog()
        }
    }
    
    private fun setupSeekBarListeners() {
        progressSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    currentTimeText.text = formatTime(progress.toLong())
                }
            }
            
            override fun onStartTrackingTouch(seekBar: SeekBar) {
                isSeeking = true
            }
            
            override fun onStopTrackingTouch(seekBar: SeekBar) {
                videoPlayer.seekTo(seekBar.progress.toLong())
                isSeeking = false
            }
        })
        
        volumeSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    videoPlayer.setVolume(progress / 100f)
                }
            }
            
            override fun onStartTrackingTouch(seekBar: SeekBar) {}
            override fun onStopTrackingTouch(seekBar: SeekBar) {}
        })
    }
    
    private fun loadSampleVideo() {
        // Load the first sample video
        val (url, _) = sampleVideos[0]
        val source = MediaSource(url = url)
        videoPlayer.load(source)
    }
    
    // Event Handlers
    private fun handlePlayerReady() {
        loadingProgressBar.visibility = View.GONE
        playPauseButton.isEnabled = true
        Log.d(TAG, "Player is ready")
    }
    
    private fun handleBuffering(isBuffering: Boolean) {
        loadingProgressBar.visibility = if (isBuffering) View.VISIBLE else View.GONE
    }
    
    private fun handleMetadataLoaded(metadata: Map<String, Any>) {
        Log.d(TAG, "Metadata loaded: $metadata")
        
        val duration = metadata["duration"] as? Long ?: 0
        progressSeekBar.max = duration.toInt()
        durationText.text = formatTime(duration)
        
        metadata["width"]?.let { width ->
            metadata["height"]?.let { height ->
                Log.d(TAG, "Video resolution: ${width}x${height}")
            }
        }
    }
    
    private fun handleError(error: Exception) {
        loadingProgressBar.visibility = View.GONE
        errorTextView.visibility = View.VISIBLE
        errorTextView.text = "Error: ${error.message}"
        playPauseButton.isEnabled = false
        
        Snackbar.make(playerContainer, "Playback error occurred", Snackbar.LENGTH_LONG).show()
    }
    
    private fun handleVideoEnded() {
        updatePlayPauseButton(false)
        progressSeekBar.progress = 0
        currentTimeText.text = "00:00"
    }
    
    // UI Updates
    private fun updatePlayPauseButton(isPlaying: Boolean) {
        playPauseButton.text = if (isPlaying) "Pause" else "Play"
    }
    
    private fun updateProgress(currentTime: Long) {
        progressSeekBar.progress = currentTime.toInt()
        currentTimeText.text = formatTime(currentTime)
    }
    
    private fun formatTime(milliseconds: Long): String {
        val minutes = TimeUnit.MILLISECONDS.toMinutes(milliseconds)
        val seconds = TimeUnit.MILLISECONDS.toSeconds(milliseconds) % 60
        return String.format("%02d:%02d", minutes, seconds)
    }
    
    // Dialogs
    private fun showVideoSelectionDialog() {
        val items = sampleVideos.map { it.second }.toTypedArray()
        
        AlertDialog.Builder(this)
            .setTitle("Select Video")
            .setItems(items) { _, which ->
                val (url, _) = sampleVideos[which]
                videoPlayer.load(url)
            }
            .setPositiveButton("Custom URL") { _, _ ->
                showCustomURLDialog()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun showCustomURLDialog() {
        val editText = EditText(this).apply {
            hint = "https://example.com/video.mp4"
        }
        
        AlertDialog.Builder(this)
            .setTitle("Enter Video URL")
            .setView(editText)
            .setPositiveButton("Load") { _, _ ->
                val url = editText.text.toString()
                if (url.isNotEmpty()) {
                    videoPlayer.load(url)
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun showQualitySelectionDialog() {
        val qualities = arrayOf("Auto", "HD (1080p)", "SD (480p)", "Low (360p)")
        val qualityValues = arrayOf("auto", "hd", "sd", "low")
        
        AlertDialog.Builder(this)
            .setTitle("Select Video Quality")
            .setItems(qualities) { _, which ->
                videoPlayer.setVideoQuality(qualityValues[which])
                Toast.makeText(this, "Quality: ${qualities[which]}", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    private fun showSpeedSelectionDialog() {
        val speeds = arrayOf("0.5x", "0.75x", "1.0x", "1.25x", "1.5x", "2.0x")
        val speedValues = floatArrayOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f)
        
        AlertDialog.Builder(this)
            .setTitle("Playback Speed")
            .setItems(speeds) { _, which ->
                videoPlayer.setPlaybackSpeed(speedValues[which])
                Toast.makeText(this, "Speed: ${speeds[which]}", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    
    // Advanced Usage Examples
    private fun loadDRMProtectedContent() {
        val drm = DRMConfiguration(
            type = "widevine",
            licenseUrl = "https://license.server.com/widevine",
            headers = mapOf(
                "X-Custom-Header" to "value",
                "Authorization" to "Bearer token"
            )
        )
        
        val source = MediaSource(
            url = "https://example.com/protected-content.mpd",
            type = "dash",
            drm = drm
        )
        
        videoPlayer.load(source)
    }
    
    private fun loadVideoWithSubtitles() {
        val subtitles = listOf(
            SubtitleTrack(
                url = "https://example.com/subtitles-en.vtt",
                language = "en",
                label = "English"
            ),
            SubtitleTrack(
                url = "https://example.com/subtitles-es.vtt",
                language = "es",
                label = "Spanish"
            )
        )
        
        val source = MediaSource(
            url = "https://example.com/video.mp4",
            subtitles = subtitles
        )
        
        videoPlayer.load(source)
    }
    
    // Lifecycle
    override fun onResume() {
        super.onResume()
        videoPlayer.onResume()
    }
    
    override fun onPause() {
        super.onPause()
        videoPlayer.onPause()
    }
    
    override fun onStop() {
        super.onStop()
        videoPlayer.onStop()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        videoPlayer.release()
    }
}
