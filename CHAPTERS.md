# Chapter & Skip Functionality

The unified-video-framework now includes comprehensive chapter and skip functionality similar to Netflix's "Skip Intro" and "Skip Recap" features.

## Features

- 🎯 **Skip Intro/Recap/Credits**: Automatically detect and skip segments
- 🎨 **Custom Skip Buttons**: Fully themed and animated skip buttons  
- 📍 **Chapter Markers**: Visual markers on the progress bar
- ⚙️ **User Preferences**: Persistent user preferences for skip behavior
- 📱 **Mobile Responsive**: Touch-friendly skip buttons and markers
- ⚛️ **React Support**: Hooks and components for React integration
- ▶️ **Seamless Playback**: Video continues playing after skip for better UX
- 🎚️ **Configurable Resume**: Option to control playback behavior after skip

## Basic Usage

### 1. Enable Chapters in Player Config

```javascript
const player = new WebPlayer();

await player.initialize('#player-container', {
  chapters: {
    enabled: true,
    data: {
      videoId: "episode_s01e02",
      duration: 2820, // 47 minutes
      segments: [
        {
          id: "recap",
          type: "recap", 
          startTime: 0,
          endTime: 45,
          title: "Previously on Show Name",
          skipLabel: "Skip Recap"
        },
        {
          id: "intro",
          type: "intro",
          startTime: 45,
          endTime: 125, 
          title: "Opening Credits",
          skipLabel: "Skip Intro"
        },
        {
          id: "content",
          type: "content",
          startTime: 125,
          endTime: 2700,
          title: "Main Content"
        },
        {
          id: "credits", 
          type: "credits",
          startTime: 2700,
          endTime: 2820,
          title: "End Credits",
          skipLabel: "Skip Credits",
          autoSkip: true,
          autoSkipDelay: 10
        }
      ]
    },
    skipButtonPosition: 'bottom-right',
    showChapterMarkers: true,
    userPreferences: {
      autoSkipIntro: false,
      autoSkipRecap: true,
      showSkipButtons: true,
      resumePlaybackAfterSkip: true  // NEW: Continue playing after skip (default: true)
    }
  }
});
```

### 2. Load Chapters from URL

```javascript
const player = new WebPlayer();

await player.initialize('#player-container', {
  chapters: {
    enabled: true,
    dataUrl: '/api/chapters/episode_123'
  }
});
```

### 3. Dynamic Chapter Loading

```javascript
// Load chapters after player initialization
const chaptersData = await fetch('/api/episodes/123/chapters').then(r => r.json());
await player.loadChapters(chaptersData);

// Or load from URL
await player.loadChaptersFromUrl('/api/chapters/episode_123');
```

## Configuration Options

```typescript
interface ChapterConfig {
  enabled: boolean;                    // Enable/disable chapters
  data?: VideoChapters;               // Chapter data
  dataUrl?: string;                   // URL to fetch chapters
  autoHide?: boolean;                 // Auto-hide skip button
  autoHideDelay?: number;             // Hide delay (ms)  
  showChapterMarkers?: boolean;       // Show progress bar markers
  skipButtonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  userPreferences?: {
    autoSkipIntro?: boolean;          // Auto-skip intro segments
    autoSkipRecap?: boolean;          // Auto-skip recap segments  
    autoSkipCredits?: boolean;        // Auto-skip credits segments
    showSkipButtons?: boolean;        // Show skip buttons
    skipButtonTimeout?: number;       // Button timeout (ms)
    rememberChoices?: boolean;        // Remember user preferences
    resumePlaybackAfterSkip?: boolean; // Resume playback after skip (default: true)
  };
}
```

## Segment Types

- **`intro`**: Opening credits, theme music
- **`recap`**: "Previously on..." segments  
- **`content`**: Main video content
- **`credits`**: End credits, closing music
- **`ad`**: Advertisement segments

## React Integration

### WebPlayerView Component

The WebPlayerView component supports comprehensive chapter configuration through props:

