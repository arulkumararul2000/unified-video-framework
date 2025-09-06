# 🚀 Unified Video Framework - Setup Guide

This guide will help you get started with the Unified Video Framework, from installation to your first video player implementation.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Platform-Specific Setup](#platform-specific-setup)
5. [Testing Your Setup](#testing-your-setup)
6. [Common Issues](#common-issues)
7. [Next Steps](#next-steps)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 14.0 or higher
- **npm** 6.0 or higher (comes with Node.js)
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Code editor (VS Code recommended)

For specific platforms:
- **React Native**: React Native development environment
- **Smart TV**: Platform-specific SDKs (Tizen Studio, webOS SDK)

## Installation

### 1. Install via npm

```bash
npm install unified-video-framework
```

### 2. Install via yarn

```bash
yarn add unified-video-framework
```

### 3. Verify Installation

```bash
npm list unified-video-framework
```

## Quick Start

### Web (HTML/JavaScript)

1. Create an HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Video Player</title>
</head>
<body>
    <div id="player-container" style="width: 800px; height: 450px;"></div>
    
    <script type="module">
        // Import will depend on your setup
        // For now, use the simulated example
        
        class SimplePlayer {
            constructor(container) {
                this.video = document.createElement('video');
                this.video.controls = true;
                this.video.style.width = '100%';
                this.video.style.height = '100%';
                container.appendChild(this.video);
            }
            
            load(url) {
                this.video.src = url;
            }
        }
        
        const container = document.getElementById('player-container');
        const player = new SimplePlayer(container);
        player.load('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
    </script>
</body>
</html>
```

2. Open the file in your browser

### React Application

1. Create a new React app:

```bash
npx create-react-app my-video-app
cd my-video-app
npm install unified-video-framework
```

2. Create a video component:

```jsx
// src/VideoPlayer.js
import React, { useEffect, useRef } from 'react';
// Note: Import path may vary based on package structure
// import { WebPlayerView } from 'unified-video-framework/web';

function VideoPlayer({ url }) {
    const playerRef = useRef(null);
    
    useEffect(() => {
        // Initialize player here
        // This is a simplified example
        if (playerRef.current) {
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.style.width = '100%';
            playerRef.current.appendChild(video);
        }
    }, [url]);
    
    return (
        <div ref={playerRef} style={{ width: '100%', maxWidth: '800px' }}>
            {/* Player will be rendered here */}
        </div>
    );
}

export default VideoPlayer;
```

3. Use in your app:

```jsx
// src/App.js
import VideoPlayer from './VideoPlayer';

function App() {
    return (
        <div className="App">
            <h1>My Video App</h1>
            <VideoPlayer url="https://example.com/video.mp4" />
        </div>
    );
}
```

### Node.js Backend

1. Create a new project:

```bash
mkdir video-backend
cd video-backend
npm init -y
npm install express unified-video-framework
```

2. Create server.js:

```javascript
const express = require('express');
const { VideoPlayerFactory } = require('unified-video-framework');

const app = express();

app.get('/api/player-config', (req, res) => {
    // Generate player configuration
    const config = {
        platform: 'web',
        features: ['hls', 'dash', 'drm'],
        analytics: true
    };
    res.json(config);
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
```

## Platform-Specific Setup

### React Native

1. Install dependencies:

```bash
npm install unified-video-framework react-native-video
cd ios && pod install  # For iOS
```

2. Basic implementation:

```jsx
import { VideoPlayer } from 'unified-video-framework/react-native';

export default function App() {
    return (
        <VideoPlayer
            source={{ uri: 'https://example.com/video.mp4' }}
            style={{ width: '100%', height: 300 }}
        />
    );
}
```

### Smart TV (Samsung Tizen)

1. Create Tizen project
2. Add to config.xml:

```xml
<access origin="*" subdomains="true"/>
<tizen:privilege name="http://tizen.org/privilege/tv.inputdevice"/>
```

3. Include framework:

```html
<script src="node_modules/unified-video-framework/dist/enact.js"></script>
```

### Smart TV (LG webOS)

1. Create webOS project
2. Add to appinfo.json:

```json
{
    "vendorExtension": {
        "userAgent": "your-app-user-agent"
    }
}
```

## Testing Your Setup

### 1. Basic Functionality Test

Create `test-player.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Player Test</title>
</head>
<body>
    <h1>Video Player Test</h1>
    <div id="player" style="width: 640px; height: 360px; background: #000;"></div>
    
    <div>
        <button onclick="playVideo()">Play</button>
        <button onclick="pauseVideo()">Pause</button>
        <span id="status">Ready</span>
    </div>
    
    <script>
        let video;
        
        function initPlayer() {
            const container = document.getElementById('player');
            video = document.createElement('video');
            video.style.width = '100%';
            video.style.height = '100%';
            video.src = 'https://www.w3schools.com/html/mov_bbb.mp4';
            
            video.addEventListener('play', () => {
                document.getElementById('status').textContent = 'Playing';
            });
            
            video.addEventListener('pause', () => {
                document.getElementById('status').textContent = 'Paused';
            });
            
            container.appendChild(video);
        }
        
        function playVideo() {
            video?.play();
        }
        
        function pauseVideo() {
            video?.pause();
        }
        
        // Initialize on load
        window.onload = initPlayer;
    </script>
</body>
</html>
```

### 2. Feature Detection

```javascript
// Check available features
const features = {
    hls: 'application/vnd.apple.mpegurl',
    dash: 'application/dash+xml',
    mse: window.MediaSource !== undefined
};

console.log('Supported features:', features);
```

### 3. Network Test

```javascript
// Test video loading
async function testVideoLoad(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        console.log('Video accessible:', response.ok);
        console.log('Content-Type:', response.headers.get('content-type'));
    } catch (error) {
        console.error('Video load test failed:', error);
    }
}

testVideoLoad('https://example.com/video.mp4');
```

## Common Issues

### Issue 1: Module Not Found

**Error**: `Cannot find module 'unified-video-framework'`

**Solution**:
```bash
# Reinstall the package
npm uninstall unified-video-framework
npm install unified-video-framework

# Clear npm cache if needed
npm cache clean --force
```

### Issue 2: CORS Errors

**Error**: `Access to video at 'https://example.com/video.mp4' from origin 'http://localhost:3000' has been blocked by CORS`

**Solution**:
1. Use a proxy in development
2. Configure CORS on your server
3. Use a CDN that supports CORS

### Issue 3: Autoplay Blocked

**Error**: `DOMException: play() failed because the user didn't interact with the document first`

**Solution**:
```javascript
// Mute video for autoplay
player.muted = true;
player.autoplay = true;

// Or require user interaction
button.addEventListener('click', () => {
    player.play();
});
```

### Issue 4: HLS Not Playing

**Error**: `The media could not be loaded`

**Solution**:
1. Check if HLS.js is loaded
2. Verify the stream URL
3. Use appropriate type detection

```javascript
if (url.includes('.m3u8')) {
    // Initialize HLS
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
    }
}
```

## Environment Variables

Create `.env` file for configuration:

```env
# API Configuration
REACT_APP_API_URL=http://localhost:3001
REACT_APP_VIDEO_CDN=https://cdn.example.com

# Features
REACT_APP_ENABLE_DRM=false
REACT_APP_ENABLE_ANALYTICS=true

# Payment
REACT_APP_STRIPE_KEY=pk_test_xxxxx
```

## Build Configuration

### Webpack Configuration

```javascript
// webpack.config.js
module.exports = {
    // ... other config
    resolve: {
        alias: {
            'unified-video-framework': path.resolve(__dirname, 'node_modules/unified-video-framework')
        }
    }
};
```

### TypeScript Configuration

```json
// tsconfig.json
{
    "compilerOptions": {
        "types": ["unified-video-framework"],
        "moduleResolution": "node"
    }
}
```

## Next Steps

Now that you have the framework set up:

1. **Explore Examples**: Check out the `/examples` folder for detailed implementations
2. **Read API Docs**: Review the [API documentation](./docs/README.md)
3. **Try Advanced Features**: 
   - [Paywall Integration](./examples/2-react-paywall/)
   - [Analytics Setup](./examples/3-nodejs-api/)
   - [Multi-Platform](./examples/5-multi-platform/)

4. **Join Community**: 
   - Report issues on [GitHub](https://github.com/flicknexs/unified-video-framework)
   - Check for updates regularly

## Support

If you encounter any issues:

1. Check the [troubleshooting guide](./docs/TROUBLESHOOTING.md)
2. Search existing [GitHub issues](https://github.com/flicknexs/unified-video-framework/issues)
3. Create a new issue with:
   - Error message
   - Code snippet
   - Environment details
   - Steps to reproduce

---

Happy coding! 🎬
