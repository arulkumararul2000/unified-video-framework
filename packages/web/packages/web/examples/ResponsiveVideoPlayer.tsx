import React, { useRef, useEffect, useState } from 'react';
import { WebPlayerView } from '../src/index';

interface ResponsiveVideoPlayerProps {
  src: string;
  title?: string;
  subtitle?: string;
  poster?: string;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  width?: string | number;
  height?: string | number;
  className?: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: () => void;
}

const ResponsiveVideoPlayer: React.FC<ResponsiveVideoPlayerProps> = ({
  src,
  title = '',
  subtitle = '',
  poster,
  autoplay = false,
  muted = false,
  controls = true,
  loop = false,
  width = '100%',
  height = 'auto',
  className = '',
  onReady,
  onPlay,
  onPause,
  onEnded,
  onError,
  onTimeUpdate,
  onLoadedMetadata
}) => {
  const playerRef = useRef<WebPlayerView | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                      window.innerWidth <= 768;
      setIsMobileDevice(isMobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize player
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const player = new WebPlayerView({
        src,
        title,
        subtitle,
        poster,
        autoplay: isMobileDevice ? false : autoplay, // Prevent autoplay on mobile
        muted,
        controls,
        loop,
        responsive: true, // Enable responsive features
        disablePictureInPicture: isMobileDevice, // Disable PiP on mobile
        keyboardShortcuts: !isMobileDevice, // Enable keyboard shortcuts on desktop
        touchControls: isMobileDevice, // Enable touch-optimized controls on mobile
        // Enhanced mobile settings
        mobileSettings: {
          simplifiedControls: true,
          largerTouchTargets: true,
          hideVolumeSlider: true,
          hideQualityBadge: true,
          autoHideControls: true,
          autoHideDelay: 3000
        },
        // Desktop enhancements
        desktopSettings: {
          enhancedHover: true,
          volumeSliderExpansion: true,
          keyboardNavigation: true,
          rightClickMenu: true
        }
      });

      // Mount the player
      player.mount(containerRef.current);
      playerRef.current = player;

      // Set up event listeners
      const handleReady = () => {
        setIsPlayerReady(true);
        setPlayerError(null);
        onReady?.();
      };

      const handleError = (error: ErrorEvent) => {
        const errorMessage = error.message || 'Video playback error';
        setPlayerError(errorMessage);
        onError?.(new Error(errorMessage));
      };

      const handlePlay = () => {
        onPlay?.();
      };

      const handlePause = () => {
        onPause?.();
      };

      const handleEnded = () => {
        onEnded?.();
      };

      const handleTimeUpdate = (event: CustomEvent) => {
        onTimeUpdate?.(event.detail.currentTime);
      };

      const handleLoadedMetadata = () => {
        onLoadedMetadata?.();
      };

      // Add event listeners
      player.on('ready', handleReady);
      player.on('error', handleError);
      player.on('play', handlePlay);
      player.on('pause', handlePause);
      player.on('ended', handleEnded);
      player.on('timeupdate', handleTimeUpdate);
      player.on('loadedmetadata', handleLoadedMetadata);

      // Cleanup function
      return () => {
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
      };
    } catch (error) {
      console.error('Failed to initialize video player:', error);
      setPlayerError('Failed to initialize video player');
      onError?.(error as Error);
    }
  }, [src, title, subtitle, poster, autoplay, muted, controls, loop, isMobileDevice]);

  // Dynamic styling based on device type
  const containerStyle: React.CSSProperties = {
    width,
    height,
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: isMobileDevice ? '0' : '8px',
    overflow: 'hidden',
    // Ensure proper aspect ratio
    aspectRatio: height === 'auto' ? '16/9' : undefined,
    // Add mobile-specific styling
    ...(isMobileDevice && {
      width: '100%',
      height: 'auto',
      minHeight: '200px',
      borderRadius: '0'
    })
  };

  // Error display component
  const ErrorDisplay = () => (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#fff',
        textAlign: 'center',
        padding: '20px',
        fontSize: isMobileDevice ? '14px' : '16px'
      }}
    >
      <div>
        <p>⚠️ {playerError}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: isMobileDevice ? '14px' : '16px'
          }}
        >
          Reload Page
        </button>
      </div>
    </div>
  );

  // Loading display component
  const LoadingDisplay = () => (
    <div 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#fff'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div 
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid #333',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 10px'
          }}
        />
        <p>Loading video...</p>
      </div>
    </div>
  );

  return (
    <div 
      className={`responsive-video-player ${className} ${isMobileDevice ? 'mobile' : 'desktop'}`}
      style={containerStyle}
    >
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          minHeight: 'inherit'
        }} 
      />
      
      {/* Error state */}
      {playerError && <ErrorDisplay />}
      
      {/* Loading state */}
      {!isPlayerReady && !playerError && <LoadingDisplay />}
      
      {/* Add CSS animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .responsive-video-player.mobile {
          --uvf-primary-color: #007bff;
          --uvf-touch-target-size: 44px;
        }
        
        .responsive-video-player.desktop {
          --uvf-primary-color: #007bff;
          --uvf-hover-scale: 1.1;
        }
        
        /* Responsive container queries for modern browsers */
        @container (max-width: 480px) {
          .responsive-video-player {
            border-radius: 0 !important;
          }
        }
        
        @container (min-width: 1200px) {
          .responsive-video-player {
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }
        }
      `}</style>
    </div>
  );
};

// Example usage component
export const VideoPlayerExample: React.FC = () => {
  const [currentVideo, setCurrentVideo] = useState(0);
  
  const videos = [
    {
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      title: 'Big Buck Bunny',
      subtitle: 'A large and lovable rabbit deals with three tiny bullies',
      poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg'
    },
    {
      src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      title: 'Elephants Dream',
      subtitle: 'The first Blender Open Movie from 2006',
      poster: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg'
    }
  ];

  const handleVideoReady = () => {
    console.log('Video is ready to play');
  };

  const handleVideoError = (error: Error) => {
    console.error('Video error:', error);
  };

  const switchVideo = (index: number) => {
    setCurrentVideo(index);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h2>Responsive Video Player Demo</h2>
      
      {/* Video switcher */}
      <div style={{ marginBottom: '20px' }}>
        {videos.map((video, index) => (
          <button
            key={index}
            onClick={() => switchVideo(index)}
            style={{
              margin: '0 10px 10px 0',
              padding: '10px 15px',
              backgroundColor: currentVideo === index ? '#007bff' : '#666',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {video.title}
          </button>
        ))}
      </div>
      
      {/* Responsive video player */}
      <ResponsiveVideoPlayer
        key={currentVideo} // Force re-render when video changes
        src={videos[currentVideo].src}
        title={videos[currentVideo].title}
        subtitle={videos[currentVideo].subtitle}
        poster={videos[currentVideo].poster}
        autoplay={false}
        muted={false}
        controls={true}
        onReady={handleVideoReady}
        onError={handleVideoError}
        onPlay={() => console.log('Video started playing')}
        onPause={() => console.log('Video paused')}
        onEnded={() => console.log('Video ended')}
        onTimeUpdate={(time) => console.log('Time update:', time)}
      />
      
      <div style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
        <p>
          This responsive video player adapts to different screen sizes and devices:
        </p>
        <ul>
          <li><strong>Mobile:</strong> Touch-optimized controls, simplified UI, larger buttons</li>
          <li><strong>Tablet:</strong> Balanced controls with desktop features</li>
          <li><strong>Desktop:</strong> Full feature set with hover effects and keyboard shortcuts</li>
          <li><strong>Ultra-wide:</strong> Enhanced sizing for large displays</li>
        </ul>
      </div>
    </div>
  );
};

export default ResponsiveVideoPlayer;