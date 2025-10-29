# Google Ads Integration for WebPlayerView

Complete guide for integrating Google IMA (Interactive Media Ads) with the Unified Video Framework's WebPlayerView React component.

## Overview

The Google Ads integration provides comprehensive support for:
- **Pre-roll ads**: Play before video content starts
- **Mid-roll ads**: Play during video at specified times
- **Post-roll ads**: Play after video content ends
- **Overlay ads**: Non-linear ads displayed over video
- **Companion ads**: Banner/sidebar ads displayed alongside video
- **Skippable & non-skippable ads**: Full control over ad experience
- **Bumper ads**: Short 6-second ads

## Quick Start

```tsx
import { WebPlayerView } from '@unified-video-framework/web';

function VideoPlayer() {
  return (
    <WebPlayerView
      url="https://example.com/video.mp4"
      googleAds={{
        adTagUrl: 'YOUR_VAST_OR_VMAP_AD_TAG_URL',
        onAdStart: () => console.log('Ad started'),
        onAdEnd: () => console.log('Ad ended'),
        onAdError: (error) => console.error('Ad error:', error),
      }}
    />
  );
}
```

## Configuration

### Basic Configuration

```tsx
<WebPlayerView
  url="video.mp4"
  googleAds={{
    adTagUrl: string;                    // Required: VAST/VMAP ad tag URL
    midrollTimes?: number[];             // Optional: Mid-roll ad times in seconds
    companionAdSlots?: CompanionAd[];    // Optional: Companion ad containers
    onAdStart?: () => void;              // Optional: Ad start callback
    onAdEnd?: () => void;                // Optional: Ad end callback
    onAdError?: (error: any) => void;    // Optional: Ad error callback
    onAllAdsComplete?: () => void;       // Optional: All ads complete callback
  }}
/>
```

### Full Configuration Example

```tsx
<WebPlayerView
  url="https://example.com/video.mp4"
  type="mp4"
  controls={true}
  
  googleAds={{
    // Ad tag from your ad server (Google Ad Manager, SpotX, etc.)
    adTagUrl: 'https://pubads.g.doubleclick.net/gampad/ads?...',
    
    // Mid-roll ads at 30s, 60s, and 120s
    midrollTimes: [30, 60, 120],
    
    // Companion ads (banner/sidebar)
    companionAdSlots: [
      {
        containerId: 'companion-ad-300x250',
        width: 300,
        height: 250,
      },
      {
        containerId: 'companion-ad-728x90',
        width: 728,
        height: 90,
      },
    ],
    
    // Event callbacks
    onAdStart: () => {
      console.log('Ad playback started');
      // Pause other content, show loading indicator, etc.
    },
    
    onAdEnd: () => {
      console.log('Ad playback ended, resuming content');
      // Resume other content, hide loading indicator, etc.
    },
    
    onAdError: (error) => {
      console.error('Ad failed:', error?.getMessage?.() || error);
      // Handle error gracefully, continue with content
    },
    
    onAllAdsComplete: () => {
      console.log('All ads in the pod completed');
      // Track completion, show next content, etc.
    },
  }}
  
  onReady={(player) => {
    console.log('Player ready with ads integration');
  }}
/>
```

## Ad Tag URLs

### VAST vs VMAP

**VAST (Video Ad Serving Template)**
- Single ad unit or ad pod
- Use for simple pre-roll, mid-roll, or post-roll
- Example: `https://example.com/vast.xml`

**VMAP (Video Multiple Ad Playlist)**
- Complete ad schedule with multiple ad breaks
- Defines when and where ads should play
- Preferred for complex ad schedules
- Example: `https://example.com/vmap.xml`

### Google Ad Manager

```typescript
const adTagUrl = 'https://pubads.g.doubleclick.net/gampad/ads?' + 
  'iu=/YOUR_AD_UNIT_ID&' +           // Your ad unit
  'sz=640x480&' +                     // Video size
  'cust_params=key1%3Dvalue1&' +      // Custom targeting
  'env=vp&' +                         // Video player environment
  'output=vast&' +                    // Output format
  'unviewed_position_start=1&' +      // Position tracking
  'url=[referrer_url]&' +             // Page URL
  'description_url=[description_url]&' + // Content URL
  'correlator=[timestamp]';            // Cache buster
```

### Test Ad Tags

Google provides test tags for development:

```typescript
// Single pre-roll ad
const testAdTagUrl = 'https://pubads.g.doubleclick.net/gampad/ads?' +
  'iu=/21775744923/external/single_ad_samples&' +
  'sz=640x480&' +
  'cust_params=sample_ct%3Dlinear&' +
  'output=vast&' +
  'unviewed_position_start=1&' +
  'env=vp&impl=s&correlator=';

// VMAP with pre-roll, mid-rolls, and post-roll
const vmapTestUrl = 'https://pubads.g.doubleclick.net/gampad/ads?' +
  'iu=/21775744923/external/vmap_ad_samples&' +
  'sz=640x480&' +
  'cust_params=sample_ar%3Dpremidpost&' +
  'output=vmap&' +
  'unviewed_position_start=1&' +
  'env=vp&impl=s&correlator=';
```

