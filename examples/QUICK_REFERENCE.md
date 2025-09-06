# 🎯 Unified Video Framework - Quick Reference

## 📦 What You Can Access

When you install `unified-video-framework`, you get access to:

### Core Exports
```javascript
const { 
    BasePlayer,          // Base player class
    VideoPlayerFactory,  // Factory for creating players
    EventEmitter,       // Event system
    VERSION            // Framework version
} = require('unified-video-framework');
```

### Platform-Specific Components

#### Web (React)
```jsx
import { WebPlayerView } from 'unified-video-framework/web';

<WebPlayerView
    url="video.mp4"
    type="mp4"
    autoPlay={false}
    muted={false}
    paywall={paywallConfig}
    onReady={(player) => {}}
    onError={(error) => {}}
/>
```

#### React Native
```jsx
import { VideoPlayer } from 'unified-video-framework/react-native';

<VideoPlayer
    source={{ uri: 'video.mp4' }}
    style={{ width: '100%', height: 300 }}
/>
```

## 🔑 Key Features

### 1. Video Playback
- **Formats**: MP4, WebM, HLS (.m3u8), DASH (.mpd)
- **Streaming**: Adaptive bitrate support
- **Controls**: Play, pause, seek, volume, fullscreen

### 2. Paywall Integration
- **Free Preview**: Set preview duration before paywall
- **Payment Gateways**: Stripe, Cashfree
- **Rental System**: Time-based access (e.g., 48 hours)

### 3. Advanced Features
- **Subtitles**: Multiple language support
- **Analytics**: Event tracking and reporting
- **Themes**: Customizable player appearance
- **Cast**: Google Cast support
- **DRM**: Content protection

## 💻 Example Implementations

### Basic Video Player
```javascript
// Simple video playback
const player = new WebPlayer(containerElement, {
    autoplay: false,
    muted: false,
    debug: true
});

player.load({
    url: 'https://example.com/video.mp4',
    type: 'mp4'
});

player.play();
```

### With Paywall
```javascript
const paywallConfig = {
    enabled: true,
    apiBase: '/api',
    userId: 'user123',
    videoId: 'video456',
    gateways: ['stripe', 'cashfree'],
    pricing: {
        amount: 4.99,
        currency: 'USD',
        rentalDurationHours: 48
    }
};
```

### Event Handling
```javascript
player.on('play', () => console.log('Started'));
player.on('pause', () => console.log('Paused'));
player.on('timeupdate', (time) => console.log('Time:', time));
player.on('ended', () => console.log('Finished'));
player.on('error', (err) => console.error('Error:', err));
```

## 🛠️ API Methods

### Player Control
- `play()` - Start playback
- `pause()` - Pause playback
- `seek(seconds)` - Jump to time
- `setVolume(0-100)` - Set volume
- `mute()` / `unmute()` - Toggle audio
- `enterFullscreen()` - Go fullscreen
- `destroy()` - Clean up player

### Properties
- `getCurrentTime()` - Current playback position
- `getDuration()` - Total video duration
- `getVolume()` - Current volume (0-100)
- `isPlaying()` - Playing state
- `isMuted()` - Mute state

## 🎨 Theming

### Simple Theme
```javascript
playerTheme: '#ff0000' // Single color
```

### Advanced Theme
```javascript
playerTheme: {
    accent: '#ff4d4f',
    accent2: '#d9363e', 
    iconColor: '#ffffff',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.7)'
}
```

## 📊 Analytics Events

Track these events for analytics:
- `load` - Video loaded
- `play` - Playback started
- `pause` - Playback paused
- `timeupdate` - Progress update
- `ended` - Video completed
- `error` - Error occurred
- `quality_change` - Quality changed
- `subtitle_change` - Subtitle changed

## 🔗 Useful Endpoints (Backend)

If building a backend API:

```
GET  /api/videos              # Video catalog
GET  /api/videos/:id          # Video details
POST /api/sessions            # Create player session
POST /api/sessions/:id/events # Track events
GET  /api/rentals/config      # Paywall config
POST /api/rentals/process     # Process payment
GET  /api/analytics           # Analytics data
```

## 📱 Platform Support

| Platform | Package Path | Status |
|----------|-------------|---------|
| Web | `/web` | ✅ Ready |
| React Native | `/react-native` | ✅ Ready |
| Samsung TV | `/enact` | ✅ Ready |
| LG TV | `/enact` | ✅ Ready |
| Roku | `/roku` | 🚧 In Progress |
| Android Native | `/android` | ✅ Ready |
| iOS Native | `/ios` | ✅ Ready |

## 🚀 Next Steps

1. **Start Simple**: Use the [basic example](./1-basic-web-player/)
2. **Add Features**: Try the [React paywall example](./2-react-paywall/)
3. **Build Backend**: See [Node.js API example](./3-nodejs-api/)
4. **Go Advanced**: Explore all features in [advanced example](./4-advanced-features/)

## 📚 Resources

- [Full Documentation](../docs/README.md)
- [WebPlayerView Guide](../WEBPLAYERVIEW_GUIDE.md)
- [Setup Guide](../SETUP.md)
- [API Reference](../docs/api-reference.md)

---

For more detailed examples, explore each folder in the `/examples` directory!
