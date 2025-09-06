# WebPlayerView - React Component Guide

The `WebPlayerView` is a React component that provides a complete video player solution with built-in paywall support, adaptive streaming, and customizable themes.

## 📦 Installation

```bash
npm install unified-video-framework
```

## 🚀 Quick Start

### Basic Usage

```jsx
import React from 'react';
import { WebPlayerView } from 'unified-video-framework';

function App() {
  return (
    <WebPlayerView
      url="https://example.com/video.mp4"
      type="mp4"
      autoPlay={true}
      muted={true}
    />
  );
}
```

### With HLS Streaming

```jsx
<WebPlayerView
  url="https://example.com/stream.m3u8"
  type="hls"
  autoPlay={false}
  muted={false}
  enableAdaptiveBitrate={true}
/>
```

## 🎯 Component Props

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `url` | `string` | The video URL to play |

### Optional Props

#### Player Configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'mp4' \| 'hls' \| 'dash' \| 'webm' \| 'auto'` | `'auto'` | Video format type |
| `autoPlay` | `boolean` | `false` | Start playing automatically |
| `muted` | `boolean` | `false` | Start muted |
| `enableAdaptiveBitrate` | `boolean` | `true` | Enable adaptive bitrate streaming |
| `debug` | `boolean` | `false` | Enable debug logging |
| `freeDuration` | `number` | - | Free preview duration in seconds |

#### Paywall Configuration

| Prop | Type | Description |
|------|------|-------------|
| `paywall` | `PaywallConfig` | Inline paywall configuration |
| `paywallConfigUrl` | `string` | URL to fetch paywall config |

#### Content Metadata

| Prop | Type | Description |
|------|------|-------------|
| `subtitles` | `SubtitleTrack[]` | Array of subtitle tracks |
| `metadata` | `VideoMetadata` | Video metadata (title, description, etc.) |

#### Styling & Theming

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | CSS class name |
| `style` | `CSSProperties` | Inline styles |
| `playerTheme` | `string \| ThemeConfig` | Player theme configuration |

#### Features

| Prop | Type | Description |
|------|------|-------------|
| `cast` | `boolean` | Enable Google Cast support |

#### Callbacks

| Prop | Type | Description |
|------|------|-------------|
| `onReady` | `(player: WebPlayer) => void` | Called when player is ready |
| `onError` | `(error: unknown) => void` | Called on error |

## 💳 Paywall Integration

### Basic Paywall Setup

```jsx
<WebPlayerView
  url="https://example.com/premium-video.m3u8"
  type="hls"
  freeDuration={120} // 2 minutes free preview
  paywall={{
    enabled: true,
    apiBase: 'https://api.example.com',
    userId: 'user123',
    videoId: 'video456',
    gateways: ['stripe', 'cashfree'],
    branding: {
      title: 'Continue Watching',
      description: 'Rent this video for 48 hours',
    }
  }}
/>
```

### Dynamic Paywall Configuration

```jsx
<WebPlayerView
  url="https://example.com/video.m3u8"
  type="hls"
  freeDuration={180}
  paywallConfigUrl="/api/rentals/config?videoId=video123"
/>
```

### Advanced Paywall Example

```jsx
import React, { useState } from 'react';
import { WebPlayerView } from 'unified-video-framework';

function PremiumVideo({ videoId, userId }) {
  const [player, setPlayer] = useState(null);

  const handlePlayerReady = (playerInstance) => {
    setPlayer(playerInstance);
    console.log('Player ready', playerInstance);
  };

  const handleError = (error) => {
    console.error('Player error:', error);
  };

  return (
    <WebPlayerView
      url={`https://cdn.example.com/videos/${videoId}/playlist.m3u8`}
      type="hls"
      autoPlay={false}
      muted={false}
      freeDuration={300} // 5 minutes free
      paywall={{
        enabled: true,
        apiBase: process.env.REACT_APP_API_URL,
        userId: userId,
        videoId: videoId,
        gateways: ['stripe', 'cashfree'],
        pricing: {
          amount: 4.99,
          currency: 'USD',
          rentalDurationHours: 48
        },
        branding: {
          title: 'Unlock Full Video',
          description: 'Get 48-hour access to watch anytime',
          logoUrl: '/logo.png',
          theme: {
            primaryColor: '#ff4444',
            backgroundColor: '#1a1a1a'
          }
        }
      }}
      onReady={handlePlayerReady}
      onError={handleError}
      className="video-player-container"
      style={{ maxWidth: '1280px', margin: '0 auto' }}
    />
  );
}
```

## 🎨 Theming

### Simple Theme (Single Color)

```jsx
<WebPlayerView
  url="video.mp4"
  playerTheme="#ff0000" // Red theme
