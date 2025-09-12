# Unified Video Player Framework ( 🚧 Don't use this Package this is Under Developement 🏗️ )
<!-- 
A comprehensive cross-platform video player framework that provides a unified API for building video applications across all major platforms.

## 🎯 Supported Platforms

- **Mobile**: iOS, Android
- **Web**: All modern browsers
- **Smart TVs**: 
  - Samsung Tizen (using Enact)
  - LG webOS (using Enact)
- **Streaming Devices**: 
  - Roku
  - Android TV
  - Apple TV
- **Desktop**: Windows, macOS, Linux (via web)

## ✨ Features

- **Unified API**: Single API across all platforms
- **DRM Support**: FairPlay, Widevine, PlayReady
- **Adaptive Streaming**: HLS, DASH support
- **Analytics**: Built-in analytics integration
- **Offline Playback**: Download and play offline
- **Casting**: Chromecast and AirPlay support
- **Picture-in-Picture**: Supported platforms
- **4K/8K & HDR**: High-quality video support
- **Subtitles & Multiple Audio Tracks**
- **Ad Integration**: Pre-roll, mid-roll, post-roll ads
- **Remote Control**: Full TV remote support

## 📦 Installation

### Using npm
```bash
npm install unified-video-framework
```

### Using yarn
```bash
yarn add unified-video-framework
```

### Using pnpm
```bash
pnpm add unified-video-framework
```

### From GitHub (latest development version)
```bash
npm install github:flicknexs/unified-video-framework
```

### Using npm link (for development)
```bash
# In the framework directory
npm link

# In your project
npm link unified-video-framework
```

📖 **For detailed installation instructions and troubleshooting, see [INSTALLATION.md](./INSTALLATION.md)**

## 🚀 Quick Start

### Basic Usage

```typescript
import { UnifiedVideoPlayer } from '@flicknexs/unified-video-framework';

function App() {
  return (
    <UnifiedVideoPlayer
      source={{
        url: 'https://example.com/video.m3u8',
        type: 'application/x-mpegURL'
      }}
      config={{
        autoPlay: true,
        controls: true
      }}
      onReady={() => console.log('Player ready')}
      onError={(error) => console.error('Player error:', error)}
    />
  );
}
```

### With DRM

```typescript
import { UnifiedVideoPlayer, DRMType } from '@flicknexs/unified-video-framework';

function SecureVideoApp() {
  return (
    <UnifiedVideoPlayer
      source={{
        url: 'https://example.com/encrypted-video.mpd',
        type: 'application/dash+xml',
        drm: {
          type: DRMType.WIDEVINE,
          licenseUrl: 'https://license.example.com/widevine',
          headers: {
            'X-Auth-Token': 'your-auth-token'
          }
        }
      }}
      config={{
        autoPlay: false,
        adaptiveBitrate: {
          autoLevelEnabled: true,
          startLevel: -1
        }
      }}
    />
  );
}
```

## 🏗️ Framework Architecture

```
┌────────────────────────────────────────────────┐
│          Application Layer (Your App)           │
├────────────────────────────────────────────────┤
│     Unified Video Framework API (TypeScript)    │
├────────────────────────────────────────────────┤
│              Platform Bridge Layer              │
├──────┬──────┬──────────┬──────┬──────────┬────┤
│ iOS  │Android│  Enact   │ Roku │   Web    │Win │
│Native│Native │(Tizen/LG)│Bridge│ Browser  │UWP │
└──────┴──────┴──────────┴──────┴──────────┴────┘
```

## 📱 Platform-Specific Setup

### iOS
```bash
cd ios && pod install
```

### Android
Add to `android/app/build.gradle`:
```gradle
dependencies {
    implementation 'com.google.android.exoplayer:exoplayer:2.18.0'
}
```

### Samsung Tizen TV
```bash
npm run build:tizen
tizen install -n dist/tizen/app.wgt
```

### LG webOS TV
```bash
npm run build:webos
ares-install dist/webos/app.ipk
```

