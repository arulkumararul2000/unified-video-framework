import React, { useState } from 'react';
import { WebPlayerView } from '../WebPlayerView';

/**
 * Example: Google Ads Integration with WebPlayerView
 * 
 * This example demonstrates how to integrate Google IMA ads
 * (pre-roll, mid-roll, post-roll, and companion ads) with the video player.
 * 
 * NEW: Automatic ad markers are now displayed on the seekbar!
 * - Ad break positions from midrollTimes are automatically visualized
 * - Yellow markers appear on the progress bar at ad break times
 * - No manual chapter configuration needed
 */

export const GoogleAdsExample: React.FC = () => {
  const [adEvents, setAdEvents] = useState<string[]>([]);

  const logAdEvent = (event: string) => {
    console.log(`[Ad Event] ${event}`);
    setAdEvents(prev => [...prev, `${new Date().toLocaleTimeString()}: ${event}`]);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <WebPlayerView
          // Video source
          url="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
          type="mp4"
          
          // Basic player config
          autoPlay={false}
          controls={true}
          
          // Google Ads Configuration
          googleAds={{
            // VAST/VMAP ad tag URL from your ad server
            // This example uses Google's IMA test tag
            adTagUrl: 'https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&cust_params=sample_ct%3Dlinear&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=',
            
            // Optional: Specific mid-roll times (in seconds)
            // These times will automatically appear as markers on the seekbar!
            // If not provided, VMAP schedule from ad server is used
            midrollTimes: [30, 60, 120],
            
            // Optional: Companion ads (sidebar/banner ads)
            companionAdSlots: [
              {
                containerId: 'companion-ad-300x250',
                width: 300,
                height: 250,
              },
              {
                containerId: 'companion-ad-728x90',
                width: 728,
                height: 90,
              },
            ],
            
            // Ad event callbacks
            onAdStart: () => {
              logAdEvent('Ad Started');
            },
            
            onAdEnd: () => {
              logAdEvent('Ad Ended - Resuming Content');
            },
            
            onAdError: (error: any) => {
              logAdEvent(`Ad Error: ${error?.getMessage?.() || error}`);
            },
            
            onAllAdsComplete: () => {
              logAdEvent('All Ads Completed');
            },
          }}
          
          // Chapter configuration for ad marker customization
          chapters={{
            enabled: true,
            showChapterMarkers: true,
            customStyles: {
              progressMarkers: {
                ad: '#FFD700', // Gold/yellow color for ad markers
              },
            },
          }}
          
          // Video metadata
          metadata={{
            title: 'Big Buck Bunny with Google Ads',
            description: 'Demo video with pre-roll, mid-roll, and post-roll ads',
          }}
          
          // Player callbacks
          onReady={(player) => {
            console.log('Player ready with Google Ads integration');
          }}
          
          onError={(error) => {
            console.error('Player error:', error);
          }}
        />
      </div>
      
      {/* Companion Ad Slots */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '20px', 
        padding: '20px',
        backgroundColor: '#f5f5f5',
      }}>
        {/* 300x250 Companion Ad */}
        <div 
          id="companion-ad-300x250"
          style={{
            width: '300px',
            height: '250px',
            border: '1px solid #ddd',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}
        >
          300x250 Companion Ad
        </div>
        
        {/* 728x90 Companion Ad */}
        <div 
          id="companion-ad-728x90"
          style={{
            width: '728px',
            height: '90px',
            border: '1px solid #ddd',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
          }}
        >
          728x90 Companion Ad
        </div>
      </div>
      
      {/* Ad Event Log */}
      <div style={{ 
        padding: '20px',
        backgroundColor: '#f9f9f9',
        borderTop: '1px solid #ddd',
        maxHeight: '200px',
        overflowY: 'auto',
      }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Ad Events Log:</h3>
        {adEvents.length === 0 ? (
          <p style={{ color: '#999', margin: 0 }}>No ad events yet. Play the video to see ads.</p>
        ) : (
          <ul style={{ margin: 0, padding: '0 0 0 20px' }}>
            {adEvents.map((event, index) => (
              <li key={index} style={{ fontSize: '14px', marginBottom: '5px' }}>
                {event}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

/**
 * Usage Notes:
 * 
 * 1. Ad Tag URL:
 *    - Use VAST or VMAP ad tag from your ad server (e.g., Google Ad Manager, SpotX)
 *    - The example uses Google's IMA test tag for demonstration
 *    - VAST: Single ad unit
 *    - VMAP: Ad schedule with pre/mid/post-rolls
 * 
 * 2. Ad Types Supported:
 *    - Pre-roll: Plays before video content
 *    - Mid-roll: Plays during video at specified times
 *    - Post-roll: Plays after video ends
 *    - Overlay ads: Non-linear ads on video
 *    - Companion ads: Banner/sidebar ads
 *    - Skippable & non-skippable ads
 * 
 * 3. Mid-roll Configuration:
 *    - Specify times in seconds: [30, 60, 120]
 *    - Markers automatically appear on seekbar at these times
 *    - Or use VMAP schedule from ad server
 *    - Customize marker color via chapters.customStyles.progressMarkers.ad
 * 
 * 4. Companion Ads:
 *    - Create HTML containers with specific IDs
 *    - Specify dimensions in config
 *    - Ads will be automatically inserted
 * 
 * 5. Ad Events:
 *    - onAdStart: When ad begins playing
 *    - onAdEnd: When ad completes
 *    - onAdError: When ad fails to load/play
 *    - onAllAdsComplete: When all ads in pod complete
 * 
 * 6. Testing:
 *    - Use Google's test tags: https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/tags
 *    - Test different ad formats and scenarios
 *    - Handle errors gracefully (network, ad blocker, etc.)
 */

export default GoogleAdsExample;