More test tags: https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/tags

## Mid-roll Ads

### Option 1: Client-side Specification

Specify exact times in seconds when ads should play:

```tsx
<WebPlayerView
  googleAds={{
    adTagUrl: 'YOUR_VAST_AD_TAG',
    midrollTimes: [30, 60, 120, 180],  // Ads at 30s, 60s, 120s, 180s
  }}
/>
```

### Option 2: Server-side VMAP Schedule

Let your ad server control the schedule via VMAP:

```tsx
<WebPlayerView
  googleAds={{
    adTagUrl: 'YOUR_VMAP_AD_TAG',  // VMAP includes ad break schedule
    // No midrollTimes needed - VMAP defines the schedule
  }}
/>
```

VMAP example structure:
```xml
<vmap:VMAP>
  <vmap:AdBreak timeOffset="start" breakType="linear">
    <!-- Pre-roll ad -->
  </vmap:AdBreak>
  <vmap:AdBreak timeOffset="00:00:30" breakType="linear">
    <!-- Mid-roll at 30 seconds -->
  </vmap:AdBreak>
  <vmap:AdBreak timeOffset="00:01:00" breakType="linear">
    <!-- Mid-roll at 60 seconds -->
  </vmap:AdBreak>
  <vmap:AdBreak timeOffset="end" breakType="linear">
    <!-- Post-roll ad -->
  </vmap:AdBreak>
</vmap:VMAP>
```

## Companion Ads

Companion ads are banner/sidebar ads displayed alongside the video.

### Setup

1. Create HTML containers with specific IDs:

```tsx
function VideoPage() {
  return (
    <div>
      {/* Video player */}
      <WebPlayerView
        url="video.mp4"
        googleAds={{
          adTagUrl: 'YOUR_AD_TAG',
          companionAdSlots: [
            {
              containerId: 'companion-ad-300x250',
              width: 300,
              height: 250,
            },
            {
              containerId: 'companion-ad-728x90',
              width: 728,
              height: 90,
            },
          ],
        }}
      />
      
      {/* Companion ad containers */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
        <div id="companion-ad-300x250" style={{ width: 300, height: 250 }} />
        <div id="companion-ad-728x90" style={{ width: 728, height: 90 }} />
      </div>
    </div>
  );
}
```

2. The ad manager will automatically populate these containers when companion ads are available.

### Common Companion Ad Sizes

- 300x250 (Medium Rectangle)
- 728x90 (Leaderboard)
- 160x600 (Wide Skyscraper)
- 300x600 (Half Page)
- 970x250 (Billboard)

## Event Callbacks

### onAdStart

Called when an ad begins playing:

```tsx
googleAds={{
  onAdStart: () => {
    // Video content is paused
    // Ad is now playing
    
    // Example actions:
    // - Show loading indicator
    // - Pause other media on page
    // - Send analytics event
    // - Update UI state
  }
}}
```

### onAdEnd

Called when an ad completes:

```tsx
googleAds={{
  onAdEnd: () => {
    // Ad finished playing
    // Video content will resume automatically
    
    // Example actions:
    // - Hide loading indicator
    // - Resume other media
    // - Send completion analytics
    // - Update UI state
  }
}}
```

### onAdError

Called when an ad fails to load or play:

```tsx
googleAds={{
  onAdError: (error) => {
    // Ad failed - video content will continue
    
    console.error('Ad error:', error?.getMessage?.() || error);
    
    // Common error reasons:
    // - No ad available for this request
    // - Network timeout
    // - Invalid ad tag URL
    // - Ad blocker detected
    // - CORS issues
    // - Unsupported ad format
    
    // Best practice: Fail gracefully and continue with content
  }
}}
```

### onAllAdsComplete

Called when all ads in a pod complete:

```tsx
googleAds={{
  onAllAdsComplete: () => {
    // All ads in the current ad break have finished
    
    // Example actions:
    // - Track total ad exposure
    // - Update completion metrics
    // - Show "return to content" message
  }
}}
```

## Advanced Usage

### Dynamic Ad Targeting

Pass custom parameters for ad targeting:

```tsx
const userId = 'user123';
const contentCategory = 'sports';

const adTagUrl = `https://pubads.g.doubleclick.net/gampad/ads?` +
  `iu=/YOUR_AD_UNIT&` +
  `sz=640x480&` +
  `cust_params=userId%3D${userId}%26category%3D${contentCategory}&` +
  `output=vast&correlator=${Date.now()}`;

<WebPlayerView
  googleAds={{ adTagUrl }}
