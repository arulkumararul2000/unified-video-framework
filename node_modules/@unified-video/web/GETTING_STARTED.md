# Getting Started

## Install

### npm
```bash
npm i @unified-video/web
# Optional (recommended for production control of adaptive streaming):
npm i hls.js dashjs
```

### yarn
```bash
yarn add @unified-video/web
# Optional:
yarn add hls.js dashjs
```

### pnpm
```bash
pnpm add @unified-video/web
# Optional:
pnpm add hls.js dashjs
```

> Notes
> - hls.js and dashjs are optional peer dependencies. If you don’t install them, the player can load them from public CDNs at runtime. For production builds and offline environments, install them as shown above.
> - TypeScript types are bundled—no extra @types package needed.

## Quick start (bundler)
```ts
import { WebPlayer } from '@unified-video/web';

const player = new WebPlayer();

async function main() {
  // Attach the player to a container (element or selector)
  await player.initialize('#player', {
    autoPlay: false,
    muted: false,
    enableAdaptiveBitrate: true, // allows auto quality with HLS/DASH
    debug: false,
  });

  // Load a source (mp4, hls, dash, webm)
  await player.load({
    url: 'https://example.com/stream.m3u8',
    type: 'hls', // 'mp4' | 'hls' | 'dash' | 'webm' | 'auto'
    subtitles: [
      {
        url: 'https://example.com/subs/en.vtt',
        language: 'en',
        label: 'English',
        kind: 'subtitles',
        default: true,
      },
    ],
    metadata: {
      title: 'My Stream',
      description: 'An example stream with metadata-driven UI',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      posterUrl: 'https://example.com/poster.jpg'
    },
  });

  await player.play();
}

main().catch(console.error);
```

### Container markup
```html
<div id="player" style="width: 100%; max-width: 960px; margin: 0 auto;"></div>
```

### Chromecast (optional)
```html
<!-- Add this if you want Cast sender support in the browser -->
<script src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1" async></script>
```

## Enhanced UI and Dynamic Theming
The WebPlayer renders a premium UI (gradient border, top action buttons, animated center play, watermark, modern control bar) and supports live theming via CSS variables.

Set a theme at runtime (after initialize and before/after load):
```ts
// Single accent (accent2 is derived)
player.setTheme('#00bcd4');

// Full theme object
player.setTheme({
  accent: '#ff0000',
  accent2: '#ff4d4f',
  iconColor: '#ffffff',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.75)',
});
```

### Theme variables
- `--uvf-accent-1`, `--uvf-accent-2` (accent gradient)
- `--uvf-accent-1-20` (translucent accent for glow/badges)
- `--uvf-icon-color`
- `--uvf-text-primary`, `--uvf-text-secondary`
- Settings menu scrollbar tuning:
  - `--uvf-scrollbar-width`
  - `--uvf-scrollbar-thumb-start`, `--uvf-scrollbar-thumb-end`
  - `--uvf-scrollbar-thumb-hover-start`, `--uvf-scrollbar-thumb-hover-end`

You can also adjust scrollbar behavior programmatically:
```ts
player.setSettingsScrollbarStyle('compact'); // 'default' | 'compact' | 'overlay'
player.setSettingsScrollbarConfig({ widthPx: 6, intensity: 1 });
```

## Metadata-driven UI (WebPlayer)
- The built-in title bar is shown only if at least one of `title`, `description`, or `thumbnailUrl` is present in `source.metadata`.
- When those fields are omitted, the title bar stays hidden; no default text is displayed.
- For the underlying video poster, you can provide `metadata.posterUrl`.
- The built-in Share action uses the Web Share API when available; it includes `title`/`text` only if provided, otherwise it shares just the current page URL.

## Keyboard shortcuts (Web)
- Space or K: Play/Pause
- Arrow Left/Right: Seek -/+ 10s
- Arrow Up/Down: Volume up/down
- M: Mute/Unmute
- F: Toggle Fullscreen
- P: Picture-in-Picture
- 0..9: Seek to 0%, 10%, …, 90%

## Local demo (monorepo)
- Build the web package:
  - `npm run build:web`
- Start the demo server from the repo root:
  - `npm run serve:demo`
- Open the enhanced demo:
  - http://localhost:3000/apps/demo/enhanced-player.html

