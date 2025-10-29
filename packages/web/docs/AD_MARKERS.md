# Automatic Ad Markers

## Overview

The Unified Video Framework now automatically generates and displays visual markers on the seekbar for Google Ads mid-roll breaks. When you configure `googleAds.midrollTimes`, the framework will:

1. **Automatically generate chapter segments** for each ad break time
2. **Display visual markers** on the progress bar/seekbar
3. **Merge with existing chapters** if you have custom chapter data
4. **Support customization** of marker appearance

## Features

✅ **Automatic Generation**: No manual chapter configuration needed  
✅ **Visual Seekbar Markers**: Clear indication of upcoming ad breaks  
✅ **Customizable Styling**: Change marker colors and appearance  
✅ **Smart Merging**: Works alongside existing chapter data  
✅ **Time Labels**: Hover tooltips show ad break times  

## Basic Usage

### Simple Setup

```tsx
import { WebPlayerView } from 'unified-video-framework';

<WebPlayerView
  url="https://example.com/video.mp4"
  googleAds={{
    adTagUrl: "https://your-ad-server.com/vast-tag",
    midrollTimes: [30, 60, 120], // Ad breaks at 30s, 1min, 2min
  }}
/>
```

**That's it!** Yellow markers will automatically appear on the seekbar at 30s, 60s, and 120s.

### Custom Marker Colors

```tsx
<WebPlayerView
  url="https://example.com/video.mp4"
  googleAds={{
    adTagUrl: "https://your-ad-server.com/vast-tag",
    midrollTimes: [30, 60, 120],
  }}
  chapters={{
    enabled: true,
    showChapterMarkers: true,
    customStyles: {
      progressMarkers: {
        ad: '#FF6B35', // Orange markers for ads
      },
    },
  }}
/>
```

### Advanced: Combining with Existing Chapters

```tsx
<WebPlayerView
  url="https://example.com/video.mp4"
  googleAds={{
    adTagUrl: "https://your-ad-server.com/vast-tag",
    midrollTimes: [120, 240], // Ads at 2min and 4min
  }}
  chapters={{
    enabled: true,
    showChapterMarkers: true,
    data: {
      videoId: "my-video",
      duration: 600,
      segments: [
        {
          id: "intro",
          type: "intro",
          startTime: 0,
          endTime: 10,
          title: "Introduction",
        },
        {
          id: "content",
          type: "content",
          startTime: 10,
          endTime: 590,
          title: "Main Content",
        },
        {
          id: "credits",
          type: "credits",
          startTime: 590,
          endTime: 600,
          title: "Credits",
        },
        // Ad markers will be automatically added and merged!
      ],
    },
    customStyles: {
      progressMarkers: {
        intro: '#4ECDC4',   // Teal for intro
        credits: '#95E1D3', // Light green for credits
        ad: '#FFD700',      // Gold for ads
      },
    },
  }}
/>
```

## How It Works

### 1. Configuration
When you provide `googleAds.midrollTimes`, the framework stores these ad break times.

### 2. Video Load
After the video loads and metadata is available (duration known), the framework:
- Generates ad chapter segments from `midrollTimes`
- Creates markers with type `'ad'`
- Adds metadata like time labels

### 3. Chapter Merging
If you have existing chapter data:
- Ad markers are merged with your segments
- All segments are sorted by time
- Both chapter types display on the seekbar

### 4. Visual Rendering
The `ChapterProgress` component renders:
- Your custom chapter markers
- Auto-generated ad markers
- Hover tooltips with time information

## Generated Ad Marker Structure

Each ad marker is automatically generated with this structure:

```typescript
{
  id: "ad-0-30",                    // Unique ID
  type: "ad",                       // Chapter type
  startTime: 30,                    // Ad break time
  endTime: 30.1,                    // Instantaneous marker
  title: "Ad Break 1",              // User-friendly label
  skipLabel: "Skip Ad",             // Skip button text
  description: "Advertisement break at 0:30",
  autoSkip: false,
  metadata: {
    adBreakIndex: 0,
    originalTime: 30,
    source: "google-ads",
  },
}
```

## Styling Options

### Default Colors
The framework uses these default colors from `SEGMENT_COLORS`:

```typescript
{
  intro: '#00D9FF',
  recap: '#FFA500',
  credits: '#FF69B4',
  ad: '#FFFF00',      // Yellow for ads
  sponsor: '#9370DB',
  offensive: '#FF0000',
}
```

### Custom Colors

Override via `chapters.customStyles.progressMarkers`:

```tsx
chapters={{
  customStyles: {
    progressMarkers: {
      ad: '#FFD700',      // Gold
      intro: '#4ECDC4',   // Teal
      credits: '#95E1D3', // Light green
    },
  },
}}
```

