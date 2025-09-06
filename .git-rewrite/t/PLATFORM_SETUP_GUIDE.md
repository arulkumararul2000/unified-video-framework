# 📚 Unified Video Framework - Complete Platform Setup Guide

This guide provides step-by-step instructions for setting up the Unified Video Framework on all supported platforms.

## Table of Contents
1. [Web Platform](#1-web-platform-setup)
2. [iOS Platform](#2-ios-platform-setup)
3. [Android Platform](#3-android-platform-setup)
4. [Samsung Tizen TV](#4-samsung-tizen-tv-setup)
5. [LG webOS TV](#5-lg-webos-tv-setup)
6. [Roku Platform](#6-roku-platform-setup)
7. [Android TV](#7-android-tv-setup)
8. [React Native (Mobile)](#8-react-native-mobile-setup)

---

## 1. Web Platform Setup

### Prerequisites
- Node.js 16+ and npm 8+
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Step-by-Step Installation

#### Step 1: Install Dependencies
```bash
npm install @unified-video/core @unified-video/web
```

#### Step 2: Create HTML Structure
```html
<!DOCTYPE html>
<html>
<head>
    <title>Video Player</title>
    <style>
        #video-container {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
        }
    </style>
</head>
<body>
    <div id="video-container"></div>
    <script type="module" src="app.js"></script>
</body>
</html>
```

#### Step 3: Initialize Player (app.js)
```javascript
import { WebPlayer } from '@unified-video/web';

async function initializePlayer() {
    // Create player instance
    const player = new WebPlayer();
    
    // Initialize with container
    await player.initialize('#video-container', {
        controls: true,
        autoPlay: false,
        muted: false,
        debug: true
    });
    
    // Load video source
    await player.load({
        url: 'https://example.com/video.mp4',
        type: 'mp4',
        subtitles: [{
            url: 'https://example.com/subs.vtt',
            language: 'en',
            label: 'English',
            kind: 'subtitles'
        }]
    });
    
    // Event handling
    player.on('onReady', () => console.log('Player ready'));
    player.on('onPlay', () => console.log('Playback started'));
    player.on('onError', (error) => console.error('Player error:', error));
    
    // Start playback
    await player.play();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializePlayer);
```

#### Step 4: Build for Production
```bash
# Using Webpack
npm install --save-dev webpack webpack-cli
npx webpack app.js --output bundle.js

# Or using Vite
npm install --save-dev vite
npx vite build
```

#### Step 5: Deploy
```bash
# Test locally
npx http-server

# Deploy to production (examples)
# - Upload to CDN
# - Deploy to Netlify/Vercel
# - Integrate with existing web app
```

---

## 2. iOS Platform Setup

### Prerequisites
- macOS with Xcode 14+
- iOS 13.0+ deployment target
- Swift 5.0+ or Objective-C
- SwiftUI 2.0+ (for SwiftUI implementation)

### ⚠️ Architecture Build Fix
If you encounter "UnifiedVideoPlayer.swiftmodule is not built for arm64" error:

```bash
# Quick Fix - Use Swift Package Manager (Recommended)
1. In Xcode: File > Add Package Dependencies
2. Click "Add Local..." and navigate to packages/ios/
3. Add the package to your target

# Alternative - Build Universal Framework
cd packages/ios
chmod +x build_framework.sh
./build_framework.sh
# This creates Output/UnifiedVideoPlayer.xcframework
```

For detailed architecture troubleshooting, see [BUILD_INSTRUCTIONS.md](packages/ios/BUILD_INSTRUCTIONS.md)

### Choose Your Integration Method:

## Option A: Native iOS (Swift/SwiftUI) - For Modern iOS Apps ⭐ RECOMMENDED

### Step 1: Add Framework to Your Project

#### Using Swift Package Manager (Auto-builds for correct architecture):
```swift
// In Xcode: File > Add Package Dependencies
// Add Local Package: packages/ios/
// Or Remote: https://github.com/yourcompany/unified-video-ios.git
```

#### Using CocoaPods:
```ruby
# Podfile
pod 'UnifiedVideoPlayer', '~> 1.0'
```

#### Using XCFramework (Universal Binary):
```bash
cd packages/ios
./build_framework.sh
# Drag Output/UnifiedVideoPlayer.xcframework into your project
```

### Quick Start - iOS (Just 3 lines!):
```swift
// UIKit
let player = UnifiedVideoPlayer()
player.initialize(container: yourView)
player.load(url: "video.mp4")

// SwiftUI
UnifiedVideoPlayerView(url: URL(string: "video.mp4")!)
    .frame(height: 200)
    .onAppear { /* auto-plays */ }
```

### Step 2: Configure Info.plist
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>

<!-- For background playback -->
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

### Step 3A: SwiftUI Implementation (Modern Approach) 🆕
```swift
import SwiftUI
import UnifiedVideoPlayer

struct VideoPlayerView: View {
    @StateObject private var playerViewModel = VideoPlayerViewModel()
    @State private var isPlaying = false
    @State private var showControls = true
    
    var body: some View {
        VStack {
            // Video Player
            UnifiedVideoPlayerView(
                url: URL(string: "https://example.com/video.m3u8")!,
                configuration: .init(
                    autoPlay: true,
                    controls: false,  // Custom controls
                    muted: false
                )
            )
            .frame(height: 250)
            .overlay(
                Group {
                    if showControls {
                        PlayerControlsOverlay(
                            isPlaying: $isPlaying,
                            onPlayPause: { playerViewModel.togglePlayPause() },
                            onSeek: { playerViewModel.seek(to: $0) }
                        )
                    }
                }
            )
            .onTapGesture {
                withAnimation { showControls.toggle() }
            }
            
            // Custom Controls
            HStack {
                Button(action: { playerViewModel.skipBackward(10) }) {
                    Image(systemName: "gobackward.10")
                }
                
                Button(action: { playerViewModel.togglePlayPause() }) {
                    Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                        .font(.title)
                }
                
                Button(action: { playerViewModel.skipForward(10) }) {
                    Image(systemName: "goforward.10")
                }
            }
            .padding()
            
            // Progress Bar
            ProgressView(value: playerViewModel.currentTime,
                        total: playerViewModel.duration)
                .padding(.horizontal)
        }
        .onAppear {
            playerViewModel.load(url: "https://example.com/video.m3u8")
        }
    }
}

// View Model for SwiftUI
class VideoPlayerViewModel: ObservableObject {
    @Published var currentTime: Double = 0
    @Published var duration: Double = 100
    @Published var isPlaying = false
    
    private var player: UnifiedVideoPlayer?
    
    func load(url: String) {
        player = UnifiedVideoPlayer()
        player?.load(url: url)
        player?.onTimeUpdate = { [weak self] time in
            self?.currentTime = time
        }
        player?.onDurationChange = { [weak self] duration in
            self?.duration = duration
        }
    }
    
    func togglePlayPause() {
        isPlaying.toggle()
        isPlaying ? player?.play() : player?.pause()
    }
    
    func seek(to time: Double) {
        player?.seek(to: time)
    }
    
    func skipForward(_ seconds: Double) {
        player?.seek(to: currentTime + seconds)
    }
    
    func skipBackward(_ seconds: Double) {
        player?.seek(to: max(0, currentTime - seconds))
    }
}
```

### Step 3B: UIKit Implementation (Traditional Approach)
```swift
import UIKit
import AVFoundation
import UnifiedVideoPlayer

class VideoViewController: UIViewController {
    
    private var videoPlayer: UnifiedVideoPlayer?
    @IBOutlet weak var playerContainer: UIView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupVideoPlayer()
    }
    
    private func setupVideoPlayer() {
        // Initialize player
        videoPlayer = UnifiedVideoPlayer()
        
        // Configure
        let config = PlayerConfiguration(
            autoPlay: true,
            controls: true,
            muted: false
        )
        
        // Add to your view
        videoPlayer?.initialize(
            container: playerContainer,
            configuration: config
        )
        
        // Load video
        videoPlayer?.load(url: "https://example.com/video.m3u8")
        
        // Handle events
        videoPlayer?.onReady = { [weak self] in
            print("Player ready")
        }
        
        videoPlayer?.onError = { [weak self] error in
            self?.showError(error)
        }
    }
    
    // Control methods
    @IBAction func playButtonTapped() {
        videoPlayer?.play()
    }
    
    @IBAction func pauseButtonTapped() {
        videoPlayer?.pause()
    }
}
```

### Step 4: Objective-C Implementation (Alternative)
```objc
// VideoViewController.m
#import "UnifiedVideoPlayer.h"

@interface VideoViewController ()
@property (nonatomic, strong) UnifiedVideoPlayer *videoPlayer;
@property (weak, nonatomic) IBOutlet UIView *playerContainer;
@end

@implementation VideoViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    [self setupVideoPlayer];
}

- (void)setupVideoPlayer {
    // Initialize player
    self.videoPlayer = [[UnifiedVideoPlayer alloc] init];
    
    // Configure
    NSDictionary *config = @{
        @"autoPlay": @YES,
        @"controls": @YES,
        @"muted": @NO
    };
    
    // Add to view
    [self.videoPlayer initializeWithContainer:self.playerContainer 
                                 configuration:config];
    
    // Load video
    [self.videoPlayer loadWithUrl:@"https://example.com/video.m3u8"];
    
    // Handle events
    self.videoPlayer.onReady = ^{
        NSLog(@"Player ready");
    };
}

- (IBAction)playButtonTapped:(id)sender {
    [self.videoPlayer play];
}

@end
```

## Option B: React Native - For Cross-Platform Apps

### Step 1: Install Dependencies
```bash
npx react-native init MyVideoApp
cd MyVideoApp
npm install @unified-video/core @unified-video/react-native
npm install react-native-video
cd ios && pod install
```

### Step 2: React Native Implementation
```jsx
import React, { useRef } from 'react';
import { View, Button } from 'react-native';
import { ReactNativePlayer } from '@unified-video/react-native';

export default function VideoScreen() {
    const playerRef = useRef(null);
    
    return (
        <View style={{ flex: 1 }}>
            <ReactNativePlayer
                ref={playerRef}
                style={{ flex: 1 }}
                config={{ autoPlay: true }}
            />
        </View>
    );
}
```

## Option C: Flutter - For Dart-based Cross-Platform

### Step 1: Add Dependencies
```yaml
# pubspec.yaml
dependencies:
  unified_video_player: ^1.0.0
  video_player: ^2.7.0
```

### Step 2: Flutter Implementation
```dart
import 'package:flutter/material.dart';
import 'package:unified_video_player/unified_video_player.dart';

class VideoScreen extends StatefulWidget {
  @override
  _VideoScreenState createState() => _VideoScreenState();
}

class _VideoScreenState extends State<VideoScreen> {
  UnifiedVideoPlayer? _player;
  
  @override
  void initState() {
    super.initState();
    _player = UnifiedVideoPlayer();
    _player!.initialize();
    _player!.load('https://example.com/video.m3u8');
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: UnifiedVideoPlayerView(
        player: _player!,
      ),
    );
  }
}
```

### Build and Run
```bash
# Native iOS (UIKit/SwiftUI)
open MyApp.xcodeproj
# Or: xcodebuild -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 14'

# Fix Architecture Issues Before Building
# In Xcode: Product > Clean Build Folder (⇧⌘K)
# Then: Product > Build (⌘B)

# React Native
npx react-native run-ios
# Or specific simulator: npx react-native run-ios --simulator="iPhone 14 Pro"

# Flutter
flutter run -d ios
```

### Troubleshooting iOS Build Issues

#### Architecture Error Fix:
```bash
# If you see: "not built for arm64"
# Solution 1: Clean and rebuild
xcodebuild clean -workspace MyApp.xcworkspace -scheme MyApp
xcodebuild build -workspace MyApp.xcworkspace -scheme MyApp -destination 'generic/platform=iOS'

# Solution 2: Reset Swift Package Manager cache
rm -rf ~/Library/Caches/org.swift.swiftpm
rm -rf ~/Library/Developer/Xcode/DerivedData

# Solution 3: Build universal framework
cd packages/ios
./build_framework.sh
```

---

## 3. Android Platform Setup

### Prerequisites
- Android Studio Arctic Fox+
- Android SDK 21+ (Lollipop)
- Java 11 / Kotlin 1.6+

### Choose Your Integration Method:

## Option A: Native Android (Kotlin/Java) - For Existing Android Apps ⭐ RECOMMENDED

### Step 1: Add Library to Your Project

cd packages/android
./gradlew assembleRelease
# This creates an AAR file in build/outputs/aar/

Android (Just 3 lines!):
val player = UnifiedVideoPlayer(context)
player.initialize(container)
player.load("video.mp4")


#### Using Gradle:
```gradle
// app/build.gradle
dependencies {
    implementation 'com.unifiedvideo:player:1.0.0'
    
    // Or local AAR
    implementation files('libs/unified-video-player.aar')
    
    // Required dependencies
    implementation 'com.google.android.exoplayer:exoplayer:2.18.5'
    implementation 'com.google.android.exoplayer:exoplayer-hls:2.18.5'
}
```

### Step 2: Configure AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<application
    android:usesCleartextTraffic="true"
    android:largeHeap="true">
    
    <!-- For background playback -->
    <service android:name="com.unifiedvideo.PlaybackService" />
</application>
```

### Step 3: Implement in Your Activity (Kotlin)
```kotlin
// VideoActivity.kt
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.unifiedvideo.player.UnifiedVideoPlayer
import com.unifiedvideo.player.PlayerConfiguration

class VideoActivity : AppCompatActivity() {
    
    private lateinit var videoPlayer: UnifiedVideoPlayer
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_video)
        
        setupVideoPlayer()
    }
    
    private fun setupVideoPlayer() {
        // Find your container view
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
                showError(error)
            }
            
            // Load video
            load("https://example.com/video.m3u8")
        }
    }
    
    // Control methods
    fun onPlayButtonClick() {
        videoPlayer.play()
    }
    
    fun onPauseButtonClick() {
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

### Step 4: Java Implementation (Alternative)
```java
// VideoActivity.java
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import com.unifiedvideo.player.UnifiedVideoPlayer;
import com.unifiedvideo.player.PlayerConfiguration;

public class VideoActivity extends AppCompatActivity {
    
    private UnifiedVideoPlayer videoPlayer;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_video);
        
        setupVideoPlayer();
    }
    
    private void setupVideoPlayer() {
        // Find container
        FrameLayout playerContainer = findViewById(R.id.player_container);
        
        // Create player
        videoPlayer = new UnifiedVideoPlayer(this);
        
        // Configure
        PlayerConfiguration config = new PlayerConfiguration.Builder()
            .setAutoPlay(true)
            .setControls(true)
            .build();
        
        // Initialize
        videoPlayer.initialize(playerContainer, config);
        
        // Set listeners
        videoPlayer.setOnReadyListener(() -> {
            Log.d("Player", "Ready");
        });
        
        // Load video
        videoPlayer.load("https://example.com/video.mp4");
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

## Option B: React Native - For Cross-Platform Apps

### Step 1: Install Dependencies
```bash
npx react-native init MyVideoApp
cd MyVideoApp
npm install @unified-video/core @unified-video/react-native
npm install react-native-video
```

### Step 2: React Native Implementation
```jsx
import React from 'react';
import { View } from 'react-native';
import { ReactNativePlayer } from '@unified-video/react-native';

export default function VideoScreen() {
    return (
        <View style={{ flex: 1 }}>
            <ReactNativePlayer
                style={{ flex: 1 }}
                config={{ autoPlay: true }}
            />
        </View>
    );
}
```

## Option C: Flutter - For Dart-based Cross-Platform

### Step 1: Add Dependencies
```yaml
# pubspec.yaml
dependencies:
  unified_video_player: ^1.0.0
```

### Step 2: Flutter Implementation
```dart
import 'package:unified_video_player/unified_video_player.dart';

class VideoScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return UnifiedVideoPlayer(
      url: 'https://example.com/video.mp4',
      autoPlay: true,
    );
  }
}
```

### Build and Run
```bash
# Native Android
# Open in Android Studio and run

# React Native
npx react-native run-android

# Flutter
flutter run -d android
```

---

## 4. Samsung Tizen TV Setup

### Prerequisites
- Tizen Studio 5.0+
- Samsung TV (2017+ model) or Emulator
- Developer Certificate

### Step-by-Step Installation

#### Step 1: Create Tizen Project
```bash
# Install Tizen CLI
npm install -g @tizen/cli

# Create new project
tizen create web-project -n VideoPlayerApp -t BasicProject
cd VideoPlayerApp
```

#### Step 2: Install Framework
```bash
npm install @unified-video/core @unified-video/web
```

#### Step 3: Configure config.xml
```xml
<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" 
        xmlns:tizen="http://tizen.org/ns/widgets"
        id="http://yourdomain/VideoPlayerApp" 
        version="1.0.0">
    <name>VideoPlayerApp</name>
    <tizen:application id="ABC123.VideoPlayerApp" 
                      package="ABC123" 
                      required_version="5.0"/>
    <content src="index.html"/>
    <feature name="http://tizen.org/feature/screen.size.all"/>
    <access origin="*" subdomains="true"/>
    <tizen:privilege name="http://tizen.org/privilege/internet"/>
    <tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
    <tizen:setting screen-orientation="landscape"/>
</widget>
```

#### Step 4: Implement TV Controls
```javascript
// js/app.js
import { WebPlayer } from '@unified-video/web';

let player;

async function initTizenPlayer() {
    player = new WebPlayer();
    
    await player.initialize('#player-container', {
        controls: false, // Use custom TV controls
        autoPlay: true
    });
    
    // Register TV remote control events
    registerKeyHandler();
    
    // Load video
    await player.load({
        url: 'https://example.com/video.m3u8',
        type: 'hls'
    });
}

function registerKeyHandler() {
    document.addEventListener('keydown', function(e) {
        switch(e.keyCode) {
            case 13: // Enter
                player.isPlaying() ? player.pause() : player.play();
                break;
            case 37: // Left
                player.seek(player.getCurrentTime() - 10);
                break;
            case 39: // Right
                player.seek(player.getCurrentTime() + 10);
                break;
            case 38: // Up
                player.setVolume(player.getState().volume + 0.1);
                break;
            case 40: // Down
                player.setVolume(player.getState().volume - 0.1);
                break;
            case 10009: // Back button
                tizen.application.getCurrentApplication().exit();
                break;
        }
    });
}

// Initialize on load
window.onload = initTizenPlayer;
```

#### Step 5: Build and Deploy
```bash
# Build package
tizen build-web

# Package as WGT
tizen package -t wgt -s yourCertificate -- .buildResult

# Install on TV
tizen install -n VideoPlayerApp.wgt -t <TV_IP>

# Run on TV
tizen run -p ABC123.VideoPlayerApp -t <TV_IP>
```

---

## 5. LG webOS TV Setup

### Prerequisites
- webOS TV SDK 6.0+
- LG TV (2018+ model) or Emulator
- Developer Account

### Step-by-Step Installation

#### Step 1: Create webOS Project
```bash
# Install webOS CLI
npm install -g @webos-tools/cli

# Create new project
ares-generate -t webapp VideoPlayerApp
cd VideoPlayerApp
```

#### Step 2: Configure appinfo.json
```json
{
    "id": "com.yourdomain.videoplayerapp",
    "version": "1.0.0",
    "vendor": "Your Company",
    "type": "web",
    "main": "index.html",
    "title": "Video Player App",
    "icon": "icon.png",
    "largeIcon": "largeIcon.png",
    "requiredPermissions": ["internet", "media.playback"]
}
```

#### Step 3: Implement webOS Player
```javascript
// js/app.js
import { WebPlayer } from '@unified-video/web';

class WebOSVideoPlayer {
    constructor() {
        this.player = new WebPlayer();
        this.initializePlayer();
        this.registerRemoteControl();
    }
    
    async initializePlayer() {
        await this.player.initialize('#video-container', {
            controls: false,
            autoPlay: true
        });
        
        // Load video
        await this.player.load({
            url: 'https://example.com/video.m3u8',
            type: 'hls',
            drm: {
                type: 'playready',
                licenseUrl: 'https://license.server.com'
            }
        });
    }
    
    registerRemoteControl() {
        // Register webOS specific remote control
        webOS.registerKeys(['red', 'green', 'yellow', 'blue', 'back']);
        
        document.addEventListener('webOSRelaunch', (e) => {
            if (e.detail.parameters.contentId) {
                this.loadContent(e.detail.parameters.contentId);
            }
        });
        
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'Enter':
                    this.togglePlayPause();
                    break;
                case 'ArrowLeft':
                    this.seek(-10);
                    break;
                case 'ArrowRight':
                    this.seek(10);
                    break;
                case 'Back':
                    webOS.platformBack();
                    break;
            }
        });
    }
    
    togglePlayPause() {
        this.player.isPlaying() ? 
            this.player.pause() : 
            this.player.play();
    }
    
    seek(seconds) {
        const currentTime = this.player.getCurrentTime();
        this.player.seek(currentTime + seconds);
    }
}

// Initialize on app launch
window.addEventListener('load', () => {
    new WebOSVideoPlayer();
});
```

#### Step 4: Build and Deploy
```bash
# Package app
ares-package . -o dist/

# Install on TV
ares-install dist/com.yourdomain.videoplayerapp_1.0.0_all.ipk -t <TV_NAME>

# Launch app
ares-launch com.yourdomain.videoplayerapp -t <TV_NAME>

# Debug app
ares-inspect com.yourdomain.videoplayerapp -t <TV_NAME>
```

---

## 6. Roku Platform Setup

### Prerequisites
- Roku Device (or Emulator)
- Roku Developer Account
- Developer Mode enabled on device

### Step-by-Step Installation

#### Step 1: Project Structure
```
VideoPlayerApp/
├── manifest
├── source/
│   └── main.brs
├── components/
│   ├── UnifiedVideoPlayer.xml
│   └── UnifiedVideoPlayer.brs
└── images/
    ├── splash_hd.png
    └── splash_sd.png
```

#### Step 2: Configure Manifest
```
title=Video Player App
major_version=1
minor_version=0
build_version=0
mm_icon_focus_hd=pkg:/images/icon_hd.png
mm_icon_focus_sd=pkg:/images/icon_sd.png
splash_screen_hd=pkg:/images/splash_hd.png
splash_screen_sd=pkg:/images/splash_sd.png
ui_resolutions=fhd
bs_libs_required=roku_ads_lib
```

#### Step 3: Main Scene Component
Create `components/MainScene.xml`:
```xml
<?xml version="1.0" encoding="utf-8" ?>
<component name="MainScene" extends="Scene">
    <interface>
        <field id="videoUrl" type="string" />
    </interface>
    
    <script type="text/brightscript" uri="MainScene.brs" />
    
    <children>
        <UnifiedVideoPlayer
            id="videoPlayer"
            width="1920"
            height="1080" />
    </children>
</component>
```

Create `components/MainScene.brs`:
```brightscript
sub init()
    m.videoPlayer = m.top.findNode("videoPlayer")
    m.top.setFocus(true)
    
    ' Initialize with sample content
    loadContent()
end sub

sub loadContent()
    content = CreateObject("roSGNode", "ContentNode")
    content.url = "https://example.com/video.m3u8"
    content.streamFormat = "hls"
    content.title = "Sample Video"
    
    ' DRM configuration
    content.drmParams = {
        type: "widevine",
        licenseUrl: "https://license.server.com"
    }
    
    ' Load into player
    m.videoPlayer.callFunc("loadContent", content)
end sub

function onKeyEvent(key as String, press as Boolean) as Boolean
    if press then
        if key = "play"
            m.videoPlayer.callFunc("play")
            return true
        else if key = "pause"
            m.videoPlayer.callFunc("pause")
            return true
        else if key = "back"
            return true
        end if
    end if
    return false
end function
```

#### Step 4: Build and Deploy
```bash
# Create ZIP package
zip -r VideoPlayerApp.zip manifest source components images

# Enable developer mode on Roku (Settings > System > Advanced > Developer Mode)

# Upload via browser
# Navigate to http://<ROKU_IP> and upload the ZIP

# Or use Roku Deploy CLI
npm install -g roku-deploy
roku-deploy --host <ROKU_IP> --password <DEV_PASSWORD>
```

---

## 7. Android TV Setup

### Prerequisites
- Android Studio with Android TV SDK
- Android TV device or emulator
- Leanback library

### Step-by-Step Installation

#### Step 1: Create Android TV Project
```bash
# In Android Studio: New Project > TV > Empty Activity
```

#### Step 2: Configure build.gradle
```gradle
// app/build.gradle
android {
    compileSdk 33
    
    defaultConfig {
        applicationId "com.yourdomain.videoplayer"
        minSdk 21
        targetSdk 33
        versionCode 1
        versionName "1.0"
    }
}

dependencies {
    implementation 'androidx.leanback:leanback:1.2.0'
    implementation 'com.google.android.exoplayer:exoplayer:2.18.5'
    implementation 'com.google.android.exoplayer:exoplayer-hls:2.18.5'
    implementation 'com.google.android.exoplayer:extension-leanback:2.18.5'
}
```

#### Step 3: TV Manifest Configuration
```xml
<!-- AndroidManifest.xml -->
<uses-feature
    android:name="android.software.leanback"
    android:required="true" />
    
<uses-feature
    android:name="android.hardware.touchscreen"
    android:required="false" />
    
<application
    android:banner="@drawable/tv_banner"
    android:theme="@style/Theme.Leanback">
    
    <activity
        android:name=".MainActivity"
        android:label="@string/app_name"
        android:screenOrientation="landscape">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
        </intent-filter>
    </activity>
    
    <activity
        android:name=".PlayerActivity"
        android:configChanges="orientation|screenSize" />
</application>
```

#### Step 4: Implement Player Activity
```kotlin
// PlayerActivity.kt
import android.os.Bundle
import androidx.fragment.app.FragmentActivity
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.ext.leanback.LeanbackPlayerAdapter
import androidx.leanback.app.VideoSupportFragment
import androidx.leanback.app.VideoSupportFragmentGlueHost
import androidx.leanback.media.PlaybackTransportControlGlue

class PlayerActivity : FragmentActivity() {
    private lateinit var exoPlayer: ExoPlayer
    private lateinit var playerGlue: PlaybackTransportControlGlue<LeanbackPlayerAdapter>
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_player)
        
        val videoFragment = supportFragmentManager
            .findFragmentById(R.id.video_fragment) as VideoSupportFragment
        
        // Initialize ExoPlayer
        exoPlayer = ExoPlayer.Builder(this).build()
        
        // Create Leanback adapter
        val playerAdapter = LeanbackPlayerAdapter(this, exoPlayer, 16)
        
        // Create playback control glue
        playerGlue = PlaybackTransportControlGlue(this, playerAdapter)
        playerGlue.host = VideoSupportFragmentGlueHost(videoFragment)
        playerGlue.title = "Video Title"
        playerGlue.subtitle = "Video Subtitle"
        
        // Load video
        val videoUrl = intent.getStringExtra("video_url")
        val mediaItem = MediaItem.fromUri(videoUrl!!)
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
        exoPlayer.play()
    }
    
    override fun onStop() {
        super.onStop()
        playerGlue.pause()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        exoPlayer.release()
    }
}
```

#### Step 5: Build and Deploy
```bash
# Build APK
./gradlew assembleDebug

