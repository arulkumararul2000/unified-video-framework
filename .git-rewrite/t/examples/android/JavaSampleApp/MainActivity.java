/**
 * MainActivity.java
 * UnifiedVideoPlayer Java Sample App
 * 
 * Example of integrating UnifiedVideoPlayer into an existing Android app using Java
 */

package com.unifiedvideo.javasampleapp;

import android.content.DialogInterface;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.snackbar.Snackbar;
import com.unifiedvideo.player.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class MainActivity extends AppCompatActivity implements UnifiedVideoPlayer.PlayerEventListener {
    
    private static final String TAG = "JavaSampleApp";
    
    // UI Components
    private FrameLayout playerContainer;
    private Button playPauseButton;
    private SeekBar progressSeekBar;
    private TextView currentTimeText;
    private TextView durationText;
    private SeekBar volumeSeekBar;
    private Button muteButton;
    private ProgressBar loadingProgressBar;
    private TextView errorTextView;
    private Button skipBackwardButton;
    private Button skipForwardButton;
    private Button loadVideoButton;
    private Button qualityButton;
    private Button speedButton;
    private TextView stateTextView;
    private TextView infoTextView;
    
    // Player instance
    private UnifiedVideoPlayer videoPlayer;
    private boolean isSeeking = false;
    
    // Sample video data
    private static class VideoInfo {
        String url;
        String title;
        
        VideoInfo(String url, String title) {
            this.url = url;
            this.title = title;
        }
    }
    
    private final List<VideoInfo> sampleVideos = new ArrayList<>();
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        initializeSampleVideos();
        initializeUI();
        setupVideoPlayer();
        loadSampleVideo();
    }
    
    /**
     * Initialize sample video list
     */
    private void initializeSampleVideos() {
        sampleVideos.add(new VideoInfo(
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            "MP4 Video"
        ));
        sampleVideos.add(new VideoInfo(
            "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
            "HLS Stream"
        ));
        sampleVideos.add(new VideoInfo(
            "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            "Test Stream"
        ));
        sampleVideos.add(new VideoInfo(
            "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
            "DASH Stream"
        ));
    }
    
    /**
     * Initialize UI components
     */
    private void initializeUI() {
        // Find views
        playerContainer = findViewById(R.id.playerContainer);
        playPauseButton = findViewById(R.id.playPauseButton);
        progressSeekBar = findViewById(R.id.progressSeekBar);
        currentTimeText = findViewById(R.id.currentTimeText);
        durationText = findViewById(R.id.durationText);
        volumeSeekBar = findViewById(R.id.volumeSeekBar);
        muteButton = findViewById(R.id.muteButton);
        loadingProgressBar = findViewById(R.id.loadingProgressBar);
        errorTextView = findViewById(R.id.errorTextView);
        skipBackwardButton = findViewById(R.id.skipBackwardButton);
        skipForwardButton = findViewById(R.id.skipForwardButton);
        loadVideoButton = findViewById(R.id.loadVideoButton);
        qualityButton = findViewById(R.id.qualityButton);
        speedButton = findViewById(R.id.speedButton);
        stateTextView = findViewById(R.id.stateTextView);
        infoTextView = findViewById(R.id.infoTextView);
        
        // Setup initial states
        errorTextView.setVisibility(View.GONE);
        loadingProgressBar.setVisibility(View.GONE);
        volumeSeekBar.setMax(100);
        volumeSeekBar.setProgress(100);
        
        // Setup click listeners
        setupClickListeners();
        setupSeekBarListeners();
    }
    
    /**
     * Setup the video player
     */
    private void setupVideoPlayer() {
        // Create player instance
        videoPlayer = new UnifiedVideoPlayer(this);
        
        // Configure player
        PlayerConfiguration config = new PlayerConfiguration.Builder()
            .setAutoPlay(false)
            .setControls(false) // Using custom controls
            .setMuted(false)
            .setDebug(true)
            .setUseStyledControls(false)
            .setAllowBackgroundPlayback(false)
            .build();
        
        // Initialize with container
        videoPlayer.initialize(playerContainer, config);
        
        // Set event listener
        videoPlayer.setEventListener(this);
    }
    
    /**
     * Setup click listeners for buttons
     */
    private void setupClickListeners() {
        playPauseButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                videoPlayer.togglePlayPause();
            }
        });
        
        muteButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                videoPlayer.toggleMute();
                muteButton.setText(muteButton.getText().equals("Mute") ? "Unmute" : "Mute");
            }
        });
        
        skipBackwardButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                videoPlayer.seekBackward(10);
            }
        });
        
        skipForwardButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                videoPlayer.seekForward(10);
            }
        });
        
        loadVideoButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showVideoSelectionDialog();
            }
        });
        
        qualityButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showQualitySelectionDialog();
            }
        });
        
        speedButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showSpeedSelectionDialog();
            }
        });
    }
    
    /**
     * Setup SeekBar listeners
     */
    private void setupSeekBarListeners() {
        progressSeekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser) {
                    currentTimeText.setText(formatTime(progress));
                }
            }
            
            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                isSeeking = true;
            }
            
            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                videoPlayer.seekTo(seekBar.getProgress());
                isSeeking = false;
            }
        });
        
        volumeSeekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                if (fromUser) {
                    videoPlayer.setVolume(progress / 100f);
                }
            }
            
            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {
                // Not needed
            }
            
            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                // Not needed
            }
        });
    }
    
    /**
     * Load the first sample video
     */
    private void loadSampleVideo() {
        VideoInfo firstVideo = sampleVideos.get(0);
        MediaSourceInfo source = new MediaSourceInfo(firstVideo.url);
        videoPlayer.load(source);
        updateInfoText("Loading: " + firstVideo.title);
    }
    
    // PlayerEventListener implementation
    
    @Override
    public void onReady() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                loadingProgressBar.setVisibility(View.GONE);
                playPauseButton.setEnabled(true);
                Log.d(TAG, "Player is ready");
                updateStateText("Ready");
                updateInfoText("Video loaded successfully");
            }
        });
    }
    
    @Override
    public void onPlay() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                playPauseButton.setText("Pause");
                updateStateText("Playing");
            }
        });
    }
    
    @Override
    public void onPause() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                playPauseButton.setText("Play");
                updateStateText("Paused");
            }
        });
    }
    
    @Override
    public void onTimeUpdate(final long currentTime) {
        if (!isSeeking) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    progressSeekBar.setProgress((int) currentTime);
                    currentTimeText.setText(formatTime(currentTime));
                }
            });
        }
    }
    
    @Override
    public void onBuffering(final boolean isBuffering) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                loadingProgressBar.setVisibility(isBuffering ? View.VISIBLE : View.GONE);
                if (isBuffering) {
                    updateStateText("Buffering...");
                }
            }
        });
    }
    
    @Override
    public void onSeek(long position) {
        Log.d(TAG, "Seeked to: " + position);
    }
    
    @Override
    public void onEnded() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                playPauseButton.setText("Play");
                progressSeekBar.setProgress(0);
                currentTimeText.setText("00:00");
                updateStateText("Ended");
                updateInfoText("Playback completed");
            }
        });
    }
    
    @Override
    public void onError(final Exception error) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                loadingProgressBar.setVisibility(View.GONE);
                errorTextView.setVisibility(View.VISIBLE);
                errorTextView.setText("Error: " + error.getMessage());
                playPauseButton.setEnabled(false);
                updateStateText("Error");
                
                Snackbar.make(playerContainer, "Playback error occurred", Snackbar.LENGTH_LONG).show();
            }
        });
    }
    
    @Override
    public void onLoadedMetadata(final Map<String, Object> metadata) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "Metadata loaded: " + metadata.toString());
                
                Long duration = (Long) metadata.get("duration");
                if (duration != null) {
                    progressSeekBar.setMax(duration.intValue());
                    durationText.setText(formatTime(duration));
                }
                
                Integer width = (Integer) metadata.get("width");
                Integer height = (Integer) metadata.get("height");
                if (width != null && height != null) {
                    updateInfoText("Resolution: " + width + "x" + height);
                }
            }
        });
    }
    
    @Override
    public void onVolumeChange(final float volume) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                volumeSeekBar.setProgress((int) (volume * 100));
            }
        });
    }
    
    @Override
    public void onStateChange(final UnifiedVideoPlayer.PlayerState state) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "State changed: " + state);
                updateStateText(state.toString());
            }
        });
    }
    
    @Override
    public void onProgress(long bufferedPosition) {
        // Can be used to show buffer progress
    }
    
    @Override
    public void onVideoSizeChanged(final int width, final int height) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "Video size: " + width + "x" + height);
            }
        });
    }
    
    // Helper methods
    
    private String formatTime(long milliseconds) {
        long minutes = TimeUnit.MILLISECONDS.toMinutes(milliseconds);
        long seconds = TimeUnit.MILLISECONDS.toSeconds(milliseconds) % 60;
        return String.format("%02d:%02d", minutes, seconds);
    }
    
    private void updateStateText(String state) {
        stateTextView.setText("State: " + state);
    }
    
    private void updateInfoText(String info) {
        infoTextView.setText(info);
    }
    
    // Dialog methods
    
    private void showVideoSelectionDialog() {
        String[] items = new String[sampleVideos.size() + 1];
        for (int i = 0; i < sampleVideos.size(); i++) {
            items[i] = sampleVideos.get(i).title;
        }
        items[sampleVideos.size()] = "Custom URL...";
        
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Select Video");
        builder.setItems(items, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                if (which < sampleVideos.size()) {
                    VideoInfo selected = sampleVideos.get(which);
                    videoPlayer.load(selected.url);
                    updateInfoText("Loading: " + selected.title);
                } else {
                    showCustomURLDialog();
                }
            }
        });
        builder.setNegativeButton("Cancel", null);
        builder.show();
    }
    
    private void showCustomURLDialog() {
        final EditText editText = new EditText(this);
        editText.setHint("https://example.com/video.mp4");
        
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Enter Video URL");
        builder.setView(editText);
        builder.setPositiveButton("Load", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                String url = editText.getText().toString();
                if (!url.isEmpty()) {
                    videoPlayer.load(url);
                    updateInfoText("Loading custom URL");
                }
            }
        });
        builder.setNegativeButton("Cancel", null);
        builder.show();
    }
    
    private void showQualitySelectionDialog() {
        final String[] qualities = {"Auto", "HD (1080p)", "SD (480p)", "Low (360p)"};
        final String[] qualityValues = {"auto", "hd", "sd", "low"};
        
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Select Video Quality");
        builder.setItems(qualities, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                videoPlayer.setVideoQuality(qualityValues[which]);
                Toast.makeText(MainActivity.this, "Quality: " + qualities[which], Toast.LENGTH_SHORT).show();
                updateInfoText("Quality changed to: " + qualities[which]);
            }
        });
        builder.setNegativeButton("Cancel", null);
        builder.show();
    }
    
    private void showSpeedSelectionDialog() {
        final String[] speeds = {"0.5x", "0.75x", "1.0x", "1.25x", "1.5x", "2.0x"};
        final float[] speedValues = {0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f};
        
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Playback Speed");
        builder.setItems(speeds, new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                videoPlayer.setPlaybackSpeed(speedValues[which]);
                Toast.makeText(MainActivity.this, "Speed: " + speeds[which], Toast.LENGTH_SHORT).show();
                updateInfoText("Playback speed: " + speeds[which]);
            }
        });
        builder.setNegativeButton("Cancel", null);
        builder.show();
    }
    
    // Advanced usage examples
    
    /**
     * Load DRM protected content
     */
    private void loadDRMProtectedContent() {
        Map<String, String> headers = new HashMap<>();
        headers.put("X-Custom-Header", "value");
        headers.put("Authorization", "Bearer token");
        
        DRMConfiguration drm = new DRMConfiguration(
            "widevine",
            "https://license.server.com/widevine",
            headers,
            false,
            false
        );
        
        MediaSourceInfo source = new MediaSourceInfo(
            "https://example.com/protected-content.mpd",
            "dash",
            drm,
            null,
            null
        );
        
        videoPlayer.load(source);
        updateInfoText("Loading DRM protected content");
    }
    
    /**
     * Load video with subtitles
     */
    private void loadVideoWithSubtitles() {
        List<SubtitleTrack> subtitles = new ArrayList<>();
        subtitles.add(new SubtitleTrack(
            "https://example.com/subtitles-en.vtt",
            "en",
            "English"
        ));
        subtitles.add(new SubtitleTrack(
            "https://example.com/subtitles-es.vtt",
            "es",
            "Spanish"
        ));
        
        MediaSourceInfo source = new MediaSourceInfo(
            "https://example.com/video.mp4",
            "mp4",
            null,
            null,
            subtitles
        );
        
        videoPlayer.load(source);
        updateInfoText("Loading video with subtitles");
    }
    
    /**
     * Load video with custom metadata
     */
    private void loadVideoWithMetadata() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("title", "Sample Video");
        metadata.put("description", "This is a sample video");
        metadata.put("duration", 120000L);
        
        MediaSourceInfo source = new MediaSourceInfo(
            "https://example.com/video.mp4",
            "mp4",
            null,
            metadata,
            null
        );
        
        videoPlayer.load(source);
        updateInfoText("Loading video with metadata");
    }
    
    // Lifecycle methods
    
    @Override
    protected void onResume() {
        super.onResume();
        if (videoPlayer != null) {
            videoPlayer.onResume();
        }
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        if (videoPlayer != null) {
            videoPlayer.onPause();
        }
    }
    
    @Override
    protected void onStop() {
        super.onStop();
        if (videoPlayer != null) {
            videoPlayer.onStop();
        }
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (videoPlayer != null) {
            videoPlayer.release();
        }
    }
}