### Roku
```bash
npm run build:roku
# Upload via Roku Developer Dashboard
```

## 🛠️ Development

### Setup
```bash
# Install dependencies
npm install

# Bootstrap monorepo
npm run bootstrap

# Build all packages
npm run build
```

### Running Examples
```bash
# Run mobile demo
cd apps/mobile-demo
npm run ios
# or
npm run android

# Run TV demo
cd apps/tv-demo
npm run serve

# Run web demo
cd apps/web-demo
npm start
```

## 📖 API Documentation

### VideoPlayer Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `load(source)` | Load a video source | `Promise<void>` |
| `play()` | Start playback | `Promise<void>` |
| `pause()` | Pause playback | `void` |
| `seek(time)` | Seek to position | `void` |
| `setVolume(level)` | Set volume (0-1) | `void` |
| `setQuality(quality)` | Set video quality | `void` |
| `setSubtitle(track)` | Set subtitle track | `void` |
| `destroy()` | Clean up player | `void` |

### Events

| Event | Description | Payload |
|-------|-------------|---------|
| `ready` | Player initialized | - |
| `play` | Playback started | - |
| `pause` | Playback paused | - |
| `ended` | Playback ended | - |
| `error` | Error occurred | `{error: Error}` |
| `timeupdate` | Position updated | `{currentTime: number}` |
| `progress` | Buffer progress | `{buffered: number}` |
| `qualitychange` | Quality changed | `{quality: Quality}` |

## 🎮 Remote Control Support

The framework automatically handles remote control inputs on TV platforms:

- **Play/Pause**: Media play/pause keys
- **Seek**: Left/Right arrow keys
- **Volume**: Up/Down arrow keys
- **Back**: Return/Back button
- **Select**: OK/Enter button

## 📊 Analytics Integration

```typescript
import { GoogleAnalytics, MixPanel } from '@flicknexs/analytics';

<UnifiedVideoPlayer
  source={videoSource}
  config={{
    analytics: {
      enabled: true,
      providers: [
        new GoogleAnalytics({ trackingId: 'UA-XXXXX' }),
        new MixPanel({ token: 'your-token' })
      ]
    }
  }}
/>
```

## 🔒 DRM Configuration

### FairPlay (iOS/Apple TV)
```typescript
{
  type: DRMType.FAIRPLAY,
  certificateUrl: 'https://example.com/certificate',
  licenseUrl: 'https://example.com/license'
}
```

### Widevine (Android/Chrome/Smart TVs)
```typescript
{
  type: DRMType.WIDEVINE,
  licenseUrl: 'https://example.com/widevine/license'
}
```

### PlayReady (Windows/Xbox/Smart TVs)
```typescript
{
  type: DRMType.PLAYREADY,
  licenseUrl: 'https://example.com/playready/license'
}
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Platform-specific tests
npm run test:ios
npm run test:android
npm run test:tizen
```

## 📈 Performance Optimization

- **Lazy Loading**: Platform-specific code is loaded on demand
- **Code Splitting**: Automatic code splitting for web builds
- **Memory Management**: Automatic cleanup and resource management
- **Adaptive Bitrate**: Automatic quality adjustment based on network

## 💳 Paywall Rentals (Stripe, Pesapal, Google Pay)

- For per-video rentals (no subscriptions), follow our step-by-step implementation guide:
  - See PAYWALL_RENTAL_FLOW.md: [PAYWALL_RENTAL_FLOW.md](./PAYWALL_RENTAL_FLOW.md)
- Documentation index: [docs/](./docs/README.md)

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.example.com](https://docs.example.com)
- **Issues**: [GitHub Issues](https://github.com/flicknexs/unified-video-framework/issues)
- **Discord**: [Join our Discord](https://discord.gg/example)
- **Email**: support@example.com

## 🙏 Acknowledgments

- React Native team for the mobile framework
- Enact team for the Smart TV framework
- ExoPlayer team for Android video engine
- AVPlayer team for iOS video engine

---
 -->
Built with ❤️ by flicknexs