/>
```

### Conditional Ad Loading

Load ads based on user subscription status:

```tsx
function VideoPlayer({ isPremiumUser }: { isPremiumUser: boolean }) {
  return (
    <WebPlayerView
      url="video.mp4"
      googleAds={!isPremiumUser ? {
        adTagUrl: 'YOUR_AD_TAG',
        onAdStart: () => console.log('Showing ad to free user'),
      } : undefined}
    />
  );
}
```

### Ad Performance Tracking

Track ad performance metrics:

```tsx
function VideoPlayer() {
  const [adMetrics, setAdMetrics] = useState({
    adsStarted: 0,
    adsCompleted: 0,
    adsErrored: 0,
    totalAdTime: 0,
  });
  
  const adStartTime = useRef<number>(0);

  return (
    <WebPlayerView
      url="video.mp4"
      googleAds={{
        adTagUrl: 'YOUR_AD_TAG',
        
        onAdStart: () => {
          adStartTime.current = Date.now();
          setAdMetrics(m => ({ ...m, adsStarted: m.adsStarted + 1 }));
        },
        
        onAdEnd: () => {
          const duration = (Date.now() - adStartTime.current) / 1000;
          setAdMetrics(m => ({
            ...m,
            adsCompleted: m.adsCompleted + 1,
            totalAdTime: m.totalAdTime + duration,
          }));
        },
        
        onAdError: () => {
          setAdMetrics(m => ({ ...m, adsErrored: m.adsErrored + 1 }));
        },
      }}
    />
  );
}
```

## Troubleshooting

### Ads Not Playing

**Check ad tag URL:**
```typescript
// Test with Google's sample ad tag first
const testUrl = 'https://pubads.g.doubleclick.net/gampad/ads?...(test tag)';
```

**Check browser console:**
- Look for IMA SDK errors
- Check network requests to ad server
- Verify no CORS issues

**Check ad container:**
- Ensure ad container element exists in DOM
- Verify container has proper dimensions
- Check z-index layering

### Ad Blocker Detection

Ad blockers may prevent ads from loading. Handle gracefully:

```tsx
googleAds={{
  onAdError: (error) => {
    if (error?.getMessage?.().includes('adblocker')) {
      console.log('Ad blocker detected');
      // Show message or continue with content
    }
  }
}}
```

### CORS Issues

Ensure your ad server allows your domain:
- Check `Access-Control-Allow-Origin` headers
- Configure ad server CORS settings
- Use proxy if necessary

### Network Timeouts

Handle slow ad loading:

```tsx
const [adTimeout, setAdTimeout] = useState(false);

useEffect(() => {
  const timeout = setTimeout(() => {
    if (!adStarted) {
      setAdTimeout(true);
      console.warn('Ad loading timeout - continuing with content');
    }
  }, 5000);
  
  return () => clearTimeout(timeout);
}, []);
```

## Best Practices

### 1. Fail Gracefully

Always allow content to play if ads fail:

```tsx
googleAds={{
  onAdError: (error) => {
    console.error('Ad error:', error);
    // Don't block content - continue playing video
  }
}}
```

### 2. Respect User Experience

- Don't overwhelm with too many mid-rolls
- Use appropriate ad frequencies
- Consider video length when placing mid-rolls
- Show skip button when appropriate

```tsx
// Good: One mid-roll every 2-3 minutes
midrollTimes: [120, 300, 480]

// Bad: Too frequent mid-rolls
midrollTimes: [30, 60, 90, 120, 150]  // Every 30 seconds!
```

### 3. Test Thoroughly

- Test with various ad formats
- Test on different devices and browsers
- Test with ad blockers enabled
- Test network failures
- Use Google's test tags during development

### 4. Monitor Performance

Track key metrics:
- Ad completion rate
- Error rate
- Average ad load time
- User engagement after ads

### 5. Optimize Ad Tags

- Use HTTPS for ad tags
- Include cache busters: `correlator=${Date.now()}`
- Pass relevant targeting parameters
- Use VMAP for complex schedules

## Browser Compatibility

The Google IMA SDK supports:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Security Considerations

1. **HTTPS Required**: Always use HTTPS for ad tags and video content
2. **Content Security Policy**: Allow Google IMA SDK domains
3. **Iframe Sandboxing**: IMA SDK handles sandboxing automatically
4. **Privacy**: Respect user privacy settings and GDPR compliance

```html
<!-- Add to CSP if needed -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' https://imasdk.googleapis.com; 
               connect-src 'self' https://pubads.g.doubleclick.net;">
```

## Resources

- [Google IMA SDK Documentation](https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side)
- [IMA SDK Test Tags](https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/tags)
- [VAST 4.0 Specification](https://www.iab.com/guidelines/vast/)
- [VMAP 1.0 Specification](https://www.iab.com/guidelines/vmap/)
- [Google Ad Manager](https://admanager.google.com/)

## Support

For issues related to:
- **Ad serving**: Contact your ad server provider (Google Ad Manager, SpotX, etc.)
- **IMA SDK**: Check [Google IMA SDK documentation](https://developers.google.com/interactive-media-ads)
- **Player integration**: Open an issue in the Unified Video Framework repository