```tsx
import { WebPlayerView } from 'unified-video-framework/web';

function MyVideoPlayer() {
  return (
    <WebPlayerView
      url="https://example.com/video.m3u8"
      chapters={{
        enabled: true,
        data: {
          videoId: "episode_s01e02",
          duration: 185,
          segments: [
            {
              id: "recap",
              type: "recap",
              startTime: 0,
              endTime: 45,
              title: "Previously on Show Name",
              skipLabel: "Skip Recap"
            },
            {
              id: "intro",
              type: "intro",
              startTime: 45,
              endTime: 125,
              title: "Opening Credits",
              skipLabel: "Skip Intro",
              autoSkip: true,
              autoSkipDelay: 5
            },
            {
              id: "content",
              type: "content",
              startTime: 125,
              endTime: 2700,
              title: "Main Content"
            },
            {
              id: "credits",
              type: "credits",
              startTime: 2700,
              endTime: 2820,
              title: "End Credits",
              skipLabel: "Skip Credits",
              autoSkip: true,
              autoSkipDelay: 10
            }
          ]
        },
        skipButtonPosition: 'bottom-right',
        showChapterMarkers: true,
        customStyles: {
          skipButton: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderColor: '#00ff00',
            fontSize: '18px'
          }
        },
        userPreferences: {
          autoSkipIntro: false,
          autoSkipRecap: true,
          showSkipButtons: true,
          resumePlaybackAfterSkip: true  // Enhanced UX: Continue playing after skip
        }
      }}
      // Chapter event callbacks
      onChapterChange={(chapter) => {
        console.log('Chapter changed:', chapter?.title || 'none');
      }}
      onSegmentEntered={(segment) => {
        console.log('Entered segment:', segment.title);
      }}
      onSegmentExited={(segment) => {
        console.log('Exited segment:', segment.title);
      }}
      onSegmentSkipped={(segment) => {
        console.log('Skipped segment:', segment.title);
      }}
      onChapterSegmentEntered={(data) => {
        console.log('Web segment entered:', data.segment.type);
      }}
      onChapterSegmentSkipped={(data) => {
        console.log('Web segment skipped:', data.fromSegment.type, 'to', data.toSegment?.type);
      }}
      onChapterSkipButtonShown={(data) => {
        console.log('Skip button shown for:', data.segment.type);
      }}
      onChapterSkipButtonHidden={(data) => {
        console.log('Skip button hidden for:', data.segment.type, 'reason:', data.reason);
      }}
      onChaptersLoaded={(data) => {
        console.log('Loaded', data.segmentCount, 'segments');
      }}
      onChaptersLoadError={(data) => {
        console.error('Failed to load chapters:', data.error.message);
      }}
    />
  );
}
```

#### Chapter Props Interface

```typescript
interface ChapterProps {
  enabled?: boolean;                    // Enable/disable chapters (default: false)
  data?: {                             // Chapter data
    videoId: string;
    duration: number;
    segments: Array<{
      id: string;
      type: 'intro' | 'recap' | 'content' | 'credits' | 'ad' | 'sponsor' | 'offensive';
      startTime: number;
      endTime: number;
      title: string;
      skipLabel?: string;               // Custom skip button text
      description?: string;
      thumbnail?: string;
      autoSkip?: boolean;               // Enable auto-skip for this segment
      autoSkipDelay?: number;           // Countdown delay in seconds
      metadata?: Record<string, any>;
    }>;
  };
  dataUrl?: string;                    // URL to fetch chapters from API
  autoHide?: boolean;                  // Auto-hide skip button (default: true)  
  autoHideDelay?: number;             // Hide delay in milliseconds (default: 5000)
  showChapterMarkers?: boolean;        // Show progress bar markers (default: true)
  skipButtonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  customStyles?: {                     // Custom styling for skip elements
    skipButton?: {
      backgroundColor?: string;
      borderColor?: string;
      textColor?: string;
      fontSize?: string;
      borderRadius?: string;
      padding?: string;
      fontWeight?: string;
    };
    progressMarkers?: {
      intro?: string;                  // Color for intro markers
      recap?: string;                  // Color for recap markers  
      credits?: string;                // Color for credits markers
      ad?: string;                     // Color for ad markers
    };
  };
  userPreferences?: {                  // User skip preferences
    autoSkipIntro?: boolean;          // Auto-skip intro segments (default: false)
    autoSkipRecap?: boolean;          // Auto-skip recap segments (default: false)  
    autoSkipCredits?: boolean;        // Auto-skip credits segments (default: false)
    showSkipButtons?: boolean;        // Show skip buttons (default: true)
    skipButtonTimeout?: number;       // Button timeout in milliseconds (default: 5000)
    rememberChoices?: boolean;        // Remember user preferences (default: true)
    resumePlaybackAfterSkip?: boolean; // Resume playback after skipping (default: true)
  };
}
```

#### Chapter Event Callbacks

