# 📱 Integrating Unified Video Framework into Existing Native Apps

This guide shows how to add the Unified Video Framework to your **existing iOS and Android apps** as a native SDK/library.

---

## 🎯 Integration Overview

Since you have existing native apps, you'll integrate the video player as:
- **iOS**: Swift/Objective-C Framework or CocoaPod
- **Android**: AAR library or Gradle dependency

---

# Part 1: iOS Integration (Existing iOS App)

## Option A: Swift Package Manager (Recommended)

### Step 1: Create iOS Framework
Create `UnifiedVideoPlayer.xcframework` from the framework:

```bash
# Build for iOS device
xcodebuild archive \
  -scheme UnifiedVideoPlayer \
  -archivePath ./build/ios.xcarchive \
  -sdk iphoneos \
  SKIP_INSTALL=NO

# Build for iOS simulator  
xcodebuild archive \
  -scheme UnifiedVideoPlayer \
  -archivePath ./build/ios-sim.xcarchive \
  -sdk iphonesimulator \
  SKIP_INSTALL=NO

# Create XCFramework
xcodebuild -create-xcframework \
  -framework ./build/ios.xcarchive/Products/Library/Frameworks/UnifiedVideoPlayer.framework \
  -framework ./build/ios-sim.xcarchive/Products/Library/Frameworks/UnifiedVideoPlayer.framework \
  -output ./UnifiedVideoPlayer.xcframework
```

### Step 2: Add to Your Existing iOS App

**In Xcode:**
1. Select your project in navigator
2. Select your app target
3. Go to "General" tab
4. Under "Frameworks, Libraries, and Embedded Content", click "+"
5. Select "Add Files..." and choose `UnifiedVideoPlayer.xcframework`
6. Set to "Embed & Sign"

### Step 3: Import and Use in Your App

```swift
// YourExistingViewController.swift
import UIKit
import UnifiedVideoPlayer  // Import the framework

class YourExistingViewController: UIViewController {
    
    private var videoPlayer: UnifiedVideoPlayer?
    
    // Add video player to your existing view
    func addVideoPlayer() {
        // Create player instance
        videoPlayer = UnifiedVideoPlayer()
        
        // Configure player
        let config = PlayerConfiguration(
            autoPlay: true,
            controls: true,
            muted: false
        )
        
        // Initialize in your existing view hierarchy
        videoPlayer?.initialize(
            container: playerContainerView,  // Your existing UIView
            configuration: config
        )
        
        // Load video
        videoPlayer?.load(url: "https://example.com/video.m3u8")
        
        // Handle events
        videoPlayer?.onReady = { [weak self] in
            print("Player ready")
        }
        
        videoPlayer?.onError = { [weak self] error in
            self?.handleVideoError(error)
        }
    }
    
    // Integrate with your existing UI
    @IBAction func existingPlayButtonTapped(_ sender: UIButton) {
        videoPlayer?.play()
    }
    
    @IBAction func existingPauseButtonTapped(_ sender: UIButton) {
        videoPlayer?.pause()
    }
}
```

## Option B: CocoaPods Integration

### Step 1: Create Podspec
Create `UnifiedVideoPlayer.podspec`:

```ruby
Pod::Spec.new do |s|
  s.name             = 'UnifiedVideoPlayer'
  s.version          = '1.0.0'
  s.summary          = 'Unified Video Player for iOS'
  s.homepage         = 'https://yourcompany.com'
  s.license          = { :type => 'MIT', :file => 'LICENSE' }
  s.author           = { 'Your Company' => 'contact@yourcompany.com' }
  s.source           = { :git => 'https://github.com/yourcompany/unified-video-ios.git', :tag => s.version.to_s }
  
  s.ios.deployment_target = '13.0'
  s.swift_version = '5.0'
  
  s.source_files = 'Sources/**/*.{swift,h,m}'
  s.resources = 'Resources/**/*.{xib,storyboard,xcassets}'
  
  s.frameworks = 'UIKit', 'AVFoundation', 'AVKit'
  
  s.dependency 'Alamofire', '~> 5.0'  # If needed
end
```

### Step 2: Add to Your App's Podfile