/>
```

### Advanced Theme Configuration

```jsx
<WebPlayerView
  url="video.mp4"
  playerTheme={{
    accent: '#ff4d4f',
    accent2: '#d9363e',
    iconColor: '#ffffff',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.7)'
  }}
/>
```

## 📡 Google Cast Support

```jsx
<WebPlayerView
  url="https://example.com/video.mp4"
  cast={true} // Enable Cast support
  onReady={(player) => {
    // Cast events can be listened to on the player instance
    player.on('castStateChanged', (state) => {
      console.log('Cast state:', state);
    });
  }}
/>
```

## 🎯 Subtitles

```jsx
const subtitles = [
  {
    id: 'en',
    label: 'English',
    language: 'en',
    url: 'https://example.com/subtitles/en.vtt',
    default: true
  },
  {
    id: 'es',
    label: 'Spanish',
    language: 'es',
    url: 'https://example.com/subtitles/es.vtt'
  }
];

<WebPlayerView
  url="video.mp4"
  subtitles={subtitles}
/>
```

## 📊 Video Metadata

```jsx
<WebPlayerView
  url="video.mp4"
  metadata={{
    title: 'Big Buck Bunny',
    description: 'A large rabbit with buck teeth',
    duration: 596, // seconds
    thumbnail: 'https://example.com/thumbnail.jpg',
    releaseDate: '2008-05-10',
    director: 'Sacha Goedegebure',
    cast: ['Big Buck Bunny', 'Rodents']
  }}
/>
```

## 🎮 Controlling the Player

```jsx
function VideoController() {
  const [player, setPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (player) {
      // Listen to player events
      player.on('play', () => setIsPlaying(true));
      player.on('pause', () => setIsPlaying(false));
      player.on('timeupdate', (time) => setCurrentTime(time));
    }
  }, [player]);

  return (
    <div>
      <WebPlayerView
        url="video.mp4"
        onReady={setPlayer}
      />
      
      <div className="controls">
        <button onClick={() => player?.play()}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => player?.seek(currentTime + 10)}>
          Skip 10s
        </button>
        <button onClick={() => player?.setVolume(0.5)}>
          50% Volume
        </button>
        <span>Time: {Math.floor(currentTime)}s</span>
      </div>
    </div>
  );
}
```

## 🚀 Advanced Examples

### Full-Featured Video Player

```jsx
import React, { useState, useEffect } from 'react';
import { WebPlayerView } from 'unified-video-framework';