# Install on Android TV
adb connect <TV_IP>
adb install app/build/outputs/apk/debug/app-debug.apk

# Launch app
adb shell am start -n com.yourdomain.videoplayer/.MainActivity
```

---

## 8. React Native Mobile Setup (iOS + Android Combined)

### Prerequisites
- Node.js 16+
- React Native CLI
- Xcode (for iOS)
- Android Studio (for Android)

### Step-by-Step Installation

#### Step 1: Create React Native Project
```bash
npx react-native init VideoPlayerApp --template react-native-template-typescript
cd VideoPlayerApp
```

#### Step 2: Install Dependencies
```bash
npm install @unified-video/core @unified-video/react-native
npm install react-native-video react-native-orientation-locker react-native-slider
npm install --save-dev @types/react-native-video
```

#### Step 3: Platform-specific Setup
```bash
# iOS
cd ios && pod install && cd ..

# Android - Already configured via autolinking
```

#### Step 4: Create Video Player Screen
```typescript
// src/screens/VideoPlayerScreen.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  StatusBar,
  Platform,
  SafeAreaView
} from 'react-native';
import { ReactNativePlayer, ReactNativePlayerRef } from '@unified-video/react-native';
import Orientation from 'react-native-orientation-locker';
import Slider from '@react-native-community/slider';