```ruby
# Your existing Podfile
target 'YourExistingApp' do
  use_frameworks!
  
  # Your existing pods
  pod 'Firebase/Analytics'
  pod 'SDWebImage'
  
  # Add Unified Video Player
  pod 'UnifiedVideoPlayer', :path => '../unified-video-framework/ios'
  # Or from git:
  # pod 'UnifiedVideoPlayer', :git => 'https://github.com/yourcompany/unified-video-ios.git'
end
```

### Step 3: Install

```bash
cd your-existing-ios-app
pod install
```

## Option C: Manual Framework Integration

### Step 1: Build Framework

Create `UnifiedVideoPlayer.framework`:

```swift
// UnifiedVideoPlayer.swift - Main class
import UIKit
import AVFoundation
import AVKit

@objc public class UnifiedVideoPlayer: NSObject {
    
    private var player: AVPlayer?
    private var playerLayer: AVPlayerLayer?
    private var containerView: UIView?
    
    // MARK: - Initialization
    
    @objc public func initialize(container: UIView, configuration: [String: Any]? = nil) {
        self.containerView = container
        setupPlayer()
    }
    
    // MARK: - Public Methods
    
    @objc public func load(url: String) {
        guard let videoURL = URL(string: url) else { return }
        
        let asset = AVAsset(url: videoURL)
        let playerItem = AVPlayerItem(asset: asset)
        
        player?.replaceCurrentItem(with: playerItem)
    }
    
    @objc public func play() {
        player?.play()
    }
    
    @objc public func pause() {
        player?.pause()
    }
    
    @objc public func seek(to time: Double) {
        let cmTime = CMTime(seconds: time, preferredTimescale: 1000)
        player?.seek(to: cmTime)
    }
    
    @objc public func setVolume(_ volume: Float) {
        player?.volume = volume
    }
    
    @objc public func getCurrentTime() -> Double {
        return player?.currentTime().seconds ?? 0
    }
    
    @objc public func getDuration() -> Double {
        return player?.currentItem?.duration.seconds ?? 0
    }
    
    // MARK: - Private Methods
    
    private func setupPlayer() {
        player = AVPlayer()
        
        playerLayer = AVPlayerLayer(player: player)
        playerLayer?.frame = containerView?.bounds ?? .zero
        playerLayer?.videoGravity = .resizeAspect
        
        if let playerLayer = playerLayer {
            containerView?.layer.addSublayer(playerLayer)
        }
        
        setupObservers()
    }
    
    private func setupObservers() {
        // Add time observer
        let interval = CMTime(seconds: 1.0, preferredTimescale: 1000)
        player?.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            self?.onTimeUpdate?(time.seconds)
        }
        
        // Add other observers
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(playerDidFinishPlaying),
            name: .AVPlayerItemDidPlayToEndTime,
            object: player?.currentItem
        )
    }
    
    @objc private func playerDidFinishPlaying() {
        onEnded?()
    }
    
    // MARK: - Callbacks
    
    @objc public var onReady: (() -> Void)?
    @objc public var onPlay: (() -> Void)?
    @objc public var onPause: (() -> Void)?
    @objc public var onTimeUpdate: ((Double) -> Void)?
    @objc public var onEnded: (() -> Void)?
    @objc public var onError: ((Error) -> Void)?
}
```

### Step 2: Create Bridging Header (for Objective-C projects)

```objc
// UnifiedVideoPlayer-Bridging-Header.h
#import <UnifiedVideoPlayer/UnifiedVideoPlayer-Swift.h>
```

### Step 3: Use in Objective-C

```objc
// YourExistingViewController.m
#import "UnifiedVideoPlayer-Swift.h"

@interface YourExistingViewController ()
@property (nonatomic, strong) UnifiedVideoPlayer *videoPlayer;
@end

@implementation YourExistingViewController

- (void)addVideoPlayerToExistingView {
    // Create player
    self.videoPlayer = [[UnifiedVideoPlayer alloc] init];
    
    // Initialize with your existing view
    [self.videoPlayer initializeWithContainer:self.playerContainerView 
                                configuration:nil];
    
    // Load video
    [self.videoPlayer loadWithUrl:@"https://example.com/video.mp4"];
    
    // Set callbacks
    self.videoPlayer.onReady = ^{
        NSLog(@"Player ready");
    };
    
    // Play
    [self.videoPlayer play];
}

@end
```

