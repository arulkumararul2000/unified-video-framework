const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { VideoPlayerFactory, EventEmitter } = require('unified-video-framework');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory storage for demo purposes (use a real database in production)
const sessions = new Map();
const rentals = new Map();
const analytics = new Map();

// Video catalog
const videoCatalog = [
  {
    id: 'video1',
    title: 'Big Buck Bunny',
    description: 'Open source animated short',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    type: 'mp4',
    duration: 596,
    isFree: true,
    price: 0
  },
  {
    id: 'video2',
    title: 'Premium Stream Demo',
    description: 'High-quality HLS stream with DRM',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    type: 'hls',
    duration: 734,
    isFree: false,
    price: 4.99,
    freeDuration: 120
  },
  {
    id: 'video3',
    title: 'Advanced Features Demo',
    description: 'Showcasing subtitles and multiple audio tracks',
    url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    type: 'hls',
    duration: 888,
    isFree: false,
    price: 9.99,
    freeDuration: 180,
    subtitles: [
      {
        id: 'en',
        label: 'English',
        language: 'en',
        url: 'https://example.com/subtitles/en.vtt'
      },
      {
        id: 'es',
        label: 'Spanish',
        language: 'es',
        url: 'https://example.com/subtitles/es.vtt'
      }
    ]
  }
];

// API Routes

// Get video catalog
app.get('/api/videos', (req, res) => {
  res.json({
    success: true,
    data: videoCatalog
  });
});

// Get specific video details
app.get('/api/videos/:videoId', (req, res) => {
  const video = videoCatalog.find(v => v.id === req.params.videoId);
  
  if (!video) {
    return res.status(404).json({
      success: false,
      error: 'Video not found'
    });
  }
  
  res.json({
    success: true,
    data: video
  });
});

// Create player session
app.post('/api/sessions', (req, res) => {
  const { userId, videoId, platform = 'web' } = req.body;
  
  const video = videoCatalog.find(v => v.id === videoId);
  if (!video) {
    return res.status(404).json({
      success: false,
      error: 'Video not found'
    });
  }
  
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    userId,
    videoId,
    platform,
    createdAt: new Date(),
    events: [],
    player: null
  };
  
  // Create player instance based on platform
  try {
    const playerOptions = {
      platform,
      debug: true,
      analytics: {
        enabled: true,
        provider: 'internal'
      }
    };
    
    // In a real implementation, this would create actual player instances
    // For demo purposes, we'll simulate it
    session.player = {
      type: platform,
      status: 'initialized',
      options: playerOptions
    };
    
    sessions.set(sessionId, session);
    
    res.json({
      success: true,
      data: {
        sessionId,
        player: session.player,
        video
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create player session'
    });
  }
});

// Track player events
app.post('/api/sessions/:sessionId/events', (req, res) => {
  const { sessionId } = req.params;
  const { event, data } = req.body;
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
  
  const eventData = {
    event,
    data,
    timestamp: new Date()
  };
  
  session.events.push(eventData);
  
  // Update analytics
  const videoAnalytics = analytics.get(session.videoId) || {
    views: 0,
    totalWatchTime: 0,
    events: []
  };
  
  switch (event) {
    case 'play':
      videoAnalytics.views++;
      break;
    case 'timeupdate':
      if (data.currentTime) {
        videoAnalytics.totalWatchTime = Math.max(
          videoAnalytics.totalWatchTime,
          data.currentTime
        );
      }
      break;
  }
  
  videoAnalytics.events.push(eventData);
  analytics.set(session.videoId, videoAnalytics);
  
  res.json({
    success: true,
    data: eventData
  });
});

// Get session analytics
app.get('/api/sessions/:sessionId/analytics', (req, res) => {
  const { sessionId } = req.params;
  
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
  
  const videoAnalytics = analytics.get(session.videoId) || {};
  
  res.json({
    success: true,
    data: {
      session: {
        id: session.id,
        userId: session.userId,
        videoId: session.videoId,
        duration: new Date() - session.createdAt,
        eventCount: session.events.length
      },
      video: videoAnalytics
    }
  });
});

// Paywall configuration endpoint
app.get('/api/rentals/config', (req, res) => {
  const { videoId, userId } = req.query;
  
  const video = videoCatalog.find(v => v.id === videoId);
  if (!video) {
    return res.status(404).json({
      success: false,
      error: 'Video not found'
    });
  }
  
  // Check if user has active rental
  const rentalKey = `${userId}-${videoId}`;
  const rental = rentals.get(rentalKey);
  
  if (rental && rental.expiresAt > new Date()) {
    return res.json({
      success: true,
      data: {
        enabled: false,
        reason: 'Active rental exists'
      }
    });
  }
  
  // Return paywall configuration
  res.json({
    success: true,
    data: {
      enabled: !video.isFree,
      apiBase: `http://localhost:${PORT}/api`,
      userId,
      videoId,
      gateways: ['stripe', 'cashfree'],
      pricing: {
        amount: video.price,
        currency: 'USD',
        rentalDurationHours: 48
      },
      branding: {
        title: 'Rent This Video',
        description: `Get 48-hour access to "${video.title}"`,
        theme: {
          primaryColor: '#007bff',
          backgroundColor: '#1a1a1a'
        }
      }
    }
  });
});

// Process rental payment (mock implementation)
app.post('/api/rentals/process', (req, res) => {
  const { userId, videoId, paymentMethod, paymentToken } = req.body;
  
  const video = videoCatalog.find(v => v.id === videoId);
  if (!video) {
    return res.status(404).json({
      success: false,
      error: 'Video not found'
    });
  }
  
  // In production, you would:
  // 1. Validate the payment token with the payment gateway
  // 2. Process the payment
  // 3. Store the rental in a database
  
  // Mock successful payment
  const rentalKey = `${userId}-${videoId}`;
  const rental = {
    id: uuidv4(),
    userId,
    videoId,
    amount: video.price,
    currency: 'USD',
    paymentMethod,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
  };
  
  rentals.set(rentalKey, rental);
  
  res.json({
    success: true,
    data: {
      transactionId: rental.id,
      rental
    }
  });
});

// Check rental status
app.get('/api/rentals/check', (req, res) => {
  const { userId, videoId } = req.query;
  
  const rentalKey = `${userId}-${videoId}`;
  const rental = rentals.get(rentalKey);
  
  if (!rental || rental.expiresAt < new Date()) {
    return res.json({
      success: true,
      data: {
        hasAccess: false
      }
    });
  }
  
  res.json({
    success: true,
    data: {
      hasAccess: true,
      rental
    }
  });
});

// Get overall analytics
app.get('/api/analytics', (req, res) => {
  const analyticsData = [];
  
  analytics.forEach((data, videoId) => {
    const video = videoCatalog.find(v => v.id === videoId);
    analyticsData.push({
      videoId,
      title: video?.title || 'Unknown',
      ...data
    });
  });
  
  res.json({
    success: true,
    data: {
      videos: analyticsData,
      totalSessions: sessions.size,
      totalRentals: rentals.size
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date()
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Analytics dashboard: http://localhost:${PORT}/api/analytics`);
  console.log(`🎬 Video catalog: http://localhost:${PORT}/api/videos`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});
