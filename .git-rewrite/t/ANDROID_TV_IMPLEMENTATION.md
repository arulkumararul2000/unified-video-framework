# Android TV Implementation Strategy

## Current Gap Analysis

The framework currently lacks Android TV support because:

1. **Architecture Decision Pending**: Android TV can be implemented via multiple approaches
2. **Platform Overlap**: Android TV shares characteristics with both mobile (Android) and TV (webOS/Tizen) platforms
3. **Resource Prioritization**: Core web implementation was completed first as proof of concept

## Implementation Approaches

### Option 1: React Native TV Fork
```
packages/
  react-native-tv/        # New package
    src/
      AndroidTVPlayer.tsx
      components/
        TVFocusGuide.tsx
        TVRemoteHandler.tsx
    android/
      src/main/java/
        com/unifiedvideo/tv/
          TVPlayerModule.java
          TVPlayerPackage.java
```

**Pros:**
- Leverages existing React Native knowledge
- Good community support (react-native-tvos)
- Shared codebase with mobile

**Cons:**
- Requires maintaining TV-specific fork
- Performance overhead of React Native bridge

### Option 2: Native Android TV App
```
packages/
  android-tv/             # New package
    src/
      main/
        java/
          com/unifiedvideo/androidtv/
            player/
              ExoPlayerWrapper.kt
              DRMHandler.kt
            ui/
              PlayerActivity.kt
              LeanbackFragment.kt
        res/
          layout/
            activity_player.xml
```

**Pros:**
- Best performance
- Full access to Android TV Leanback library
- Native ExoPlayer integration

**Cons:**
- Requires Kotlin/Java expertise
- Separate codebase from other platforms

### Option 3: Web-Based (Hybrid)
```
packages/
  web-tv/                 # Extended web package
    src/
      AndroidTVAdapter.ts
      remote/
        DPadNavigation.ts
        RemoteControl.ts
      focus/
        SpatialNavigation.ts
```

**Pros:**
- Reuses existing web implementation
- Works on Android TV WebView
- Easier maintenance

**Cons:**
- Limited access to native features
- Performance constraints of WebView

## Recommended Approach

### Phase 1: Web-Based MVP (Quick Win)
1. Extend the web package with TV navigation
2. Add D-pad support and spatial navigation
3. Create Android TV wrapper app with WebView

### Phase 2: Native Integration
1. Implement native Android TV app with ExoPlayer
2. Add Leanback UI components
3. Integrate with existing core interfaces

### Phase 3: Feature Parity
1. Add DRM support (Widevine)
2. Implement advanced features (PiP, voice control)
3. Support for Live Channels integration

## Implementation Roadmap

### Week 1-2: Setup & Planning
- [ ] Choose implementation approach
- [ ] Set up Android TV development environment
- [ ] Create package structure
- [ ] Define API contracts

### Week 3-4: Core Player
- [ ] Implement basic video playback
- [ ] Add HLS/DASH support via ExoPlayer
- [ ] Handle remote control events
- [ ] Implement focus management

### Week 5-6: UI & Navigation
- [ ] Create TV-optimized UI
- [ ] Implement spatial navigation
- [ ] Add quality selection for TV
- [ ] Create settings screen

### Week 7-8: Advanced Features
- [ ] Add subtitle support
- [ ] Implement audio track selection
- [ ] Add Chromecast support
- [ ] Integrate analytics

### Week 9-10: Testing & Polish
- [ ] Test on multiple Android TV devices
- [ ] Performance optimization
- [ ] Accessibility features
- [ ] Documentation

## Technical Requirements

### Dependencies
```json
{
  "dependencies": {
    "com.google.android.exoplayer:exoplayer": "2.19.1",
    "androidx.leanback:leanback": "1.2.0",
    "androidx.tvprovider:tvprovider": "1.1.0"
  }
}
```

### Minimum Requirements
- Android TV 5.0 (API 21)
- ExoPlayer 2.x
- AndroidX libraries

### Key Features to Implement
1. **Player Core**
   - ExoPlayer integration
   - Adaptive streaming (HLS/DASH)
   - DRM support (Widevine L1/L3)

2. **TV-Specific UI**
   - Leanback launcher integration
   - Browse fragments for content
   - Playback overlay controls

3. **Remote Control**
   - D-pad navigation
   - Media buttons handling
   - Voice search integration

4. **Performance**
   - Hardware acceleration
   - 4K/HDR support
   - Low latency mode for gaming

## Sample Implementation

### Basic Android TV Player Activity
```kotlin
// packages/android-tv/src/main/java/com/unifiedvideo/androidtv/PlayerActivity.kt

class PlayerActivity : FragmentActivity() {
    private lateinit var playerView: PlayerView
    private lateinit var exoPlayer: ExoPlayer
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_player)
        
        initializePlayer()
        handleRemoteControl()
    }
    
    private fun initializePlayer() {
        exoPlayer = ExoPlayer.Builder(this)
            .setTrackSelector(DefaultTrackSelector(this))
            .build()
            
        playerView.player = exoPlayer
        
        val mediaItem = MediaItem.fromUri(intent.getStringExtra("video_url"))
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.prepare()
        exoPlayer.play()
    }
    
    private fun handleRemoteControl() {
        // D-pad and media button handling
    }
    
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> {
                togglePlayback()
                true
            }
            KeyEvent.KEYCODE_DPAD_CENTER -> {
                showControls()
                true
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }
}
```

### TV-Specific Manifest
```xml
<!-- packages/android-tv/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <uses-feature
        android:name="android.software.leanback"
        android:required="true" />
        
    <uses-feature
        android:name="android.hardware.touchscreen"
        android:required="false" />
        
    <application
        android:banner="@drawable/tv_banner"
        android:icon="@mipmap/ic_launcher"
        android:theme="@style/Theme.Leanback">
        
        <activity
            android:name=".MainActivity"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />
            </intent-filter>
        </activity>
        
        <activity
            android:name=".PlayerActivity"
            android:configChanges="orientation|screenSize"
            android:launchMode="singleTask"
            android:theme="@style/Theme.Player" />
            
    </application>
</manifest>
```

## Integration with Existing Framework

### Core Interface Implementation
```typescript
// packages/android-tv/src/bridge/AndroidTVBridge.ts

import { IVideoPlayer } from '@video-framework/core';

export class AndroidTVBridge implements IVideoPlayer {
    private native: any; // Native Android module
    
    async load(source: VideoSource): Promise<void> {
        return this.native.loadVideo(source.url, source.drmConfig);
    }
    
    async play(): Promise<void> {
        return this.native.play();
    }
    
    async pause(): Promise<void> {
        return this.native.pause();
    }
    
    // ... other methods
}
```

## Next Steps

1. **Immediate Actions**
   - Decide on implementation approach based on team skills
   - Set up Android TV emulator/device for testing
   - Create package structure

2. **Development Priorities**
   - Start with web-based approach for quick prototype
   - Evaluate performance and user experience
   - Iterate towards native implementation if needed

3. **Team Requirements**
   - Android developer with TV experience
   - UI/UX designer familiar with TV interfaces
   - QA with access to various Android TV devices

## Resources

- [Android TV Developer Guide](https://developer.android.com/tv)
- [ExoPlayer Documentation](https://exoplayer.dev/)
- [Leanback Library Guide](https://developer.android.com/tv/leanback)
- [Android TV Design Guidelines](https://designguidelines.withgoogle.com/android-tv/)