---

# Part 2: Android Integration (Existing Android App)

## Option A: AAR Library (Recommended)

### Step 1: Build AAR Library

```gradle
// unified-video-player/build.gradle
apply plugin: 'com.android.library'

android {
    compileSdkVersion 33
    
    defaultConfig {
        minSdkVersion 21
        targetSdkVersion 33
    }
}

dependencies {
    implementation 'com.google.android.exoplayer:exoplayer:2.18.5'
    implementation 'com.google.android.exoplayer:exoplayer-hls:2.18.5'
}

// Generate AAR
./gradlew :unified-video-player:assembleRelease
```

### Step 2: Add AAR to Your Existing App

```gradle
// Your app's build.gradle
dependencies {
    // Your existing dependencies
    implementation 'com.google.android.material:material:1.9.0'
    
    // Add the AAR
    implementation files('libs/unified-video-player.aar')
    
    // Or from local module
    implementation project(':unified-video-player')
}
```

### Step 3: Use in Your Existing Activity/Fragment

```kotlin
// YourExistingActivity.kt
import com.unifiedvideo.player.UnifiedVideoPlayer
import com.unifiedvideo.player.PlayerConfiguration

class YourExistingActivity : AppCompatActivity() {
    
    private lateinit var videoPlayer: UnifiedVideoPlayer
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.your_existing_layout)
        
        // Add video player to your existing view
        addVideoPlayer()
    }
    
    private fun addVideoPlayer() {
        // Find your existing container view
        val playerContainer = findViewById<FrameLayout>(R.id.player_container)
        
        // Create and initialize player
        videoPlayer = UnifiedVideoPlayer(this).apply {
            initialize(
                container = playerContainer,
                configuration = PlayerConfiguration(
                    autoPlay = true,
                    controls = true,
                    muted = false
                )
            )
            
            // Set event listeners
            onReady = {
                Log.d("Player", "Ready")
            }
            
            onError = { error ->
                handleVideoError(error)
            }
            
            // Load video
            load("https://example.com/video.m3u8")
        }
    }
    
    // Integrate with your existing UI
    fun onExistingPlayButtonClick() {
        videoPlayer.play()
    }
    
    fun onExistingPauseButtonClick() {
        videoPlayer.pause()
    }
    
    override fun onPause() {
        super.onPause()
        videoPlayer.pause()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        videoPlayer.release()
    }
}
```

## Option B: Gradle Dependency

### Step 1: Publish to Maven Repository

```gradle
// unified-video-player/build.gradle
apply plugin: 'maven-publish'

publishing {
    publications {
        release(MavenPublication) {
            groupId = 'com.yourcompany'
            artifactId = 'unified-video-player'
            version = '1.0.0'
            
            afterEvaluate {
                from components.release
            }
        }
    }
}
```

### Step 2: Add to Your App

```gradle
// Your app's build.gradle
dependencies {
    implementation 'com.yourcompany:unified-video-player:1.0.0'
}
```

## Option C: Java Implementation (for Java-based apps)

```java
// YourExistingActivity.java
import com.unifiedvideo.player.UnifiedVideoPlayer;
import com.unifiedvideo.player.PlayerConfiguration;
import com.unifiedvideo.player.PlayerListener;

public class YourExistingActivity extends AppCompatActivity {
    
    private UnifiedVideoPlayer videoPlayer;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.your_existing_layout);
        
        addVideoPlayer();
    }
    
    private void addVideoPlayer() {
        // Find your existing container
        FrameLayout playerContainer = findViewById(R.id.player_container);
        
        // Create player
        videoPlayer = new UnifiedVideoPlayer(this);
        
        // Configure
        PlayerConfiguration config = new PlayerConfiguration.Builder()
            .setAutoPlay(true)
            .setControls(true)
            .setMuted(false)
            .build();
        
        // Initialize
        videoPlayer.initialize(playerContainer, config);
        
        // Set listener
        videoPlayer.setPlayerListener(new PlayerListener() {
            @Override
            public void onReady() {
                Log.d("Player", "Ready");
            }
            
            @Override
            public void onError(Exception error) {
                handleVideoError(error);
            }
        });
        
        // Load video
        videoPlayer.load("https://example.com/video.mp4");
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        if (videoPlayer != null) {
            videoPlayer.pause();
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
```

