# Unified Video Framework - Complete Documentation

This document provides comprehensive guidance on how to use the Unified Video Framework, including web API integration, paywall implementation, and authentication bypass methods.

## 📖 Quick Navigation

- [🚀 Quick Start Web Usage](#-quick-start-web-usage)
- [🌐 Web Player API Reference](#-web-player-api-reference)
- [💳 Paywall Integration Guide](#-paywall-integration-guide)
- [🔓 Authentication & Bypass Methods](#-authentication--bypass-methods)
- [🛠️ Backend API Setup](#️-backend-api-setup)
- [📚 Complete Examples](#-complete-examples)
- [🔧 Advanced Configuration](#-advanced-configuration)

## 🚀 Quick Start Web Usage

### Simple Video Player

The easiest way to integrate the video player in your web application:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Video App</title>
</head>
<body>
    <!-- Video Container -->
    <div id="player-container" style="width: 100%; aspect-ratio: 16/9; background: #000;"></div>
    
    <!-- Include the Framework -->
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
    <script src="https://cdn.dashjs.org/latest/dash.all.min.js"></script>
    
    <script>
        // Initialize the Unified Video Player
        class UnifiedVideoPlayer {
            constructor(container) {
                this.container = container;
                this.video = document.createElement('video');
                this.video.controls = true;
                this.video.style.width = '100%';
                this.video.style.height = '100%';
                this.container.appendChild(this.video);
                this.hls = null;
                this.dash = null;
            }
            
            async load(url, options = {}) {
                const { type = 'auto', autoPlay = false, paywall = null } = options;
                
                // Auto-detect format
                let format = type;
                if (format === 'auto') {
                    if (url.includes('.m3u8')) format = 'hls';
                    else if (url.includes('.mpd')) format = 'dash';
                    else format = 'mp4';
                }
                
                // Load based on format
                switch(format) {
                    case 'hls':
                        await this.loadHLS(url);
                        break;
                    case 'dash':
                        await this.loadDASH(url);
                        break;
                    default:
                        this.video.src = url;
                }
                
                // Handle paywall if provided
                if (paywall) {
                    this.setupPaywall(paywall);
                }
                
                if (autoPlay) {
                    this.video.play().catch(console.warn);
                }
            }
            
            async loadHLS(url) {
                if (Hls.isSupported()) {
                    this.hls = new Hls();
                    this.hls.loadSource(url);
                    this.hls.attachMedia(this.video);
                } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
                    this.video.src = url;
                }
            }
            
            async loadDASH(url) {
                this.dash = dashjs.MediaPlayer().create();
                this.dash.initialize(this.video, url, false);
            }
            
            setupPaywall(config) {
                const { freeDuration, onPaywallShow, onPaywallHide } = config;
                
                if (freeDuration > 0) {
                    this.video.addEventListener('timeupdate', () => {
                        if (this.video.currentTime >= freeDuration) {
                            this.video.pause();
                            onPaywallShow && onPaywallShow();
                        }
                    });
                }
            }
            
            play() { return this.video.play(); }
            pause() { this.video.pause(); }
            seek(time) { this.video.currentTime = time; }
            setVolume(level) { this.video.volume = level; }
        }
        
        // Usage Example
        const player = new UnifiedVideoPlayer(document.getElementById('player-container'));
        
        // Load a video with paywall
        player.load('https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', {
            type: 'hls',
            autoPlay: true,
            paywall: {
                freeDuration: 60, // 60 seconds free
                onPaywallShow: () => showRentalDialog(),
                onPaywallHide: () => hideRentalDialog()
            }
        });
        
        function showRentalDialog() {
            // Show your custom paywall UI
            console.log('Paywall triggered - show rental options');
        }
        
        function hideRentalDialog() {
            // Hide paywall and resume playback
            console.log('Payment successful - resume playback');
        }
    </script>
</body>
</html>
```

### Using the Enhanced Player

For a complete solution with built-in paywall support:

```html
<!-- Include the enhanced player -->
<iframe src="./apps/demo/enhanced-player.html?url=VIDEO_URL&paywall=1&userId=USER_ID&videoId=VIDEO_ID" 
        width="100%" height="500" frameborder="0"></iframe>
```

## 🌐 Web Player API Reference

### Core Player Methods

```typescript
interface UnifiedVideoPlayer {
  // Content Loading
  load(url: string, options?: LoadOptions): Promise<void>;
  loadSource(source: VideoSource): Promise<void>;
  
  // Playback Control
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  
  // Audio/Video Control
  setVolume(level: number): void; // 0-1
  toggleMute(): void;
  setPlaybackRate(rate: number): void; // 0.5, 1, 1.5, 2
  
  // Quality Control
  getQualities(): Quality[];
  setQuality(qualityId: string): void;
  
  // Fullscreen & PiP
  enterFullscreen(): void;
  exitFullscreen(): void;
  enterPictureInPicture(): void;
  exitPictureInPicture(): void;
  
  // State & Info
  getCurrentTime(): number;
  getDuration(): number;
  getState(): PlayerState;
  getMetadata(): VideoMetadata;
  
  // Events
  on(event: string, callback: Function): void;
  off(event: string, callback: Function): void;
}

interface LoadOptions {
  type?: 'auto' | 'mp4' | 'hls' | 'dash';
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  freeDuration?: number; // For paywall (seconds)
  drm?: DRMConfig;
  paywall?: PaywallConfig;
}

interface VideoSource {
  url: string;
  type: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  drm?: DRMConfig;
}
```

### Event System

```typescript
// Listen to player events
player.on('ready', () => console.log('Player ready'));
player.on('play', () => console.log('Playback started'));
player.on('pause', () => console.log('Playback paused'));
player.on('timeupdate', (data) => console.log('Time:', data.currentTime));
player.on('error', (error) => console.error('Player error:', error));
player.on('qualitychange', (quality) => console.log('Quality changed to:', quality));

// Paywall-specific events
player.on('paywall:show', () => console.log('Paywall triggered'));
player.on('paywall:payment:start', (gateway) => console.log('Payment started:', gateway));
player.on('paywall:payment:success', () => console.log('Payment successful'));
player.on('paywall:payment:cancel', () => console.log('Payment cancelled'));
```

## 💳 Paywall Integration Guide

### Basic Paywall Setup

```javascript
// Initialize player with paywall
const player = new UnifiedVideoPlayer(container);

player.load('video.m3u8', {
    freeDuration: 120, // 2 minutes free preview
    paywall: {
        enabled: true,
        apiBase: 'http://localhost:3100', // Your rental API
        userId: 'user123',
        videoId: 'movie456',
        gateways: ['stripe', 'cashfree'], // Payment methods
        branding: {
            title: 'Continue Watching',
            description: 'Rent this video to continue watching',
            theme: {
                primaryColor: '#ff4d4f',
                backgroundColor: '#0f0f10'
            }
        }
    }
});
```

### Advanced Paywall Configuration

```javascript
// Dynamic paywall configuration
async function setupPaywall(videoId, userId) {
    // Fetch paywall config from your API
    const response = await fetch(`/api/rentals/config?videoId=${videoId}&userId=${userId}`);
    const config = await response.json();
    
    return {
        enabled: config.enabled,
        apiBase: config.apiBase,
        userId: config.userId,
        videoId: config.videoId,
        gateways: config.gateways,
        pricing: {
            amount: config.priceUSD || 1.99,
            currency: config.currency || 'USD',
            duration: config.rentalHours || 48
        },
        branding: config.branding,
        callbacks: {
            onShow: () => analytics.track('paywall_shown'),
            onPaymentStart: (gateway) => analytics.track('payment_started', { gateway }),
            onPaymentSuccess: () => {
                analytics.track('payment_completed');
                // Resume playback automatically
                player.play();
            },
            onPaymentCancel: () => analytics.track('payment_cancelled')
        }
    };
}

// Usage
const paywallConfig = await setupPaywall('movie123', 'user456');
player.load('video.m3u8', {
    freeDuration: 180,
    paywall: paywallConfig
});
```

### Payment Gateway Integration

#### Stripe Integration

```javascript
// Stripe checkout flow
async function initiateStripePayment(userId, videoId) {
    const response = await fetch('/api/rentals/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: userId,
            videoId: videoId,
            successUrl: `${window.location.origin}/player?payment=success`,
            cancelUrl: `${window.location.origin}/player?payment=cancel`
        })
    });
    
    const { url } = await response.json();
    
    // Open Stripe checkout in popup
    const popup = window.open(url, 'stripe-checkout', 'width=800,height=600');
    
    // Listen for payment completion
    return new Promise((resolve, reject) => {
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                checkPaymentStatus(userId, videoId).then(resolve).catch(reject);
            }
        }, 1000);
    });
}

