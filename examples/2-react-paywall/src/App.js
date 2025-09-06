import React, { useState, useEffect } from 'react';
import { WebPlayerView } from 'unified-video-framework/web';
import './App.css';

// Sample video catalog
const videoCatalog = [
  {
    id: 'video1',
    title: 'Big Buck Bunny',
    description: 'A large and lovable rabbit deals with three tiny bullies, led by a flying squirrel.',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Big_Buck_Bunny_-_forest.jpg/1200px-Big_Buck_Bunny_-_forest.jpg',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    type: 'mp4',
    duration: 596,
    isFree: true
  },
  {
    id: 'video2',
    title: 'Tears of Steel',
    description: 'Premium content with paywall - Watch 2 minutes free!',
    thumbnail: 'https://mango.blender.org/wp-content/uploads/2013/05/01_thom_celia_bridge.jpg',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    type: 'hls',
    duration: 734,
    isFree: false,
    rentalPrice: 4.99,
    freeDuration: 120 // 2 minutes free preview
  },
  {
    id: 'video3',
    title: 'Advanced Streaming Demo',
    description: 'Premium HLS stream with adaptive bitrate - 3 minutes free preview',
    thumbnail: 'https://via.placeholder.com/400x225/007bff/ffffff?text=Premium+Content',
    url: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    type: 'hls',
    duration: 210,
    isFree: false,
    rentalPrice: 9.99,
    freeDuration: 180 // 3 minutes free preview
  }
];