---

# Part 3: Complete SDK Implementation

## UnifiedVideoPlayer Android Library

```kotlin
// UnifiedVideoPlayer.kt - Complete implementation
package com.unifiedvideo.player

import android.content.Context
import android.net.Uri
import android.view.ViewGroup
import com.google.android.exoplayer2.*
import com.google.android.exoplayer2.source.MediaSource
import com.google.android.exoplayer2.source.ProgressiveMediaSource
import com.google.android.exoplayer2.source.hls.HlsMediaSource
import com.google.android.exoplayer2.ui.PlayerView
import com.google.android.exoplayer2.upstream.DefaultDataSourceFactory

class UnifiedVideoPlayer(private val context: Context) {
    
    private var exoPlayer: ExoPlayer? = null
    private var playerView: PlayerView? = null
    private var container: ViewGroup? = null
    
    // Event callbacks
    var onReady: (() -> Unit)? = null
    var onPlay: (() -> Unit)? = null
    var onPause: (() -> Unit)? = null
    var onTimeUpdate: ((Long) -> Unit)? = null
    var onError: ((Exception) -> Unit)? = null
    var onEnded: (() -> Unit)? = null
    
    fun initialize(container: ViewGroup, configuration: PlayerConfiguration? = null) {
        this.container = container
        
        // Create ExoPlayer
        exoPlayer = ExoPlayer.Builder(context).build()
        
        // Create PlayerView
        playerView = PlayerView(context).apply {
            player = exoPlayer
            useController = configuration?.controls ?: true
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        
        // Add to container
        container.addView(playerView)
        
        // Setup listeners
        setupListeners()
        
        // Apply configuration
        configuration?.let {
            exoPlayer?.playWhenReady = it.autoPlay
            exoPlayer?.volume = if (it.muted) 0f else 1f
        }
    }
    
    fun load(url: String) {
        val uri = Uri.parse(url)
        val mediaSource = createMediaSource(uri)
        
        exoPlayer?.apply {
            setMediaSource(mediaSource)
            prepare()
        }
    }
    
    fun play() {
        exoPlayer?.play()
        onPlay?.invoke()
    }
    
    fun pause() {
        exoPlayer?.pause()
        onPause?.invoke()
    }
    
    fun seek(position: Long) {
        exoPlayer?.seekTo(position)
    }
    
    fun setVolume(volume: Float) {
        exoPlayer?.volume = volume.coerceIn(0f, 1f)
    }
    
    fun getCurrentPosition(): Long {
        return exoPlayer?.currentPosition ?: 0
    }
    
    fun getDuration(): Long {
        return exoPlayer?.duration ?: 0
    }
    
    fun release() {
        exoPlayer?.release()
        exoPlayer = null
        playerView?.let {
            container?.removeView(it)
        }
        playerView = null
    }
    
    private fun createMediaSource(uri: Uri): MediaSource {
        val dataSourceFactory = DefaultDataSourceFactory(context, "UnifiedVideoPlayer")
        
        return when {
            uri.path?.contains(".m3u8") == true -> {
                HlsMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(uri))
            }
            else -> {
                ProgressiveMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(uri))
            }
        }
    }
    
    private fun setupListeners() {
        exoPlayer?.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                when (state) {
                    Player.STATE_READY -> onReady?.invoke()
                    Player.STATE_ENDED -> onEnded?.invoke()
                }
            }
            
            override fun onPlayerError(error: PlaybackException) {
                onError?.invoke(error)
            }
        })
    }
}

data class PlayerConfiguration(
    val autoPlay: Boolean = false,
    val controls: Boolean = true,
    val muted: Boolean = false
)
```

---

# Part 4: Migration Guide

## For iOS Apps

### Step 1: Replace Existing Video Player

```swift
// Before (using AVPlayerViewController)
let player = AVPlayer(url: videoURL)
let playerVC = AVPlayerViewController()
playerVC.player = player
present(playerVC, animated: true)

// After (using UnifiedVideoPlayer)
let player = UnifiedVideoPlayer()
player.initialize(container: containerView)
player.load(url: videoURL.absoluteString)
player.play()
```