async function checkPaymentStatus(userId, videoId) {
    const response = await fetch(`/api/rentals/entitlement?userId=${userId}&videoId=${videoId}`);
    const { entitled } = await response.json();
    return entitled;
}
```

#### Cashfree Integration

```javascript
// Cashfree payment flow
async function initiateCashfreePayment(userId, videoId) {
    const response = await fetch('/api/rentals/cashfree/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: userId,
            videoId: videoId,
            returnUrl: `${window.location.origin}/player?payment=success`
        })
    });
    
    const { paymentLink, orderId } = await response.json();
    
    // Open Cashfree checkout
    const popup = window.open(paymentLink, 'cashfree-checkout', 'width=800,height=600');
    
    // Listen for completion
    window.addEventListener('message', async (event) => {
        if (event.data.type === 'uvfCheckout' && event.data.status === 'success') {
            // Verify payment with your backend
            const verified = await verifyCashfreePayment(orderId, userId, videoId);
            if (verified) {
                // Payment successful - resume video
                player.play();
            }
        }
    });
    
    return orderId;
}

async function verifyCashfreePayment(orderId, userId, videoId) {
    const response = await fetch(`/api/rentals/cashfree/verify?orderId=${orderId}&userId=${userId}&videoId=${videoId}`);
    const { success } = await response.json();
    return success;
}
```

## 🔓 Authentication & Bypass Methods

### Development/Testing Bypass

```javascript
// For development/testing - bypass paywall entirely
player.load('video.m3u8', {
    paywall: {
        enabled: false // Disable paywall
    }
});