interface VideoPlayerScreenProps {
  route: {
    params: {
      videoUrl: string;
      title?: string;
    };
  };
}

export const VideoPlayerScreen: React.FC<VideoPlayerScreenProps> = ({ route }) => {
  const playerRef = useRef<ReactNativePlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  
  useEffect(() => {
    // Lock to landscape
    Orientation.lockToLandscape();
    
    // Hide status bar
    StatusBar.setHidden(true);
    
    // Load video
    loadVideo();
    
    return () => {
      Orientation.unlockAllOrientations();
      StatusBar.setHidden(false);
    };
  }, []);
  
  const loadVideo = async () => {
    const { videoUrl } = route.params;
    
    await playerRef.current?.load({
      url: videoUrl,
      type: videoUrl.includes('.m3u8') ? 'hls' : 'mp4',
      metadata: {
        title: route.params.title || 'Video'
      }
    });
    
    // Start playback
    await playerRef.current?.play();
    setIsPlaying(true);
  };
  
  const togglePlayPause = () => {
    if (isPlaying) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  const onSliderValueChange = (value: number) => {
    playerRef.current?.seek(value);
  };
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.videoContainer}
        onPress={() => setShowControls(!showControls)}
      >
        <ReactNativePlayer
          ref={playerRef}
          style={styles.video}
          config={{
            autoPlay: false,
            controls: false, // Use custom controls
            muted: false
          }}
          onReady={() => console.log('Player ready')}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(time) => setCurrentTime(time)}
          onLoadedMetadata={(metadata) => {
            setDuration(metadata.duration || 0);
          }}
          onError={(error) => console.error('Player error:', error)}
        />
        
        {showControls && (
          <View style={styles.controls}>
            <View style={styles.topControls}>
              <Text style={styles.title}>{route.params.title}</Text>
            </View>
            
            <View style={styles.centerControls}>
              <TouchableOpacity onPress={togglePlayPause}>
                <Text style={styles.playButton}>
                  {isPlaying ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.bottomControls}>
              <Text style={styles.time}>{formatTime(currentTime)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={duration}
                value={currentTime}
                onSlidingComplete={onSliderValueChange}
                minimumTrackTintColor="#FFFFFF"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
              />
              <Text style={styles.time}>{formatTime(duration)}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topControls: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  centerControls: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    fontSize: 60,
    color: '#FFF',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  time: {
    color: '#FFF',
    fontSize: 14,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
});
```

#### Step 5: Build and Deploy

**iOS:**
```bash
# Development
npx react-native run-ios

# Production
cd ios
xcodebuild archive \
  -workspace VideoPlayerApp.xcworkspace \
  -scheme VideoPlayerApp \
  -archivePath ~/Desktop/VideoPlayerApp.xcarchive

# Upload to App Store
xcrun altool --upload-app \
  -f ~/Desktop/VideoPlayerApp.ipa \
  -u your@email.com \
  -p app-specific-password
```

**Android:**
```bash
# Development
npx react-native run-android

# Production
cd android
./gradlew bundleRelease

# Sign and upload to Google Play Console
```

---

## 🚀 Quick Testing Commands

### Web
```bash
npm run serve:demo
open http://localhost:3000/apps/demo/demo.html
```

### React Native
```bash
# iOS Simulator
npx react-native run-ios --simulator="iPhone 14 Pro"

# Android Emulator
npx react-native run-android --deviceId=emulator-5554
```

### Smart TV
```bash
# Samsung Tizen
tizen emulator --name TV-5.0

# LG webOS
ares-launch-simulator TV_23
```

### Roku
```bash
# Use browser
open http://<ROKU_IP>
```

---

## 📝 Common Issues and Solutions

### Issue: iOS - UnifiedVideoPlayer.swiftmodule not built for arm64
**Solution:** The framework needs to be built for the correct architecture:
```bash
# Option 1: Use Swift Package Manager (auto-builds)
File > Add Package Dependencies > Add Local Package

# Option 2: Build universal framework
cd packages/ios
./build_framework.sh

# Option 3: Clean Xcode build
Product > Clean Build Folder (⇧⌘K)
File > Packages > Reset Package Caches
```

### Issue: iOS - Module 'UnifiedVideoPlayer' not found
**Solution:** Ensure the framework is properly added:
```bash
# Check target membership in Xcode
1. Select UnifiedVideoPlayer.framework
2. File Inspector > Target Membership
3. Check your app target

# Verify Build Phases
1. Target > Build Phases
2. Link Binary With Libraries should include UnifiedVideoPlayer
3. Embed Frameworks should include it with "Embed & Sign"
```

### Issue: DRM Content Not Playing
**Solution:** Ensure proper DRM configuration and certificates are in place for each platform.

### Issue: CORS Errors in Web
**Solution:** Configure proper CORS headers on your video server or use a proxy.

### Issue: React Native Build Fails
**Solution:** Clean and rebuild:
```bash
cd ios && pod deintegrate && pod install
cd android && ./gradlew clean
npx react-native start --reset-cache
```

### Issue: TV Remote Not Working
**Solution:** Register proper key codes for each TV platform and test in actual device.

---

## 🎯 Production Checklist

- [ ] Configure proper DRM licenses for protected content
- [ ] Set up CDN for video delivery
- [ ] Implement analytics tracking
- [ ] Add error reporting (Sentry, Crashlytics)
- [ ] Configure app signing certificates
- [ ] Test on actual devices
- [ ] Implement adaptive bitrate streaming
- [ ] Add offline download capability (mobile)
- [ ] Configure background playback (mobile)
- [ ] Implement Chromecast support

---

## 📚 Additional Resources

- [Web Platform Docs](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement)
- [iOS AVPlayer Docs](https://developer.apple.com/documentation/avfoundation/avplayer)
- [Android ExoPlayer Docs](https://exoplayer.dev/)
- [Samsung Tizen Docs](https://developer.samsung.com/smarttv)
- [LG webOS Docs](https://webostv.developer.lge.com/)
- [Roku SDK Docs](https://developer.roku.com/docs/developer-program/getting-started/roku-dev-prog.md)
- [Android TV Docs](https://developer.android.com/tv)

---

This guide provides everything needed to implement the Unified Video Framework on any supported platform. Choose your target platform and follow the step-by-step instructions to get started!