function AdvancedVideoPlayer({ 
  videoId, 
  userId, 
  isSubscribed = false 
}) {
  const [player, setPlayer] = useState(null);
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch video data
  useEffect(() => {
    async function fetchVideoData() {
      try {
        const response = await fetch(`/api/videos/${videoId}`);
        const data = await response.json();
        setVideoData(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch video data:', error);
        setLoading(false);
      }
    }
    fetchVideoData();
  }, [videoId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!videoData) {
    return <div>Video not found</div>;
  }

  return (
    <div className="video-player-page">
      <h1>{videoData.title}</h1>
      
      <WebPlayerView
        url={videoData.streamUrl}
        type="hls"
        autoPlay={false}
        muted={false}
        enableAdaptiveBitrate={true}
        debug={false}
        cast={true}
        
        // Free preview for non-subscribers
        freeDuration={isSubscribed ? 0 : 300}
        
        // Paywall for non-subscribers
        paywall={isSubscribed ? undefined : {
          enabled: true,
          apiBase: process.env.REACT_APP_API_URL,
          userId: userId,
          videoId: videoId,
          gateways: ['stripe', 'cashfree'],
          pricing: {
            amount: videoData.rentalPrice,
            currency: videoData.currency,
            rentalDurationHours: 48
          },
          branding: {
            title: 'Rent This Video',
            description: `Get 48-hour access to "${videoData.title}"`,
            logoUrl: '/logo.png'
          }
        }}
        
        // Subtitles
        subtitles={videoData.subtitles}
        
        // Metadata
        metadata={{
          title: videoData.title,
          description: videoData.description,
          duration: videoData.duration,
          thumbnail: videoData.thumbnail
        }}
        
        // Theme
        playerTheme={{
          accent: '#e50914',
          accent2: '#b20710',
          iconColor: '#ffffff',
          textPrimary: '#ffffff',
          textSecondary: 'rgba(255,255,255,0.7)'
        }}
        
        // Callbacks
        onReady={(playerInstance) => {
          setPlayer(playerInstance);
          
          // Track analytics
          playerInstance.on('play', () => {
            analytics.track('video_play', {
              videoId,
              userId,
              title: videoData.title
            });
          });
          
          playerInstance.on('ended', () => {
            analytics.track('video_complete', {
              videoId,
              userId,
              title: videoData.title
            });
          });
        }}
        
        onError={(error) => {
          console.error('Player error:', error);
          analytics.track('video_error', {
            videoId,
            userId,
            error: error.message
          });
        }}
        
        className="video-player"
        style={{
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto'
        }}
      />
      
      <div className="video-info">
        <p>{videoData.description}</p>
        <p>Duration: {Math.floor(videoData.duration / 60)} minutes</p>
        <p>Released: {videoData.releaseDate}</p>
      </div>
    </div>
  );
}
```

### Next.js Integration

```jsx
// pages/watch/[videoId].js
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

// Dynamic import to avoid SSR issues
const WebPlayerView = dynamic(
  () => import('unified-video-framework').then(mod => mod.WebPlayerView),
  { ssr: false }
);

export default function WatchPage() {
  const router = useRouter();
  const { videoId } = router.query;
  const { data: session } = useSession();

  if (!videoId) return <div>Loading...</div>;

  return (
    <WebPlayerView
      url={`/api/stream/${videoId}`}
      type="hls"
      freeDuration={180}
      paywall={{
        enabled: true,
        apiBase: '/api',
        userId: session?.user?.id || 'guest',
        videoId: videoId as string,
        gateways: ['stripe', 'cashfree']
      }}
      cast={true}
    />
  );
}
```

## 🛠️ TypeScript Support

```typescript
import React from 'react';
import { WebPlayerView, WebPlayerViewProps } from 'unified-video-framework';
import type { WebPlayer, VideoSource, PaywallConfig } from 'unified-video-framework';

const MyVideoPlayer: React.FC = () => {
  const handleReady = (player: WebPlayer): void => {
    console.log('Player ready:', player);
  };

  const handleError = (error: unknown): void => {
    console.error('Player error:', error);
  };

  const props: WebPlayerViewProps = {
    url: 'https://example.com/video.m3u8',
    type: 'hls',
    autoPlay: false,
    muted: false,
    onReady: handleReady,
    onError: handleError
  };

  return <WebPlayerView {...props} />;
};
```

## 🔧 Troubleshooting

### Common Issues

1. **Player not showing**: Make sure the container has a defined width and height
2. **Autoplay not working**: Modern browsers require `muted={true}` for autoplay
3. **Cast not working**: Ensure you're on HTTPS and have set `cast={true}`
4. **Paywall not appearing**: Check browser console for API errors

### Debug Mode

Enable debug logging to troubleshoot issues:

```jsx
<WebPlayerView
  url="video.mp4"
  debug={true} // Enable detailed logging
/>
```

## 📝 Notes

- The component automatically handles cleanup on unmount
- Changing the `url` prop will reload the player
- The player adapts to its container size
- For SSR frameworks like Next.js, use dynamic imports

---

For more examples and API documentation, visit the [main documentation](./docs/README.md).