// OR use mock payment for testing
async function grantMockAccess(userId, videoId) {
    const response = await fetch('/api/rentals/mock/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: userId,
            videoId: videoId,
            rentalDurationHours: 24
        })
    });
    
    const result = await response.json();
    if (result.ok) {
        player.play(); // Resume playback
    }
}

// Revoke access for testing
async function revokeMockAccess(userId, videoId) {
    const response = await fetch('/api/rentals/mock/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, videoId })
    });
    
    const result = await response.json();
    return result.ok;
}
```

### URL Parameters for Testing

```javascript
// Enhanced player supports URL parameters for easy testing
// http://localhost:3000/apps/demo/enhanced-player.html?bypass=1&debug=1

const urlParams = new URLSearchParams(window.location.search);
const bypassPaywall = urlParams.get('bypass') === '1';
const debugMode = urlParams.get('debug') === '1';

if (bypassPaywall) {
    // Skip paywall for testing
    player.load(videoUrl, { paywall: { enabled: false } });
}

if (debugMode) {
    // Enable detailed logging
    player.on('*', (event, data) => console.log(`[Debug] ${event}:`, data));
}
```

### Admin Override Methods

```javascript
// Admin panel integration for content management
class VideoAdmin {
    constructor(apiBase, adminToken) {
        this.apiBase = apiBase;
        this.adminToken = adminToken;
    }
    