## Tests (monorepo)
- Run the web package tests:
  - `npm run test -w packages/web`

## Events and controls
```ts
// Listen to player events
player.on('onPlay', () => console.log('playing'));
player.on('onPause', () => console.log('paused'));
player.on('onQualityChanged', (q) => console.log('quality ->', q?.label));
player.on('onError', (err) => console.error('player error', err));

// Control playback
await player.play();
player.pause();
player.seek(60);        // 60 seconds
player.setVolume(0.5);  // 50%
player.toggleMute();

// Query state
console.log(player.getState());
```

## CDN / no-bundler usage (ESM via CDN)
```html
<div id="player"></div>

<script type="module">
  import { WebPlayer } from 'https://esm.sh/@unified-video/web';

  const player = new WebPlayer();
  await player.initialize('#player', { autoPlay: false });

  await player.load({
    url: 'https://example.com/video.mp4',
    type: 'mp4',
  });

  await player.play();
</script>
```

## Requirements
- Modern browsers with standard DOM APIs.
- For HLS/DASH playback, install `hls.js`/`dashjs` or allow the player to fetch them from CDNs at runtime.

## Tip
- To keep bundle size under control and avoid network fetches during playback startup, prefer installing `hls.js` and `dashjs` in your app rather than relying on runtime CDN loading.

---

## React usage

A built-in React component is provided: `WebPlayerView`. It renders the enhanced UI and supports live theming via the `playerTheme` prop.

Basic usage
```tsx path=null start=null
import React from 'react';
import { WebPlayerView } from '@unified-video/web';

export default function PlayerSection() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <WebPlayerView
        url="https://example.com/stream.m3u8"
        type="hls"
        autoPlay={false}
        muted={false}
        enableAdaptiveBitrate={true}
        cast={true} // loads Cast sender SDK and shows Cast button
        metadata={{
          title: 'My Stream',
          description: 'An example stream with metadata-driven UI',
          thumbnailUrl: 'https://example.com/thumb.jpg',
          posterUrl: 'https://example.com/poster.jpg',
        }}
        playerTheme={{
          accent: '#ff0000',
          accent2: '#ff4d4f',
          iconColor: '#ffffff',
          textPrimary: '#ffffff',
          textSecondary: 'rgba(255,255,255,0.75)',
        }}
        style={{ width: '100%' }}
      />
    </div>
  );
}
```

Dynamic theme updates
```tsx path=null start=null
import React, { useState } from 'react';
import { WebPlayerView } from '@unified-video/web';

export default function ThemedPlayer() {
  const [theme, setTheme] = useState({
    accent: '#ff0000',
    accent2: '#ff4d4f',
    iconColor: '#ffffff',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.75)',
  });

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setTheme({ accent: '#00bcd4', accent2: '#40c4ff', iconColor: '#fff', textPrimary: '#e6f7ff', textSecondary: 'rgba(230,247,255,0.7)' })}>
          Switch to Cyan
        </button>
        <button onClick={() => setTheme('#7e57c2')} style={{ marginLeft: 8 }}>
          Single Accent (Purple)
        </button>
      </div>

      <WebPlayerView
        url="https://example.com/stream.m3u8"
        type="hls"
        playerTheme={theme}
        style={{ width: '100%', maxWidth: 960, margin: '0 auto' }}
      />
    </>
  );
}
```

Advanced tweaks (onReady)
```tsx path=null start=null
import React from 'react';
import { WebPlayerView, WebPlayer } from '@unified-video/web';

export default function PlayerWithControls() {
  const onReady = (player: WebPlayer) => {
    // Compact settings menu scrollbar and tuned look
    player.setSettingsScrollbarStyle('compact'); // 'default' | 'compact' | 'overlay'
    player.setSettingsScrollbarConfig({ widthPx: 6, intensity: 1 });
  };

  return (
    <WebPlayerView
      url="https://example.com/stream.m3u8"
      type="hls"
      onReady={onReady}
      playerTheme="#00bcd4"
    />
  );
}
```

Notes
- `cast` adds the Cast sender SDK; a Cast button appears when the framework is ready and compatible devices are available.
- Use client-side rendering for SSR frameworks.
- The enhanced UI in React matches the web build and honors the same theme variables.
