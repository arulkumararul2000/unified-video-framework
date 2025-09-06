# Unified Video Framework Examples

Welcome to the Unified Video Framework examples! This folder contains various examples demonstrating how to integrate and use the video player framework in different environments.

## 🚀 Quick Start

1. First, install the unified-video-framework package:
   ```bash
   npm install unified-video-framework
   ```

2. Choose an example that matches your use case
3. Follow the specific instructions in each example folder

## 📂 Examples Overview

### 1. [Basic Web Player](./1-basic-web-player/)
Simple HTML/JavaScript example showing basic video playback functionality.
- ✅ Basic video playback
- ✅ Play/pause controls
- ✅ Volume control
- ✅ Seek functionality

### 2. [React with Paywall](./2-react-paywall/)
React application demonstrating the WebPlayerView component with paywall integration.
- ✅ React component integration
- ✅ Paywall configuration
- ✅ Payment gateway integration
- ✅ Free preview functionality

### 3. [Node.js API](./3-nodejs-api/)
Server-side example showing how to use the core API.
- ✅ Video player factory
- ✅ Event handling
- ✅ Programmatic control
- ✅ Analytics integration

### 4. [Advanced Features](./4-advanced-features/)
Comprehensive example showcasing all advanced features.
- ✅ Subtitles/Closed Captions
- ✅ Custom themes
- ✅ Google Cast support
- ✅ Analytics tracking
- ✅ DRM protection
- ✅ Adaptive bitrate streaming

### 5. [Multi-Platform](./5-multi-platform/)
Examples for different platforms:
- ✅ Web (HTML5)
- ✅ React Native (iOS/Android)
- ✅ Smart TV (Samsung Tizen/LG webOS)
- ✅ Roku

## 🛠️ Prerequisites

- Node.js 14+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)
- For React examples: React 16.8+
- For React Native: React Native development environment
- For Smart TV: Respective SDKs

## 📦 Available Exports

The unified-video-framework provides several exports:

```javascript
// Core functionality
const { BasePlayer, VideoPlayerFactory, EventEmitter, VERSION } = require('unified-video-framework');

// Web-specific (React component)
const { WebPlayerView } = require('unified-video-framework/web');

// React Native
const { VideoPlayer } = require('unified-video-framework/react-native');
```

## 🎯 Common Use Cases

### Video Streaming Service
Use the React example with paywall integration for:
- Subscription-based content
- Pay-per-view videos
- Free trials with limited preview

### Educational Platform
Combine features from multiple examples:
- Subtitles for accessibility
- Analytics for tracking progress
- Custom themes for branding

### Live Events
Use advanced features example for:
- HLS/DASH streaming
- Real-time analytics
- Cast support for TV viewing

## 📚 Additional Resources

- [Full API Documentation](../docs/README.md)
- [WebPlayerView Component Guide](../WEBPLAYERVIEW_GUIDE.md)
- [Installation Guide](../INSTALLATION.md)
- [Platform-Specific Guides](../docs/platforms/)

## 💡 Tips

1. **Start Simple**: Begin with the basic example and add features as needed
2. **Check Console**: Enable debug mode (`debug: true`) for detailed logs
3. **Test Paywall**: Use test payment credentials provided in examples
4. **Cross-Platform**: Test on target devices early in development

## 🤝 Need Help?

- Check the [troubleshooting guide](../docs/TROUBLESHOOTING.md)
- Review [common issues](../docs/FAQ.md)
- Open an issue on [GitHub](https://github.com/flicknexs/unified-video-framework)

---

Happy coding! 🎬
