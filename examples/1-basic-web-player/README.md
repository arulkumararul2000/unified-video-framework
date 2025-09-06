# Basic Web Player Example

This example demonstrates the fundamental features of the Unified Video Framework web player using vanilla HTML and JavaScript.

## 🚀 Quick Start

1. Open `index.html` in a modern web browser
2. Select a video source from the dropdown
3. Click "Load Video" to start

## 📋 Features Demonstrated

- **Video Loading**: Support for MP4, HLS, and DASH formats
- **Playback Controls**: Play, pause, seek forward/backward
- **Volume Control**: Mute/unmute and volume slider
- **Fullscreen**: Enter fullscreen mode
- **Status Display**: Current time, duration, buffering progress
- **Event Logging**: Real-time event monitoring
- **Error Handling**: Graceful error display

## 🛠️ Using in Your Project

### Installation
```bash
npm install unified-video-framework
```

### Basic Implementation
```javascript
import { WebPlayer } from 'unified-video-framework/web';

// Create player instance
const container = document.getElementById('videoContainer');
const player = new WebPlayer(container, {
    autoplay: false,
    muted: false,
    debug: true
});

// Load video
player.load({
    url: 'https://example.com/video.mp4',
    type: 'mp4'
});

// Control playback
player.play();
player.pause();
player.seek(30); // Seek to 30 seconds
player.setVolume(50); // Set volume to 50%
```

### Event Handling
```javascript
player.on('play', () => {
    console.log('Video started playing');
});

player.on('pause', () => {
    console.log('Video paused');
});

player.on('timeupdate', (currentTime) => {
    console.log('Current time:', currentTime);
});

player.on('error', (error) => {
    console.error('Player error:', error);
});
```

## 📝 Code Structure

- `index.html` - Complete example with UI and player integration
- Demonstrates a simulated WebPlayer class (in production, use the npm package)
- Includes comprehensive event logging for debugging

## 🎥 Supported Video Formats

- **MP4**: Standard video format
- **HLS (.m3u8)**: HTTP Live Streaming
- **DASH (.mpd)**: Dynamic Adaptive Streaming

## 💡 Tips

1. Always handle errors gracefully
2. Check browser compatibility for advanced features
3. Use `debug: true` during development
4. Test with various video formats and qualities

## 🔗 Next Steps

- Check out the [React with Paywall example](../2-react-paywall/) for advanced features
- See the [Advanced Features example](../4-advanced-features/) for subtitles and themes
- Read the [full API documentation](../../docs/README.md)
