# Google Ads Integration Guide

## 🎯 Overview

The Unified Video Framework now supports **ALL types of Google Ads** through the Google IMA SDK:

- ✅ **Pre-roll ads** - Plays before video starts
- ✅ **Mid-roll ads** - Plays during video at specified times
- ✅ **Post-roll ads** - Plays after video ends
- ✅ **Overlay ads** - Non-linear banner ads on video
- ✅ **Companion ads** - Sidebar/banner ads next to player
- ✅ **Bumper ads** - Short 6-second unskippable ads
- ✅ **Skippable ads** - User can skip after 5 seconds
- ✅ **VAST/VMAP support** - Industry standard ad formats

---

## 📦 Installation

The Google IMA SDK is loaded automatically. No additional installation required.

---

## 🚀 Quick Start

### **1. Simple Pre-roll Ad (Before Video)**

```tsx
import { WebPlayerView } from 'unified-video-framework/web';

<WebPlayerView
  url="https://example.com/video.m3u8"
  googleAds={{
    adTagUrl: "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator="
  }}
/>
```

### **2. Pre-roll + Mid-roll + Post-roll Ads**

```tsx
<WebPlayerView
  url="https://example.com/video.m3u8"
  googleAds={{
    // VMAP tag that includes pre, mid, and post-roll ads
    adTagUrl: "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/vmap_ad_samples&sz=640x480&cust_params=sample_ar%3Dpremidpostpod&ciu_szs=300x250&gdfp_req=1&ad_rule=1&output=vmap&unviewed_position_start=1&env=vp&impl=s&cmsid=496&vid=short_onecue&correlator=",
    
    // Optional: Manually specify mid-roll times (if not using VMAP schedule)
    midrollTimes: [30, 60, 120], // Ads at 30s, 60s, 120s
    
    // Callbacks
    onAdStart: () => console.log('Ad started'),
    onAdEnd: () => console.log('Ad ended'),
    onAllAdsComplete: () => console.log('All ads finished'),
  }}
/>
```

### **3. Ads with Companion Banners**

```html
<!-- Your HTML -->
<div id="companion-ad-300x250"></div>
<div id="companion-ad-728x90"></div>

<div id="player-container"></div>
```

```tsx
<WebPlayerView
  url="https://example.com/video.m3u8"
  googleAds={{
    adTagUrl: "YOUR_AD_TAG_URL_WITH_COMPANIONS",
    companionAdSlots: [
      { containerId: 'companion-ad-300x250', width: 300, height: 250 },
      { containerId: 'companion-ad-728x90', width: 728, height: 90 }
    ]
  }}
/>
```

---

## 📖 Configuration Options

```typescript
interface GoogleAdsConfig {
  // REQUIRED: Your ad tag URL from Google Ad Manager
  adTagUrl: string;
  
  // OPTIONAL: Mid-roll ad times in seconds
  // Only needed if not using VMAP (which has built-in schedule)
  midrollTimes?: number[];  // e.g., [30, 60, 120]
  
  // OPTIONAL: Companion ad slots
  companionAdSlots?: Array<{
    containerId: string;  // HTML element ID
    width: number;        // Ad width
    height: number;       // Ad height
  }>;
  
  // OPTIONAL: Event callbacks
  onAdStart?: () => void;
  onAdEnd?: () => void;
  onAdError?: (error: any) => void;
  onAllAdsComplete?: () => void;
}
```

---

## 🎬 Complete Example

```tsx
import React, { useState } from 'react';
import { WebPlayerView } from 'unified-video-framework/web';

export function VideoPlayerWithAds() {
  const [adPlaying, setAdPlaying] = useState(false);
  
  return (
    <div>
      {/* Companion ad slots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
        <div id="companion-ad-1" style={{ width: 300, height: 250, background: '#f0f0f0' }}>
          Companion Ad Slot 1
        </div>
        <div id="companion-ad-2" style={{ width: 300, height: 250, background: '#f0f0f0' }}>
          Companion Ad Slot 2
        </div>
      </div>
      
      {/* Video player */}
      <WebPlayerView
        url="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
        autoPlay={false}
        
        googleAds={{
          // Pre-roll + Mid-roll + Post-roll VMAP tag
          adTagUrl: "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/vmap_ad_samples&sz=640x480&cust_params=sample_ar%3Dpremidpostpod&ciu_szs=300x250&gdfp_req=1&ad_rule=1&output=vmap&unviewed_position_start=1&env=vp&impl=s&cmsid=496&vid=short_onecue&correlator=",
          
          // Companion ads
          companionAdSlots: [
            { containerId: 'companion-ad-1', width: 300, height: 250 },
            { containerId: 'companion-ad-2', width: 300, height: 250 }
          ],
          
          // Callbacks
          onAdStart: () => {
            console.log('🎬 Ad started');
            setAdPlaying(true);
          },
          
          onAdEnd: () => {
            console.log('✅ Ad ended');
            setAdPlaying(false);
          },
          
          onAdError: (error) => {
            console.error('❌ Ad error:', error);
            setAdPlaying(false);
          },
          
          onAllAdsComplete: () => {
            console.log('🎉 All ads completed!');
          }
        }}
      />
      
      {/* Ad status indicator */}
      {adPlaying && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: 'red',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 5,
          fontWeight: 'bold'
        }}>
          AD PLAYING
        </div>
      )}
    </div>
  );
}
```