function App() {
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [player, setPlayer] = useState(null);
  const [user, setUser] = useState({
    id: 'demo-user-123',
    name: 'Demo User',
    isSubscribed: false
  });
  const [purchasedVideos, setPurchasedVideos] = useState([]);

  // Simulate checking user's purchased videos
  useEffect(() => {
    const purchased = localStorage.getItem('purchasedVideos');
    if (purchased) {
      setPurchasedVideos(JSON.parse(purchased));
    }
  }, []);

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  const handlePlayerReady = (playerInstance) => {
    setPlayer(playerInstance);
    console.log('Player ready:', playerInstance);
  };

  const handlePlayerError = (error) => {
    console.error('Player error:', error);
  };

  const isVideoPurchased = (videoId) => {
    return purchasedVideos.includes(videoId);
  };

  const getPaywallConfig = (video) => {
    if (video.isFree || isVideoPurchased(video.id) || user.isSubscribed) {
      return undefined;
    }

    return {
      enabled: true,
      apiBase: process.env.REACT_APP_API_URL || '/api',
      userId: user.id,
      videoId: video.id,
      gateways: ['stripe', 'cashfree'],
      pricing: {
        amount: video.rentalPrice,
        currency: 'USD',
        rentalDurationHours: 48
      },
      branding: {
        title: 'Unlock Full Video',
        description: `Get 48-hour access to "${video.title}"`,
        logoUrl: '/logo.png',
        theme: {
          primaryColor: '#007bff',
          backgroundColor: '#1a1a1a'
        }
      },
      onSuccess: (transactionId) => {
        console.log('Payment successful:', transactionId);
        // Update purchased videos
        const newPurchased = [...purchasedVideos, video.id];
        setPurchasedVideos(newPurchased);
        localStorage.setItem('purchasedVideos', JSON.stringify(newPurchased));
        // Reload player
        setSelectedVideo({ ...video });
      }
    };
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎬 Unified Video Framework - React Paywall Example</h1>
        <div className="user-info">
          <span>👤 {user.name}</span>
          <span className={`subscription-badge ${user.isSubscribed ? 'subscribed' : 'free'}`}>
            {user.isSubscribed ? 'Premium' : 'Free User'}
          </span>
        </div>
      </header>

      <div className="container">
        <div className="video-catalog">
          <h2>Video Catalog</h2>
          <div className="video-grid">
            {videoCatalog.map((video) => (
              <div 
                key={video.id} 
                className={`video-card ${selectedVideo?.id === video.id ? 'selected' : ''}`}
                onClick={() => handleVideoSelect(video)}
              >
                <img src={video.thumbnail} alt={video.title} />
                <div className="video-info">
                  <h3>{video.title}</h3>
                  <p>{video.description}</p>
                  <div className="video-meta">
                    <span className="duration">{Math.floor(video.duration / 60)}min</span>
                    {!video.isFree && (
                      <span className="price">
                        {isVideoPurchased(video.id) ? '✓ Purchased' : `$${video.rentalPrice}`}
                      </span>
                    )}
                    {video.isFree && <span className="free-badge">Free</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedVideo && (
          <div className="player-section">
            <h2>{selectedVideo.title}</h2>
            <div className="player-wrapper">
              <WebPlayerView
                key={selectedVideo.id} // Force re-mount on video change
                url={selectedVideo.url}
                type={selectedVideo.type}
                autoPlay={false}
                muted={false}
                enableAdaptiveBitrate={true}
                debug={true}
                freeDuration={selectedVideo.freeDuration}
                paywall={getPaywallConfig(selectedVideo)}
                metadata={{
                  title: selectedVideo.title,
                  description: selectedVideo.description,
                  duration: selectedVideo.duration,
                  thumbnail: selectedVideo.thumbnail
                }}
                playerTheme="#007bff"
                onReady={handlePlayerReady}
                onError={handlePlayerError}
                className="video-player"
                style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}
              />
            </div>

            <div className="player-details">
              <h3>Video Details</h3>
              <p>{selectedVideo.description}</p>
              {!selectedVideo.isFree && !isVideoPurchased(selectedVideo.id) && !user.isSubscribed && (
                <div className="paywall-info">
                  <p>🔒 This is premium content</p>
                  <p>Watch {selectedVideo.freeDuration / 60} minutes free, then rent for 48 hours</p>
                  <p>Price: ${selectedVideo.rentalPrice}</p>
                </div>
              )}
              {isVideoPurchased(selectedVideo.id) && (
                <div className="purchase-info">
                  <p>✅ You have access to this video for 48 hours</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="features-section">
          <h2>Features Demonstrated</h2>
          <div className="features-grid">
            <div className="feature">
              <h3>💳 Paywall Integration</h3>
              <p>Premium videos require payment after free preview</p>
            </div>
            <div className="feature">
              <h3>⏱️ Free Preview</h3>
              <p>Watch 2-3 minutes before payment is required</p>
            </div>
            <div className="feature">
              <h3>🔐 Purchase Tracking</h3>
              <p>Purchased videos are remembered locally</p>
            </div>
            <div className="feature">
              <h3>🎨 Custom Theming</h3>
              <p>Player theme matches app design</p>
            </div>
            <div className="feature">
              <h3>📊 Video Metadata</h3>
              <p>Rich metadata display for each video</p>
            </div>
            <div className="feature">
              <h3>🚀 HLS Streaming</h3>
              <p>Adaptive bitrate streaming support</p>
            </div>
          </div>
        </div>

        <div className="test-section">
          <h2>Testing the Paywall</h2>
          <div className="test-info">
            <p>To test the paywall functionality:</p>
            <ol>
              <li>Select a premium video (marked with a price)</li>
              <li>Watch the free preview (2-3 minutes)</li>
              <li>When the paywall appears, you can:</li>
              <ul>
                <li>Use test card: 4242 4242 4242 4242</li>
                <li>Any future expiry date</li>
                <li>Any 3-digit CVC</li>
              </ul>
              <li>After "purchase", the video will be unlocked</li>
            </ol>
            <button 
              className="clear-button"
              onClick={() => {
                localStorage.removeItem('purchasedVideos');
                setPurchasedVideos([]);
                alert('Purchase history cleared!');
              }}
            >
              Clear Purchase History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