### Step 2: Update Event Handlers

```swift
// Before
NotificationCenter.default.addObserver(
    self,
    selector: #selector(playerDidFinish),
    name: .AVPlayerItemDidPlayToEndTime,
    object: nil
)

// After
player.onEnded = { [weak self] in
    self?.handleVideoEnd()
}
```

## For Android Apps

### Step 1: Replace Existing Video Player

```kotlin
// Before (using VideoView)
videoView.setVideoURI(videoUri)
videoView.start()

// After (using UnifiedVideoPlayer)
videoPlayer.initialize(container)
videoPlayer.load(videoUri.toString())
videoPlayer.play()
```

### Step 2: Update Event Handlers

```kotlin
// Before
videoView.setOnCompletionListener {
    handleVideoComplete()
}

// After  
videoPlayer.onEnded = {
    handleVideoComplete()
}
```

---

# Part 5: Testing Integration

## iOS Testing

```swift
// UnifiedVideoPlayerTests.swift
import XCTest
@testable import UnifiedVideoPlayer

class UnifiedVideoPlayerTests: XCTestCase {
    
    var player: UnifiedVideoPlayer!
    
    override func setUp() {
        super.setUp()
        player = UnifiedVideoPlayer()
    }
    
    func testPlayerInitialization() {
        let container = UIView()
        player.initialize(container: container)
        
        XCTAssertNotNil(player)
    }
    
    func testVideoLoading() {
        let expectation = self.expectation(description: "Video loads")
        
        player.onReady = {
            expectation.fulfill()
        }
        
        player.load(url: "https://example.com/test.mp4")
        
        waitForExpectations(timeout: 10)
    }
}
```

## Android Testing

```kotlin
// UnifiedVideoPlayerTest.kt
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.*

@RunWith(AndroidJUnit4::class)
class UnifiedVideoPlayerTest {
    
    @Test
    fun testPlayerInitialization() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val player = UnifiedVideoPlayer(context)
        
        assertNotNull(player)
    }
    
    @Test
    fun testVideoLoading() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val player = UnifiedVideoPlayer(context)
        val container = FrameLayout(context)
        
        player.initialize(container)
        player.load("https://example.com/test.mp4")
        
        assertTrue(player.getDuration() >= 0)
    }
}
```

---

# Part 6: Distribution

## iOS Distribution

### Via CocoaPods
```bash
# Tag and push
git tag '1.0.0'
git push --tags

# Publish pod
pod trunk push UnifiedVideoPlayer.podspec
```

### Via Swift Package Manager
```swift
// Package.swift
let package = Package(
    name: "UnifiedVideoPlayer",
    platforms: [.iOS(.v13)],
    products: [
        .library(name: "UnifiedVideoPlayer", targets: ["UnifiedVideoPlayer"])
    ],
    targets: [
        .target(name: "UnifiedVideoPlayer")
    ]
)
```

## Android Distribution

### Via Maven Central
```gradle
// Publish to Maven Central
./gradlew publish
```

### Via JitPack
```gradle
// Add to root build.gradle
allprojects {
    repositories {
        maven { url 'https://jitpack.io' }
    }
}

// Add dependency
dependencies {
    implementation 'com.github.yourcompany:unified-video-android:1.0.0'
}
```

---

# 🎯 Quick Integration Checklist

## iOS
- [ ] Choose integration method (SPM/CocoaPods/Manual)
- [ ] Add framework to project
- [ ] Import in your existing ViewControllers
- [ ] Replace old video player code
- [ ] Test on device and simulator
- [ ] Update App Store description if needed

## Android
- [ ] Choose integration method (AAR/Gradle/Manual)
- [ ] Add library to project
- [ ] Import in your existing Activities/Fragments
- [ ] Replace old video player code
- [ ] Test on different Android versions
- [ ] Update Play Store description if needed

---

# 📚 Support & Documentation

- **iOS Documentation**: `/docs/ios/README.md`
- **Android Documentation**: `/docs/android/README.md`
- **API Reference**: `/docs/api/README.md`
- **Migration Guide**: `/docs/migration/README.md`
- **Sample Apps**: `/examples/`

---

This approach lets you keep your existing app structure and just add the video player as a component where needed!