---

## 🧪 Test Ad Tags

Use these Google-provided test tags for development:

### Pre-roll Only (Single Ad)
```
https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=
```

### Pre-roll + Mid-roll + Post-roll (VMAP)
```
https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/vmap_ad_samples&sz=640x480&cust_params=sample_ar%3Dpremidpostpod&ciu_szs=300x250&gdfp_req=1&ad_rule=1&output=vmap&unviewed_position_start=1&env=vp&impl=s&cmsid=496&vid=short_onecue&correlator=
```

### Skippable Ad
```
https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dskippablelinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=
```

---

## 🎯 How It Works

1. **SDK Loading**: Google IMA SDK is automatically loaded when you configure `googleAds`
2. **Ad Request**: Player requests ads from your ad server using the ad tag URL
3. **Pre-roll**: If VMAP includes pre-roll, ad plays before video starts
4. **Content Playback**: Your video plays
5. **Mid-roll**: Ads pause video at specified times (from VMAP or `midrollTimes`)
6. **Post-roll**: Ad plays after video ends
7. **Companion Ads**: Display in your specified containers throughout
8. **Overlay Ads**: Non-linear ads show over video without pausing

---

## 📝 Getting Your Ad Tag URL

### Option 1: Google Ad Manager (Free)
1. Sign up at https://admanager.google.com
2. Create an inventory (video ad unit)
3. Generate ad tags
4. Copy the VAST/VMAP URL

### Option 2: Test Tags
Use Google's test tags (provided above) for development

### Option 3: Third-Party Ad Networks
- SpotX
- FreeWheel
- Brightcove
- JW Player Ads
(They all generate VAST/VMAP URLs compatible with IMA SDK)

---

## ⚙️ Advanced Features

### Manual Ad Control

```tsx
import { useRef } from 'react';

function AdvancedPlayer() {
  const playerRef = useRef(null);
  
  return (
    <>
      <WebPlayerView
        playerRef={playerRef}
        url="video.m3u8"
        googleAds={{ adTagUrl: "YOUR_TAG" }}
        onReady={(player) => {
          // Access ads manager
          const adsManager = (player as any).adsManager;
          
          // Manual controls
          // adsManager?.pause();
          // adsManager?.resume();
          // adsManager?.skip();
          // adsManager?.setVolume(0.5);
        }}
      />
      
      <button onClick={() => {
        const player = playerRef.current as any;
        player?.adsManager?.skip();
      }}>
        Skip Ad
      </button>
    </>
  );
}
```

---

## 🐛 Troubleshooting

### Ads not playing?

1. **Check ad tag URL** - Make sure it's valid VAST/VMAP
2. **User interaction** - Some browsers require user click before ads
3. **CORS** - Ad server must allow your domain
4. **Ad blocker** - Disable for testing
5. **Console errors** - Check browser console for detailed errors

### Ad errors?

The `onAdError` callback receives detailed error info:
```tsx
onAdError: (error) => {
  console.log('Error code:', error.getErrorCode());
  console.log('Error message:', error.getMessage());
}
```

---

## ✅ Summary

You can now play **ALL types of Google ads**:

- ✅ Just provide `adTagUrl` in `googleAds` prop
- ✅ Pre-roll, mid-roll, post-roll all work automatically (via VMAP)
- ✅ Overlay and companion ads supported
- ✅ Skippable and non-skippable ads
- ✅ Full event callbacks for tracking
- ✅ Automatic SDK loading
- ✅ Error handling with fallback to content

**That's it! Your player now supports Google Ads! 🎉**
