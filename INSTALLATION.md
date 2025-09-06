# Installation Guide - Unified Video Framework

This guide will help you install and use the Unified Video Framework in your project.

## 🚀 Installation Methods

### Method 1: Install from npm (Recommended)

```bash
# Using npm
npm install unified-video-framework

# Using yarn  
yarn add unified-video-framework

# Using pnpm
pnpm add unified-video-framework
```

### Method 2: Install from GitHub (Latest Development)

```bash
# Install from the main branch
npm install github:flicknexs/unified-video-framework

# Or install from a specific branch/tag
npm install github:flicknexs/unified-video-framework#main
```

### Method 3: Install from Local Path

If you have cloned the repository locally:

```bash
# First, build the packages
cd /path/to/unified-video-framework
npm install
npm run build

# Then in your project, install from local path
cd /path/to/your-project
npm install /path/to/unified-video-framework
```

### Method 4: Using npm link (For Development)

This is useful when you're actively developing both the framework and your application:

```bash
# In the framework directory
cd /path/to/unified-video-framework
npm link

# In your project directory
cd /path/to/your-project
npm link unified-video-framework
```

## 📦 Usage in Your Project

### Basic Import

```javascript
// CommonJS
const { UnifiedVideoPlayer, WebPlayer } = require('unified-video-framework');

// ES6 Modules
import { UnifiedVideoPlayer, WebPlayer } from 'unified-video-framework';

// Import specific packages
import { WebPlayer } from 'unified-video-framework/web';
import { BasePlayer } from 'unified-video-framework/core';
```

### TypeScript Usage

```typescript
import { 
  UnifiedVideoPlayer, 
  VideoPlayerConfig,
  VideoSource,
  PlayerState 
} from 'unified-video-framework';

// Use with proper types
const config: VideoPlayerConfig = {
  autoPlay: true,
  controls: true
};

const player = new UnifiedVideoPlayer(container, config);
```

### React Component Usage

```jsx
import React from 'react';
import { WebPlayerView } from 'unified-video-framework/web';

function VideoComponent() {
  return (
    <WebPlayerView
      url="https://example.com/video.m3u8"
      type="hls"
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

## 🛠️ Troubleshooting

### Error: Can't resolve 'unified-video-framework'

This error occurs when the package is not properly installed or the module resolution is failing.

**Solutions:**

1. **Check if the package is installed:**
   ```bash
   npm list unified-video-framework
   ```

2. **Clear npm cache and reinstall:**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check your import path:**
   ```javascript
   // Correct
   import { WebPlayer } from 'unified-video-framework';
   
   // Incorrect
   import { WebPlayer } from 'unified-video-framework/packages/web';
   ```

### Error: Module not found in TypeScript

Add the types to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["unified-video-framework"]
  }
}
```

### Build Errors

If you encounter build errors after installation:

1. **Ensure peer dependencies are installed:**
   ```bash
   npm install hls.js dashjs
   ```

2. **For React Native projects:**
   ```bash
   npm install react-native-video
   cd ios && pod install
   ```

## 🔧 Advanced Configuration

### Webpack Configuration

If you're using Webpack, you might need to add aliases:

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      'unified-video-framework': path.resolve(__dirname, 'node_modules/unified-video-framework')
    }
  }
};
```

### Next.js Configuration

For Next.js projects, you might need to transpile the package:

```javascript
// next.config.js
module.exports = {
  transpilePackages: ['unified-video-framework']
};
```

## 📚 Package Structure

After installation, the package structure in your `node_modules` will be:

```
node_modules/
└── unified-video-framework/
    ├── index.js          # Main entry point
    ├── index.d.ts        # TypeScript definitions
    ├── package.json
    ├── README.md
    ├── LICENSE
    └── packages/
        ├── core/         # Core interfaces and base classes
        │   ├── dist/
        │   └── src/
        ├── web/          # Web player implementation
        │   ├── dist/
        │   └── src/
        └── react-native/ # React Native implementation
            ├── dist/
            └── src/
```

## 🚀 Quick Start Example

Here's a complete example to get you started:

```javascript
// Import the framework
import { WebPlayer } from 'unified-video-framework';

// Create a container element
const container = document.getElementById('video-container');

// Initialize the player
const player = new WebPlayer(container);

// Load and play a video
player.load({
  url: 'https://example.com/video.mp4',
  type: 'video/mp4'
});

// Listen to events
player.on('ready', () => {
  console.log('Player is ready');
  player.play();
});

player.on('error', (error) => {
  console.error('Playback error:', error);
});

// Control playback
player.on('timeupdate', (time) => {
  console.log('Current time:', time);
});
```

## 📞 Getting Help

If you encounter issues:

1. Check the [main README](./README.md) for detailed documentation
2. Look at the [examples](./examples) directory
3. Create an issue on [GitHub](https://github.com/flicknexs/unified-video-framework/issues)
4. Check existing issues for similar problems

## 🔄 Updating the Package

To update to the latest version:

```bash
# From GitHub
npm update unified-video-framework

# Or reinstall
npm uninstall unified-video-framework
npm install github:flicknexs/unified-video-framework
```

---

**Latest Version:** v1.3.1
**npm Package:** https://www.npmjs.com/package/unified-video-framework
