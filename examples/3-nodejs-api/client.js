/**
 * Example client demonstrating how to interact with the Node.js API
 * This can be run separately to test the API endpoints
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

class VideoAPIClient {
  constructor(userId) {
    this.userId = userId;
    this.sessionId = null;
  }

  // Get video catalog
  async getVideos() {
    try {
      const response = await axios.get(`${API_BASE}/videos`);
      return response.data;
    } catch (error) {
      console.error('Error fetching videos:', error.message);
      throw error;
    }
  }

  // Get specific video
  async getVideo(videoId) {
    try {
      const response = await axios.get(`${API_BASE}/videos/${videoId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching video:', error.message);
      throw error;
    }
  }

  // Create player session
  async createSession(videoId, platform = 'web') {
    try {
      const response = await axios.post(`${API_BASE}/sessions`, {
        userId: this.userId,
        videoId,
        platform
      });
      this.sessionId = response.data.data.sessionId;
      return response.data;
    } catch (error) {
      console.error('Error creating session:', error.message);
      throw error;
    }
  }

  // Track player event
  async trackEvent(event, data) {
    if (!this.sessionId) {
      throw new Error('No active session. Create a session first.');
    }

    try {
      const response = await axios.post(`${API_BASE}/sessions/${this.sessionId}/events`, {
        event,
        data
      });
      return response.data;
    } catch (error) {
      console.error('Error tracking event:', error.message);
      throw error;
    }
  }

  // Get session analytics
  async getSessionAnalytics() {
    if (!this.sessionId) {
      throw new Error('No active session. Create a session first.');
    }

    try {
      const response = await axios.get(`${API_BASE}/sessions/${this.sessionId}/analytics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics:', error.message);
      throw error;
    }
  }

  // Get paywall configuration
  async getPaywallConfig(videoId) {
    try {
      const response = await axios.get(`${API_BASE}/rentals/config`, {
        params: {
          userId: this.userId,
          videoId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching paywall config:', error.message);
      throw error;
    }
  }

  // Process rental payment
  async processRental(videoId, paymentMethod, paymentToken) {
    try {
      const response = await axios.post(`${API_BASE}/rentals/process`, {
        userId: this.userId,
        videoId,
        paymentMethod,
        paymentToken
      });
      return response.data;
    } catch (error) {
      console.error('Error processing rental:', error.message);
      throw error;
    }
  }

  // Check rental status
  async checkRental(videoId) {
    try {
      const response = await axios.get(`${API_BASE}/rentals/check`, {
        params: {
          userId: this.userId,
          videoId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error checking rental:', error.message);
      throw error;
    }
  }

  // Get overall analytics
  async getAnalytics() {
    try {
      const response = await axios.get(`${API_BASE}/analytics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics:', error.message);
      throw error;
    }
  }
}

// Example usage
async function runExample() {
  console.log('🎬 Video API Client Example\n');

  const client = new VideoAPIClient('demo-user-123');

  try {
    // 1. Get video catalog
    console.log('📋 Fetching video catalog...');
    const videos = await client.getVideos();
    console.log(`Found ${videos.data.length} videos:`);
    videos.data.forEach(video => {
      console.log(`  - ${video.title} (${video.isFree ? 'Free' : `$${video.price}`})`);
    });
    console.log();

    // 2. Get specific video
    const videoId = 'video2';
    console.log(`🎥 Getting details for video: ${videoId}`);
    const video = await client.getVideo(videoId);
    console.log(`Title: ${video.data.title}`);
    console.log(`Description: ${video.data.description}`);
    console.log(`Duration: ${Math.floor(video.data.duration / 60)} minutes`);
    console.log();

    // 3. Check rental status
    console.log('🔐 Checking rental status...');
    const rentalStatus = await client.checkRental(videoId);
    console.log(`Has access: ${rentalStatus.data.hasAccess}`);
    console.log();

    // 4. Get paywall config
    console.log('💳 Getting paywall configuration...');
    const paywallConfig = await client.getPaywallConfig(videoId);
    if (paywallConfig.data.enabled) {
      console.log('Paywall enabled:');
      console.log(`  - Price: $${paywallConfig.data.pricing.amount}`);
      console.log(`  - Duration: ${paywallConfig.data.pricing.rentalDurationHours} hours`);
      console.log(`  - Gateways: ${paywallConfig.data.gateways.join(', ')}`);
    } else {
      console.log('No paywall needed:', paywallConfig.data.reason);
    }
    console.log();

    // 5. Create player session
    console.log('🎮 Creating player session...');
    const session = await client.createSession(videoId, 'web');
    console.log(`Session created: ${session.data.sessionId}`);
    console.log();

    // 6. Simulate player events
    console.log('📊 Simulating player events...');
    
    await client.trackEvent('load', { url: video.data.url });
    console.log('  ✓ Video loaded');
    
    await client.trackEvent('play', {});
    console.log('  ✓ Video started');
    
    // Simulate watching for 30 seconds
    for (let i = 0; i <= 30; i += 10) {
      await client.trackEvent('timeupdate', { currentTime: i });
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
    }
    console.log('  ✓ Watched 30 seconds');
    
    await client.trackEvent('pause', { currentTime: 30 });
    console.log('  ✓ Video paused');
    console.log();

    // 7. Get session analytics
    console.log('📈 Getting session analytics...');
    const analytics = await client.getSessionAnalytics();
    console.log('Session stats:');
    console.log(`  - Duration: ${Math.floor(analytics.data.session.duration / 1000)} seconds`);
    console.log(`  - Events tracked: ${analytics.data.session.eventCount}`);
    console.log();

    // 8. Process rental (mock payment)
    if (paywallConfig.data.enabled) {
      console.log('💰 Processing rental payment...');
      const rental = await client.processRental(videoId, 'stripe', 'tok_visa_test');
      console.log(`Payment successful! Transaction ID: ${rental.data.transactionId}`);
      console.log(`Rental expires at: ${new Date(rental.data.rental.expiresAt).toLocaleString()}`);
      console.log();
    }

    // 9. Get overall analytics
    console.log('🌐 Getting overall analytics...');
    const overallAnalytics = await client.getAnalytics();
    console.log(`Total sessions: ${overallAnalytics.data.totalSessions}`);
    console.log(`Total rentals: ${overallAnalytics.data.totalRentals}`);
    if (overallAnalytics.data.videos.length > 0) {
      console.log('Video stats:');
      overallAnalytics.data.videos.forEach(videoStat => {
        console.log(`  - ${videoStat.title}: ${videoStat.views} views`);
      });
    }

    console.log('\n✅ Example completed successfully!');
  } catch (error) {
    console.error('\n❌ Example failed:', error.message);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample();
}

module.exports = VideoAPIClient;