### Advanced Styling

For more control, target CSS classes:

```css
/* All ad markers */
.uvf-chapter-progress-marker.uvf-marker-ad {
  background-color: #FFD700;
  width: 4px;
  height: 200%;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.6);
}

/* Ad marker hover state */
.uvf-chapter-progress-marker.uvf-marker-ad:hover {
  width: 5px;
  height: 250%;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.9);
}
```

## API Reference

### `googleAds.midrollTimes`
**Type**: `number[]`  
**Description**: Array of times (in seconds) when mid-roll ads should play  
**Example**: `[30, 60, 120, 180]`

### `chapters.showChapterMarkers`
**Type**: `boolean`  
**Default**: `true`  
**Description**: Enable/disable display of chapter markers (including ad markers)

### `chapters.customStyles.progressMarkers.ad`
**Type**: `string` (CSS color)  
**Default**: `'#FFFF00'` (yellow)  
**Description**: Color for ad markers on the progress bar

## Events

Ad-related events are available:

```tsx
<WebPlayerView
  googleAds={{
    adTagUrl: "...",
    midrollTimes: [30, 60],
    onAdStart: () => console.log("Ad started"),
    onAdEnd: () => console.log("Ad ended"),
    onAdError: (error) => console.error("Ad error:", error),
  }}
  onChapterSegmentEntered={(data) => {
    if (data.segment.type === 'ad') {
      console.log("User reached ad marker at:", data.segment.startTime);
    }
  }}
/>
```

## Best Practices

### 1. Strategic Placement
```tsx
// ✅ Good: Natural breaks in content
midrollTimes: [180, 360, 540] // Every 3 minutes

// ❌ Bad: Too frequent
midrollTimes: [15, 30, 45, 60, 75, 90] // Every 15 seconds
```

### 2. User Experience
```tsx
// Allow users to see upcoming ads
chapters={{
  showChapterMarkers: true, // Show markers
  customStyles: {
    progressMarkers: {
      ad: '#FFD700', // Visible color
    },
  },
}}
```

### 3. Accessibility
```tsx
// Ad markers have built-in titles for tooltips
// "Ad Break 1 (0:30)" appears on hover
```

### 4. Testing
```tsx
// Test with Google IMA test tags first
const TEST_AD_TAG = 'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=';

<WebPlayerView
  googleAds={{
    adTagUrl: TEST_AD_TAG,
    midrollTimes: [10, 20], // Short times for testing
  }}
/>
```

## Troubleshooting

### Markers Not Showing

**Problem**: Ad markers don't appear on seekbar

**Solutions**:
1. Ensure `midrollTimes` array is not empty
2. Check that `chapters.showChapterMarkers` is not set to `false`
3. Verify video duration is loaded (markers appear after metadata loads)
4. Check console for "✅ Ad markers injected" log

### Wrong Marker Positions

**Problem**: Markers appear at incorrect times

**Solution**: Ensure `midrollTimes` values are in seconds and within video duration

```tsx
// ✅ Correct: Times in seconds
midrollTimes: [30, 60, 120]

// ❌ Wrong: Times in milliseconds
midrollTimes: [30000, 60000, 120000]
```

### Markers Not Visible

**Problem**: Markers are too small or wrong color

**Solution**: Customize marker styling:

```tsx
chapters={{
  customStyles: {
    progressMarkers: {
      ad: '#FF0000', // Bright red for visibility
    },
  },
}}
```

### Conflicting with Existing Chapters

**Problem**: Ad markers interfere with custom chapters

**Solution**: The framework automatically merges and sorts. Customize colors to differentiate:

```tsx
chapters={{
  customStyles: {
    progressMarkers: {
      ad: '#FFD700',      // Gold for ads
      intro: '#4ECDC4',   // Teal for intro
      content: '#FFFFFF', // White for content
    },
  },
}}
```

## Browser Compatibility

Ad markers work on all browsers supported by the Unified Video Framework:
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- **Minimal overhead**: Markers are lightweight DOM elements
- **Efficient rendering**: Only renders visible markers
- **No impact on video playback**: Ad markers are purely visual

## Future Enhancements

Planned features:
- 🔜 Pre-roll and post-roll markers
- 🔜 VMAP schedule parsing (automatic from ad server)
- 🔜 Animated marker transitions
- 🔜 Clickable markers (skip to ad/past ad)
- 🔜 Ad marker tooltips with ad metadata

## Related Documentation

- [Google Ads Integration](./GOOGLE_ADS.md)
- [Chapter System](./CHAPTERS.md)
- [Custom Styling](./STYLING.md)

## Support

For issues or questions:
- GitHub Issues: [unified-video-framework/issues](https://github.com/your-org/unified-video-framework/issues)
- Documentation: [docs](./README.md)