    async grantAccess(userId, videoId, durationHours = 48) {
        const response = await fetch(`${this.apiBase}/api/admin/grant-access`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.adminToken}`
            },
            body: JSON.stringify({
                userId,
                videoId,
                durationHours,
                reason: 'admin_override'
            })
        });
        
        return response.json();
    }
    
    async revokeAccess(userId, videoId) {
        const response = await fetch(`${this.apiBase}/api/admin/revoke-access`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.adminToken}`
            },
            body: JSON.stringify({ userId, videoId })
        });
        
        return response.json();
    }
    
    async getAccessStatus(userId, videoId) {
        const response = await fetch(
            `${this.apiBase}/api/admin/access-status?userId=${userId}&videoId=${videoId}`,
            {
                headers: { 'Authorization': `Bearer ${this.adminToken}` }
            }
        );
        
        return response.json();
    }
}

// Usage
const admin = new VideoAdmin('http://localhost:3100', 'admin-token-123');

// Grant 7-day access
await admin.grantAccess('user123', 'video456', 168); // 7 days = 168 hours
```

## 🛠️ Backend API Setup

### Quick Setup

1. **Clone and Install**
```bash
cd "C:\Users\Webnexs\Documents\OfficeBackup\AI\VideoPlayer FrameWork\unified-video-framework"
npm install
npm run build
```

2. **Setup Database** (PostgreSQL recommended)
```bash
# Install PostgreSQL and create database
createdb uvf

# Run migrations
cd apps/rental-api
node scripts/run-migration.js
```

3. **Configure Environment**
```bash
cd apps/rental-api
cp .env.example .env
# Edit .env with your credentials
```

4. **Start API Server**
```bash
# Development
npm run dev:rental-api

# Production
npm run build:rental-api
npm run start:rental-api
```

### API Endpoints Reference

#### Entitlement Check
```http
GET /api/rentals/entitlement?userId=USER_ID&videoId=VIDEO_ID