```typescript
interface ChapterEventCallbacks {
  onChapterChange?: (chapter: any) => void;                                    // Core chapter changed
  onSegmentEntered?: (segment: any) => void;                                  // Segment entered  
  onSegmentExited?: (segment: any) => void;                                   // Segment exited
  onSegmentSkipped?: (segment: any) => void;                                  // Segment skipped
  onChapterSegmentEntered?: (data: { segment: any; timestamp: number }) => void;  // Web-specific segment entered
  onChapterSegmentSkipped?: (data: { fromSegment: any; toSegment?: any; timestamp: number }) => void; // Web-specific segment skipped
  onChapterSkipButtonShown?: (data: { segment: any; position: string }) => void;   // Skip button shown
  onChapterSkipButtonHidden?: (data: { segment: any; reason: string }) => void;    // Skip button hidden  
  onChaptersLoaded?: (data: { segmentCount: number; chapters: any[] }) => void;    // Chapters loaded
  onChaptersLoadError?: (data: { error: Error; url?: string }) => void;            // Chapters load error
}
```

### useChapters Hook

```tsx
import { useChapters } from 'unified-video-framework/chapters';

function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const {
    currentSegment,
    chapters,
    isSkipButtonVisible,
    loadChapters,
    skipCurrentSegment,
    getChapterMarkers
  } = useChapters({
    videoElement: videoRef.current,
    onSegmentEntered: (segment) => {
      console.log('Entered:', segment.type);
    },
    onSegmentSkipped: (from, to) => {
      console.log('Skipped from', from.type, 'to', to?.type);
    }
  });

  return (
    <div>
      <video ref={videoRef} />
      
      {/* Current segment info */}
      {currentSegment && (
        <div>Now playing: {currentSegment.title}</div>
      )}
      
      {/* Chapter markers */}
      <ChapterProgress 
        chapters={chapters}
        progress={50}
        onMarkerClick={(segment) => skipToSegment(segment.id)}
      />
    </div>
  );
}
```

### SkipButton Component

```tsx
import { SkipButton } from 'unified-video-framework/chapters';

function CustomPlayer() {
  const [currentSegment, setCurrentSegment] = useState(null);
  const [showSkip, setShowSkip] = useState(false);

  return (
    <div className="player-container">
      <video />
      
      <SkipButton
        segment={currentSegment}
        visible={showSkip}
        position="bottom-right"
        onSkip={(segment) => {
          console.log('Skipping:', segment.type);
          // Handle skip logic
        }}
        enableAutoSkip={true}
      />
    </div>
  );
}
```

### ChapterProgress Component

```tsx
import { ChapterProgress } from 'unified-video-framework/chapters';

function ProgressBar() {
  return (
    <ChapterProgress
      chapters={chaptersData}
      progress={currentProgress}
      buffered={bufferedProgress}
      showMarkers={true}
      onMarkerClick={(segment) => {
        player.skipToSegment(segment.id);
      }}
      onProgressClick={(percentage) => {
        const time = (percentage / 100) * videoDuration;
        player.seek(time);
      }}
    />
  );
}
```

## API Methods

### Player Methods

```javascript
// Chapter management
player.loadChapters(chaptersData)           // Load chapter data
player.loadChaptersFromUrl(url)            // Load from URL
player.hasChapters()                       // Check if chapters loaded
player.getChapters()                       // Get chapter data

// Segment navigation
player.getCurrentSegment()                 // Get current segment
player.skipToSegment(segmentId)           // Skip to specific segment
player.getSegments()                      // Get all segments

// Configuration
player.updateChapterConfig(newConfig)     // Update chapter config
```

### Events

```javascript
// Core chapter events
player.on('chapterchange', (chapter) => {
  console.log('Chapter changed:', chapter?.title || 'none');
});

player.on('segmententered', (segment) => {
  console.log('Entered segment:', segment.title);
});

player.on('segmentexited', (segment) => {
  console.log('Exited segment:', segment.title);
});

player.on('segmentskipped', (segment) => {
  console.log('Skipped segment:', segment.title);
});

// Web-specific chapter events
player.on('chapterSegmentEntered', (data) => {
  console.log('Entered segment:', data.segment);
});

player.on('chapterSegmentSkipped', (data) => {
  console.log('Skipped:', data.fromSegment.type, 'to', data.toSegment?.type);
});

player.on('chapterSkipButtonShown', (data) => {
  console.log('Skip button shown for:', data.segment.type);
});

player.on('chapterSkipButtonHidden', (data) => {
  console.log('Skip button hidden for:', data.segment.type, 'reason:', data.reason);
});

player.on('chaptersLoaded', (data) => {
  console.log('Loaded', data.segmentCount, 'segments');
});

player.on('chaptersLoadError', (data) => {
  console.error('Failed to load chapters:', data.error.message);
});
```

