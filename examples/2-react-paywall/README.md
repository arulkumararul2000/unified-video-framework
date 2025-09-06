# React Paywall Example

This example demonstrates how to integrate the Unified Video Framework's WebPlayerView component in a React application with paywall functionality.

## 🚀 Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## 📋 Features Demonstrated

### Video Catalog
- Grid layout of available videos
- Mix of free and premium content
- Visual indicators for pricing and purchase status

### Paywall Integration
- **Free Preview**: Premium videos offer 2-3 minutes of free viewing
- **Payment Gateway**: Integration with Stripe and Cashfree
- **Purchase Tracking**: Local storage of purchased videos
- **User States**: Different experiences for free vs. subscribed users

### Player Features
- **WebPlayerView Component**: Full React integration
- **Adaptive Streaming**: HLS support with quality selection
- **Custom Theming**: Player matches app design
- **Rich Metadata**: Video information display
- **Event Handling**: Player state management

## 🛠️ Code Structure

```
src/
├── App.js          # Main application component
├── App.css         # Application styles
├── index.js        # React entry point
└── index.css       # Global styles
```

## 💳 Testing Payments

The paywall uses test mode by default. Use these test credentials:

### Stripe Test Card
- Number: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

### Cashfree Test Mode
- Follow the on-screen instructions when selecting Cashfree

## 📝 Implementation Details

### Paywall Configuration

```javascript
const paywallConfig = {
  enabled: true,
  apiBase: '/api',
  userId: 'user-123',
  videoId: 'video-456',
  gateways: ['stripe', 'cashfree'],
  pricing: {
    amount: 4.99,
    currency: 'USD',
    rentalDurationHours: 48
  },
  branding: {
    title: 'Unlock Full Video',
    description: 'Get 48-hour access',
    theme: {
      primaryColor: '#007bff',
      backgroundColor: '#1a1a1a'
    }
  },
  onSuccess: (transactionId) => {
    // Handle successful payment
  }
};
```

### Using WebPlayerView

```jsx
import { WebPlayerView } from 'unified-video-framework/web';

<WebPlayerView
  url="https://example.com/video.m3u8"
  type="hls"
  autoPlay={false}
  muted={false}
  freeDuration={120} // 2 minutes free
  paywall={paywallConfig}
  metadata={videoMetadata}
  playerTheme="#007bff"
  onReady={handlePlayerReady}
  onError={handlePlayerError}
/>
```

## 🎯 Key Concepts

### 1. Video States
- **Free Videos**: No paywall, full access
- **Premium Videos**: Paywall after free preview
- **Purchased Videos**: Full access for rental period

### 2. User Types
- **Free Users**: Can watch free content and previews
- **Subscribers**: Full access to all content
- **Renters**: Access to specific purchased videos

### 3. Purchase Flow
1. User watches free preview
2. Paywall appears at preview end
3. User selects payment method
4. Payment processed
5. Video unlocked for rental period

## 🔧 Customization

### Theming
Modify the `playerTheme` prop to match your brand:
```jsx
playerTheme={{
  accent: '#ff0000',
  accent2: '#cc0000',
  iconColor: '#ffffff',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.7)'
}}
```

### Paywall Branding
Customize the paywall appearance in the config:
```javascript
branding: {
  title: 'Your Custom Title',
  description: 'Your custom description',
  logoUrl: '/your-logo.png',
  theme: {
    primaryColor: '#yourColor',
    backgroundColor: '#yourBgColor'
  }
}
```

## 🚀 Production Considerations

1. **API Integration**: Replace mock API with real endpoints
2. **Payment Processing**: Implement server-side payment validation
3. **User Authentication**: Add proper user management
4. **Content Protection**: Implement DRM for premium content
5. **Analytics**: Track user engagement and conversions

## 📚 Next Steps

- Explore the [Advanced Features example](../4-advanced-features/) for subtitles and analytics
- Read about [server-side integration](../3-nodejs-api/) for payment processing
- Check the [full API documentation](../../docs/README.md)