Response:
{
  "entitled": true,
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

#### Stripe Checkout Session
```http
POST /api/rentals/stripe/checkout-session
Content-Type: application/json

{
  "userId": "user123",
  "videoId": "video456",
  "successUrl": "http://localhost:3000/success",
  "cancelUrl": "http://localhost:3000/cancel"
}

Response:
{
  "url": "https://checkout.stripe.com/pay/cs_live_...",
  "id": "cs_live_..."
}
```

#### Cashfree Order Creation
```http
POST /api/rentals/cashfree/order
Content-Type: application/json

{
  "userId": "user123",
  "videoId": "video456",
  "returnUrl": "http://localhost:3000/success"
}

Response:
{
  "paymentLink": "https://payments.cashfree.com/order/...",
  "orderId": "order_..."
}
```

#### Mock Endpoints (Development Only)
```http
# Grant mock access
POST /api/rentals/mock/grant
{
  "userId": "user123",
  "videoId": "video456",
  "rentalDurationHours": 24
}

# Revoke mock access
POST /api/rentals/mock/revoke
{
  "userId": "user123",
  "videoId": "video456"
}

# Get paywall config
GET /api/rentals/config?tenant=demo&userId=user123&videoId=video456
```

## 📚 Complete Examples

### React Integration

```jsx
import React, { useEffect, useRef, useState } from 'react';

const VideoPlayer = ({ videoUrl, userId, videoId, freeDuration = 120 }) => {
    const playerRef = useRef(null);
    const [player, setPlayer] = useState(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [entitled, setEntitled] = useState(false);
    
    useEffect(() => {
        // Initialize player
        const playerInstance = new UnifiedVideoPlayer(playerRef.current);
        setPlayer(playerInstance);
        
        // Setup event listeners
        playerInstance.on('paywall:show', () => setShowPaywall(true));
        playerInstance.on('paywall:payment:success', () => {
            setShowPaywall(false);
            setEntitled(true);
        });
        
        // Load video
        playerInstance.load(videoUrl, {
            freeDuration: entitled ? 0 : freeDuration,
            paywall: {
                enabled: !entitled,
                apiBase: process.env.REACT_APP_API_BASE,
                userId,
                videoId,
                gateways: ['stripe', 'cashfree']
            }
        });
        
        return () => {
            playerInstance.cleanup && playerInstance.cleanup();
        };
    }, [videoUrl, userId, videoId, freeDuration, entitled]);
    
    const handlePayment = async (gateway) => {
        try {
            if (gateway === 'stripe') {
                await initiateStripePayment(userId, videoId);
            } else if (gateway === 'cashfree') {
                await initiateCashfreePayment(userId, videoId);
            }
            
            // Check if payment was successful
            const isEntitled = await checkPaymentStatus(userId, videoId);
            if (isEntitled) {
                setEntitled(true);
                setShowPaywall(false);
                player.play();
            }
        } catch (error) {
            console.error('Payment failed:', error);
        }
    };
    
    return (
        <div className="video-player-container">
            <div ref={playerRef} style={{ width: '100%', aspectRatio: '16/9' }} />
            
            {showPaywall && (
                <div className="paywall-overlay">
                    <div className="paywall-modal">
                        <h2>Continue Watching</h2>
                        <p>Rent this video to continue watching.</p>
                        <div className="payment-options">
                            <button onClick={() => handlePayment('stripe')}>Pay with Stripe</button>
                            <button onClick={() => handlePayment('cashfree')}>Pay with Cashfree</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoPlayer;
```

### Vue.js Integration

```vue
<template>
  <div class="video-player">
    <div ref="playerContainer" class="player-container"></div>
    
    <div v-if="showPaywall" class="paywall-overlay">
      <div class="paywall-modal">
        <h2>{{ paywallConfig.title }}</h2>
        <p>{{ paywallConfig.description }}</p>
        
        <div class="payment-methods">
          <button 
            v-for="gateway in paywallConfig.gateways" 
            :key="gateway"
            @click="processPayment(gateway)"
            class="payment-btn"
          >
            Pay with {{ gateway }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'VideoPlayer',
  props: {
    videoUrl: String,
    userId: String,
    videoId: String,
    freeDuration: { type: Number, default: 120 }
  },
  
  data() {
    return {
      player: null,
      showPaywall: false,
      entitled: false,
      paywallConfig: {
        title: 'Continue Watching',
        description: 'Rent this video to continue.',
        gateways: ['stripe', 'cashfree']
      }
    };
  },
  
  async mounted() {
    // Check existing entitlement
    const entitlementStatus = await this.checkEntitlement();
    this.entitled = entitlementStatus.entitled;
    
    // Initialize player
    this.player = new UnifiedVideoPlayer(this.$refs.playerContainer);
    
    this.player.on('paywall:show', () => {
      this.showPaywall = true;
    });
    
    this.player.on('paywall:payment:success', () => {
      this.showPaywall = false;
      this.entitled = true;
    });
    
    // Load video
    await this.player.load(this.videoUrl, {
      freeDuration: this.entitled ? 0 : this.freeDuration,
      paywall: {
        enabled: !this.entitled,
        apiBase: process.env.VUE_APP_API_BASE || 'http://localhost:3100',
        userId: this.userId,
        videoId: this.videoId,
        gateways: this.paywallConfig.gateways
      }
    });
  },
  
  methods: {
    async checkEntitlement() {
      const response = await fetch(
        `/api/rentals/entitlement?userId=${this.userId}&videoId=${this.videoId}`
      );
      return response.json();
    },
    
    async processPayment(gateway) {
      try {
        if (gateway === 'stripe') {
          await this.processStripePayment();
        } else if (gateway === 'cashfree') {
          await this.processCashfreePayment();
        }
      } catch (error) {
        console.error('Payment processing failed:', error);
      }
    },
    
    async processStripePayment() {
      // Stripe payment logic
      const response = await fetch('/api/rentals/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          videoId: this.videoId,
          successUrl: `${window.location.origin}${window.location.pathname}?payment=success`,
          cancelUrl: `${window.location.origin}${window.location.pathname}?payment=cancel`
        })
      });
      
      const { url } = await response.json();
      window.open(url, 'stripe-checkout', 'width=800,height=600');
    },
    
    async processCashfreePayment() {
      // Cashfree payment logic
      const response = await fetch('/api/rentals/cashfree/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          videoId: this.videoId,
          returnUrl: `${window.location.origin}${window.location.pathname}?payment=success`
        })
      });
      
      const { paymentLink } = await response.json();
      window.open(paymentLink, 'cashfree-checkout', 'width=800,height=600');
    }
  },
  
  beforeUnmount() {
    if (this.player) {
      this.player.cleanup && this.player.cleanup();
    }
  }
};
</script>

<style scoped>
.video-player {
  position: relative;
  width: 100%;
}

.player-container {
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
}

.paywall-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.paywall-modal {
  background: #1a1a1a;
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
  max-width: 400px;
  color: white;
}

.payment-methods {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  justify-content: center;
}

.payment-btn {
  background: #ff4d4f;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.payment-btn:hover {
  background: #ff6b6d;
}
</style>
```

## 🔧 Advanced Configuration

### Multi-Tenant Setup

```javascript
// Multi-tenant configuration
class TenantVideoPlayer {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.config = null;
    }
    
    async loadTenantConfig() {
        const response = await fetch(`/api/tenants/${this.tenantId}/video-config`);
        this.config = await response.json();
        return this.config;
    }
    
    async createPlayer(container, videoId, userId) {
        await this.loadTenantConfig();
        
        const player = new UnifiedVideoPlayer(container);
        
        const paywallConfig = {
            enabled: this.config.paywall.enabled,
            apiBase: this.config.paywall.apiBase,
            userId: userId,
            videoId: videoId,
            gateways: this.config.paywall.gateways,
            branding: {
                title: this.config.branding.paywallTitle,
                description: this.config.branding.paywallDescription,
                theme: this.config.branding.theme,
                logo: this.config.branding.logo
            }
        };
        
        return { player, config: paywallConfig };
    }
}

// Usage
const tenantPlayer = new TenantVideoPlayer('acme-corp');
const { player, config } = await tenantPlayer.createPlayer(
    document.getElementById('player'),
    'video123',
    'user456'
);

player.load('video.m3u8', {
    freeDuration: config.freeDuration,
    paywall: config
});
```

### Custom Analytics Integration

```javascript
// Analytics integration
class VideoAnalytics {
    constructor(analyticsProviders = []) {
        this.providers = analyticsProviders;
    }
    
    track(event, properties = {}) {
        this.providers.forEach(provider => {
            try {
                provider.track(event, properties);
            } catch (error) {
                console.warn('Analytics tracking failed:', error);
            }
        });
    }
    
    setupPlayerTracking(player, videoId, userId) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        player.on('play', () => {
            this.track('video_play', {
                sessionId,
                videoId,
                userId,
                timestamp: Date.now(),
                currentTime: player.getCurrentTime()
            });
        });
        
        player.on('pause', () => {
            this.track('video_pause', {
                sessionId,
                videoId,
                userId,
                currentTime: player.getCurrentTime(),
                duration: player.getDuration()
            });
        });
        
        player.on('paywall:show', () => {
            this.track('paywall_shown', {
                sessionId,
                videoId,
                userId,
                triggerTime: player.getCurrentTime()
            });
        });
        
        player.on('paywall:payment:success', (data) => {
            this.track('payment_completed', {
                sessionId,
                videoId,
                userId,
                gateway: data.gateway,
                amount: data.amount,
                currency: data.currency
            });
        });
        
        // Track progress milestones
        const milestones = [0.25, 0.5, 0.75, 0.95];
        let trackedMilestones = new Set();
        
        player.on('timeupdate', () => {
            const progress = player.getCurrentTime() / player.getDuration();
            
            milestones.forEach(milestone => {
                if (progress >= milestone && !trackedMilestones.has(milestone)) {
                    trackedMilestones.add(milestone);
                    this.track('video_progress', {
                        sessionId,
                        videoId,
                        userId,
                        progress: Math.round(milestone * 100),
                        currentTime: player.getCurrentTime()
                    });
                }
            });
        });
    }
}

// Google Analytics provider
class GoogleAnalyticsProvider {
    constructor(trackingId) {
        this.trackingId = trackingId;
    }
    
    track(event, properties) {
        if (typeof gtag !== 'undefined') {
            gtag('event', event, properties);
        }
    }
}

// Usage
const analytics = new VideoAnalytics([
    new GoogleAnalyticsProvider('GA-TRACKING-ID'),
    // Add other providers as needed
]);

analyticssetupPlayerTracking(player, 'video123', 'user456');
```

### Performance Optimization

```javascript
// Performance optimized player setup
class OptimizedVideoPlayer extends UnifiedVideoPlayer {
    constructor(container, options = {}) {
        super(container);
        
        this.performanceConfig = {
            lazyLoadLibraries: options.lazyLoadLibraries ?? true,
            preloadMetadata: options.preloadMetadata ?? true,
            adaptiveBitrate: options.adaptiveBitrate ?? true,
            bufferAhead: options.bufferAhead ?? 30, // seconds
            maxBufferLength: options.maxBufferLength ?? 120, // seconds
            ...options.performance
        };
    }
    
    async load(url, options = {}) {
        // Preload metadata to get duration quickly
        if (this.performanceConfig.preloadMetadata) {
            this.video.preload = 'metadata';
        }
        
        // Configure adaptive bitrate settings
        if (this.performanceConfig.adaptiveBitrate && options.type === 'hls') {
            options.hlsConfig = {
                ...options.hlsConfig,
                maxBufferLength: this.performanceConfig.maxBufferLength,
                maxBufferSize: 60 * 1000 * 1000, // 60MB
                startLevel: -1, // Auto start level
                abrEwmaFastLive: 3.0,
                abrEwmaSlowLive: 9.0
            };
        }
        
        return super.load(url, options);
    }
    
    // Implement bandwidth-aware quality selection
    optimizeForBandwidth(bandwidthKbps) {
        const qualities = this.getQualities();
        
        // Select appropriate quality based on bandwidth
        let selectedQuality = qualities[0]; // Default to lowest
        
        for (const quality of qualities) {
            if (quality.bitrate <= bandwidthKbps * 0.8) { // 80% of bandwidth
                selectedQuality = quality;
            } else {
                break;
            }
        }
        
        this.setQuality(selectedQuality.id);
    }
    
    // Network monitoring for adaptive quality
    startNetworkMonitoring() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            
            const updateBandwidth = () => {
                const effectiveType = connection.effectiveType;
                let estimatedBandwidth = 1000; // Default 1Mbps
                
                switch (effectiveType) {
                    case 'slow-2g': estimatedBandwidth = 100; break;
                    case '2g': estimatedBandwidth = 300; break;
                    case '3g': estimatedBandwidth = 1000; break;
                    case '4g': estimatedBandwidth = 5000; break;
                }
                
                this.optimizeForBandwidth(estimatedBandwidth);
            };
            
            connection.addEventListener('change', updateBandwidth);
            updateBandwidth();
        }
    }
}

// Usage
const optimizedPlayer = new OptimizedVideoPlayer(container, {
    performance: {
        bufferAhead: 45,
        maxBufferLength: 180,
        adaptiveBitrate: true
    }
});

optimizedPlayer.startNetworkMonitoring();
```

---

## 📚 Additional Resources

- **Paywall Flow Documentation**: [../PAYWALL_RENTAL_FLOW.md](../PAYWALL_RENTAL_FLOW.md)
- **System Architecture**: [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)
- **Platform Setup Guide**: [../PLATFORM_SETUP_GUIDE.md](../PLATFORM_SETUP_GUIDE.md)
- **Local Development Guide**: [../RUN_LOCALLY.md](../RUN_LOCALLY.md)

## 🛟 Support & Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure you're running a local web server (not file:// protocol)
2. **Paywall Not Showing**: Check API endpoints and network requests in browser DevTools
3. **Payment Failed**: Verify Stripe/Cashfree credentials and webhook configurations
4. **Video Not Playing**: Check browser console for errors and ensure proper video format support

### Getting Help

- **GitHub Issues**: [Create an issue](https://github.com/flicknexs/unified-video-framework/issues)
- **Email Support**: support@flicknexs.com
- **Documentation**: Check README files in each package directory

---

**Built with ❤️ by the flicknexs team**

