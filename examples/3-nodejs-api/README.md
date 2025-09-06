# Node.js API Example

This example demonstrates how to build a backend API for the Unified Video Framework, including player session management, analytics tracking, and payment processing.

## 🚀 Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

3. Server will run on http://localhost:3001

4. In another terminal, test the API client:
   ```bash
   node client.js
   ```

## 📋 Features Demonstrated

### API Endpoints

#### Video Management
- `GET /api/videos` - Get video catalog
- `GET /api/videos/:videoId` - Get specific video details

#### Session Management
- `POST /api/sessions` - Create player session
- `POST /api/sessions/:sessionId/events` - Track player events
- `GET /api/sessions/:sessionId/analytics` - Get session analytics

#### Rental/Paywall
- `GET /api/rentals/config` - Get paywall configuration
- `POST /api/rentals/process` - Process rental payment
- `GET /api/rentals/check` - Check rental status

#### Analytics
- `GET /api/analytics` - Get overall analytics
- `GET /health` - Health check endpoint

## 🛠️ Code Structure

```
├── server.js       # Express API server
├── client.js       # Example API client
├── package.json    # Dependencies
└── README.md       # This file
```

## 📝 Implementation Details

### Player Session Management

Sessions track individual video playback instances:

```javascript
{
  id: 'uuid',
  userId: 'user-123',
  videoId: 'video-456',
  platform: 'web',
  createdAt: Date,
  events: [],
  player: {
    type: 'web',
    status: 'initialized',
    options: {}
  }
}
```

### Event Tracking

Track player events for analytics:

```javascript
POST /api/sessions/:sessionId/events
{
  "event": "play",
  "data": {
    "currentTime": 30.5,
    "quality": "720p"
  }
}
```

Supported events:
- `load` - Video loaded
- `play` - Playback started
- `pause` - Playback paused
- `timeupdate` - Progress update
- `ended` - Video completed
- `error` - Error occurred

### Paywall Integration

Dynamic paywall configuration based on:
- User rental status
- Video pricing
- Free preview duration

```javascript
GET /api/rentals/config?userId=123&videoId=456

Response:
{
  "enabled": true,
  "apiBase": "http://localhost:3001/api",
  "pricing": {
    "amount": 4.99,
    "currency": "USD",
    "rentalDurationHours": 48
  },
  "gateways": ["stripe", "cashfree"]
}
```

### Analytics Collection

Real-time analytics tracking:
- View count
- Watch time
- Event timeline
- Session duration

## 🔧 Using the API Client

The included `client.js` demonstrates all API interactions:

```javascript
const VideoAPIClient = require('./client');

const client = new VideoAPIClient('user-123');

// Get videos
const videos = await client.getVideos();

// Create session
const session = await client.createSession('video1');

// Track events
await client.trackEvent('play', {});
await client.trackEvent('timeupdate', { currentTime: 30 });

// Get analytics
const analytics = await client.getSessionAnalytics();
```

## 🚀 Production Considerations

### Database Integration
Replace in-memory storage with a real database:
- PostgreSQL/MySQL for relational data
- Redis for session storage
- MongoDB for analytics data

### Authentication
Add proper authentication:
```javascript
app.use(authMiddleware);

function authMiddleware(req, res, next) {
  const token = req.headers.authorization;
  // Verify JWT token
  // Set req.userId
  next();
}
```

### Payment Processing
Integrate real payment gateways:
- Stripe: Use Stripe SDK
- Cashfree: Use Cashfree SDK
- Validate payments server-side
- Store transaction records

### Scaling
- Use Redis for session storage
- Implement rate limiting
- Add caching layer
- Use message queues for analytics

### Security
- Validate all inputs
- Use HTTPS in production
- Implement CORS properly
- Add rate limiting
- Secure payment endpoints

## 📊 Analytics Dashboard

Access the analytics dashboard at:
http://localhost:3001/api/analytics

Example response:
```json
{
  "videos": [
    {
      "videoId": "video1",
      "title": "Big Buck Bunny",
      "views": 42,
      "totalWatchTime": 12360
    }
  ],
  "totalSessions": 156,
  "totalRentals": 23
}
```

## 🔗 Integration Examples

### With React App
```javascript
// In React component
const response = await fetch('/api/rentals/config?userId=123&videoId=456');
const paywallConfig = await response.json();

<WebPlayerView
  paywallConfigUrl="/api/rentals/config?videoId=456"
  // or
  paywall={paywallConfig.data}
/>
```

### Webhook Integration
```javascript
// Payment webhook endpoint
app.post('/webhooks/stripe', (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    webhookSecret
  );
  
  if (event.type === 'payment_intent.succeeded') {
    // Grant video access
  }
});
```

## 📚 Next Steps

- Add real database integration
- Implement user authentication
- Add payment gateway webhooks
- Create admin dashboard
- Add video upload endpoints
- Implement DRM token generation
