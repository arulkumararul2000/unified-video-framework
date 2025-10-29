# Ad Markers Quick Start

## 60-Second Setup

### Step 1: Add Google Ads Config
```tsx
<WebPlayerView
  url="your-video.mp4"
  googleAds={{
    adTagUrl: "https://your-ad-server.com/vast",
    midrollTimes: [30, 60, 120], // 👈 These appear as markers!
  }}
/>
```

### Step 2: That's it! 🎉
Yellow markers now appear on the seekbar at 30s, 60s, and 120s.

---

## Common Customizations

### Change Marker Color
```tsx
chapters={{
  customStyles: {
    progressMarkers: {
      ad: '#FF6B35', // Orange markers
    },
  },
}}
```

### Disable Markers (Keep Ads)
```tsx
chapters={{
  showChapterMarkers: false,
}}
```

### Track Ad Events
```tsx
googleAds={{
  midrollTimes: [30, 60],
  onAdStart: () => console.log("Ad started"),
  onAdEnd: () => console.log("Ad ended"),
}}
```

---

## Full Example

```tsx
import { WebPlayerView } from 'unified-video-framework';

function MyPlayer() {
  return (
    <WebPlayerView
      url="https://example.com/video.mp4"
      
      // Google Ads with markers
      googleAds={{
        adTagUrl: "https://pubads.g.doubleclick.net/...",
        midrollTimes: [120, 240, 360], // Every 2 minutes
        onAdStart: () => console.log("Ad started"),
        onAdEnd: () => console.log("Ad ended"),
      }}
      
      // Optional: Customize marker appearance
      chapters={{
        enabled: true,
        showChapterMarkers: true,
        customStyles: {
          progressMarkers: {
            ad: '#FFD700', // Gold markers
          },
        },
      }}
      
      onReady={(player) => console.log("Player ready!")}
    />
  );
}
```

---

## Tips

✅ **DO**: Use strategic ad placement (every 3-5 minutes)  
✅ **DO**: Test with Google IMA test tags first  
✅ **DO**: Customize marker colors for brand consistency  

❌ **DON'T**: Place ads too frequently (< 2 minutes apart)  
❌ **DON'T**: Use milliseconds (use seconds: `30`, not `30000`)  
❌ **DON'T**: Forget to handle `onAdError` for graceful fallback  

---

## Troubleshooting

**Markers not showing?**
- Check console for "✅ Ad markers injected" log
- Ensure `midrollTimes` array is not empty
- Verify video has loaded (markers appear after metadata)

**Wrong positions?**
- Use seconds, not milliseconds: `[30, 60]` ✅ not `[30000, 60000]` ❌

**Need more help?**
- See full docs: [AD_MARKERS.md](./AD_MARKERS.md)
- Google Ads guide: [GOOGLE_ADS.md](./GOOGLE_ADS.md)