## User Preferences

```javascript
import { UserPreferencesManager } from 'unified-video-framework/chapters';

// Create preferences manager
const preferences = new UserPreferencesManager({
  autoSkipIntro: true,
  showSkipButtons: true
});

// Update preferences
preferences.setPreference('autoSkipCredits', true);
preferences.toggleAutoSkip('intro');

// Listen for changes
preferences.addListener((prefs) => {
  console.log('Preferences updated:', prefs);
});

// Create UI panel
const panel = preferences.createPreferencesPanel();
document.body.appendChild(panel);
```

## Advanced Features

### Custom Skip Button Positioning

```javascript
const player = new WebPlayer();
await player.initialize('#player', {
  chapters: {
    enabled: true,
    skipButtonPosition: 'top-left',    // Custom position
    customStyles: {
      skipButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        borderColor: '#00ff00',
        fontSize: '18px'
      }
    }
  }
});
```

### Auto-Skip Configuration

```javascript
const chaptersWithAutoSkip = {
  videoId: "episode_123",
  duration: 3600,
  segments: [
    {
      id: "intro",
      type: "intro",
      startTime: 30,
      endTime: 120,
      autoSkip: true,           // Enable auto-skip
      autoSkipDelay: 5         // 5 second countdown
    },
    {
      id: "credits",
      type: "credits", 
      startTime: 3480,
      endTime: 3600,
      autoSkip: true,
      autoSkipDelay: 10        // 10 second countdown
    }
  ]
};
```

### Chapter Markers Customization

```javascript
// Custom marker colors
const customColors = {
  intro: '#ff6b35',
  recap: '#ffd700', 
  credits: '#9370db',
  ad: '#ff4444'
};

// React component
<ChapterProgress
  chapters={chapters}
  markerColors={customColors}
  onMarkerClick={(segment) => handleMarkerClick(segment)}
/>
```

## Theming

Chapter functionality automatically integrates with the player's theme system:

```javascript
// Skip buttons and markers will use theme colors
player.setTheme({
  accent: '#e50914',    // Netflix red
  accent2: '#ff4040'    // Lighter red
});
```

## Enhanced Skip Functionality & UX

### Seamless Playback Resume

The framework now includes **enhanced skip functionality** that automatically preserves playback state for a better user experience:

```tsx
// Enhanced UX configuration (recommended)
<WebPlayerView
  chapters={{
    enabled: true,
    data: chaptersData,
    userPreferences: {
      // NEW: Video continues playing after skip button press
      resumePlaybackAfterSkip: true,  // Default: true (recommended)
      showSkipButtons: true,
      autoSkipIntro: false
    }
  }}
/>
```

### Skip Behavior Options

#### 1. **Seamless Continue (Recommended)**
```javascript
// Best for streaming/binge-watching experiences
resumePlaybackAfterSkip: true  // Default
```
- ✅ Video continues playing after skip
- ✅ Smooth, uninterrupted viewing experience
- ✅ Perfect for entertainment content
- ✅ Handles autoplay restrictions gracefully

#### 2. **Pause After Skip**
```javascript
// Best for educational/instructional content
resumePlaybackAfterSkip: false
```
- ⏸️ Video pauses after skip for user control
- 📚 Good for learning materials
- 🎯 Allows users to process content changes

### Technical Implementation

The skip functionality now includes:

```javascript
// Automatic playback state preservation
const wasPlaying = !videoElement.paused;

// Seek to target time
videoElement.currentTime = targetTime;

// Resume playback if video was playing (better UX)
if (shouldResumePlayback && wasPlaying && videoElement.paused) {
  // Small delay ensures seeking is complete
  setTimeout(() => {
    videoElement.play().catch(() => {
      // Graceful handling of autoplay restrictions
      console.warn('Could not resume playback - user interaction may be required');
    });
  }, 50);
}
```

### Error Handling

- **Autoplay Restrictions**: Gracefully handles browser autoplay policies
- **Network Issues**: Continues attempting playback during buffering
- **User Interruption**: Respects user pause actions during skip
- **Timing Conflicts**: Prevents race conditions with multiple skip actions

### Mobile Considerations

- **Touch-Friendly**: Large skip buttons optimized for mobile
- **Performance**: Minimal impact on mobile battery/performance
- **Autoplay**: Smart handling of mobile autoplay restrictions
- **Orientation**: Skip buttons adapt to device orientation

### Accessibility Features

- **Keyboard Support**: Space/Enter keys activate skip buttons
- **Screen Readers**: Proper ARIA labels for skip functionality
- **High Contrast**: Skip buttons respect system accessibility settings
- **Focus Management**: Proper focus handling after skip actions

## Browser Support

- ✅ Chrome 60+
- ✅ Firefox 55+ 
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ Mobile browsers (iOS Safari, Android Chrome)

## Troubleshooting

### Skip Button Not Showing

**Problem**: Skip buttons don't appear during segments

**Solutions**:
1. **Enable chapters**: Ensure `chapters.enabled: true`
2. **Check segment configuration**:
   ```javascript
   // Make sure segments have proper time ranges
   {
     id: "intro",
     type: "intro",        // Must be skippable type (not 'content')
     startTime: 0,         // Valid start time
     endTime: 30,          // End time > start time
     showSkipButton: true  // Explicitly enable (optional)
   }
   ```
3. **Verify user preferences**:
   ```javascript
   userPreferences: {
     showSkipButtons: true  // Must be true
   }
   ```
4. **Check video duration**: Ensure `chapters.data.duration` matches actual video length
5. **Debug logging**: Enable `debug: true` in player config

### Playback Doesn't Resume After Skip

**Problem**: Video pauses after clicking skip button

**Solutions**:
1. **Enable resume playback**:
   ```javascript
   userPreferences: {
     resumePlaybackAfterSkip: true  // Ensure this is true (default)
   }
   ```
2. **Check autoplay restrictions**: Some browsers block programmatic play
3. **User interaction**: Ensure user has interacted with page before skip
4. **Console errors**: Check browser console for autoplay policy warnings

### Chapter Markers Not Visible

**Problem**: Progress bar doesn't show chapter markers

**Solutions**:
1. **Enable markers**: Set `showChapterMarkers: true`
2. **CSS conflicts**: Check for CSS that might hide `.uvf-chapter-marker` elements
3. **Segment types**: Markers only show for non-content segments by default
4. **Duration mismatch**: Verify `chapters.duration` matches video duration

### Auto-Skip Not Working

**Problem**: Segments don't auto-skip even with `autoSkip: true`

**Solutions**:
1. **Check user preferences**:
   ```javascript
   userPreferences: {
     autoSkipIntro: true,    // For intro segments
     autoSkipRecap: true,    // For recap segments
     autoSkipCredits: true   // For credits segments
   }
   ```
2. **Verify segment configuration**:
   ```javascript
   {
     id: "intro",
     type: "intro",
     autoSkip: true,
     autoSkipDelay: 5  // Must have delay
   }
   ```
3. **User interaction**: Auto-skip requires prior user interaction with player

### Performance Issues

**Problem**: Chapter functionality causes lag or performance issues

**Solutions**:
1. **Optimize segment count**: Limit to essential segments (< 20 per video)
2. **Reduce polling**: Increase `skipButtonTimeout` to reduce DOM updates
3. **Disable markers**: Set `showChapterMarkers: false` if not needed
4. **Lazy loading**: Use `dataUrl` instead of inline `data` for large chapter sets

### Debug Logging

Enable comprehensive logging to diagnose issues:

```javascript
// Enable debug mode
const player = new WebPlayer();
await player.initialize('#player', {
  debug: true,  // Shows chapter-related console logs
  chapters: {
    enabled: true,
    data: chaptersData
  }
});

// Log chapter events
player.on('chaptersLoaded', (data) => {
  console.log('✅ Chapters loaded:', data.segmentCount, 'segments');
});

player.on('chaptersLoadError', (data) => {
  console.error('❌ Chapter load failed:', data.error.message);
});

player.on('chapterSegmentEntered', (data) => {
  console.log('🎬 Entered segment:', data.segment.type, data.segment.title);
});

player.on('chapterSkipButtonShown', (data) => {
  console.log('🔘 Skip button shown:', data.segment.type);
});
```

## Examples

Check out the `/examples` directory for complete implementation examples:

- **Basic Skip Buttons**: Simple intro/credits skipping
- **React Integration**: Full React component usage  
- **Custom Theming**: Themed skip buttons and markers
- **User Preferences**: Persistent user settings
- **Advanced Features**: Auto-skip, custom positioning
- **Enhanced UX**: Seamless playback resume examples

---

For more information, see the [API documentation](./API.md) or check out the [live demo](https://player-demo.unified-video.com).