/**
 * Comprehensive WebPlayerView Example
 * Demonstrates all available API features with full feature parity to WebPlayer
 */

import React, { useRef, useState, useEffect } from 'react';
import { 
  WebPlayerView, 
  ChapterAPI, 
  QualityAPI, 
  EPGControlAPI, 
  UIHelperAPI, 
  FullscreenAPI, 
  PlaybackAPI,
  type WebPlayer
} from 'unified-video-framework/web';

export const ComprehensivePlayerExample = () => {
  // Player ref for direct access if needed
  const playerRef = useRef<WebPlayer>(null);
  
  // API refs - get access to all imperative APIs
  const [chapterAPI, setChapterAPI] = useState<ChapterAPI | null>(null);
  const [qualityAPI, setQualityAPI] = useState<QualityAPI | null>(null);
  const [epgAPI, setEPGAPI] = useState<EPGControlAPI | null>(null);
  const [uiAPI, setUIHelperAPI] = useState<UIHelperAPI | null>(null);
  const [fullscreenAPI, setFullscreenAPI] = useState<FullscreenAPI | null>(null);
  const [playbackAPI, setPlaybackAPI] = useState<PlaybackAPI | null>(null);
  
  // State management
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [selectedQuality, setSelectedQuality] = useState<any>(null);
  const [qualities, setQualities] = useState<any[]>([]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <WebPlayerView
        // ============ Basic Configuration ============
        url="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"
        type="hls"
        autoPlay={false}
        muted={false}
        volume={0.8}
        controls={true}
        loop={false}
        debug={true}
        
        // ============ Custom Controls Configuration ============
        customControls={true}
        settings={{
          enabled: true,
          speed: true,
          quality: true,
          subtitles: true,
        }}
        
        // ============ Settings Scrollbar Customization ============
        settingsScrollbar={{
          style: 'compact',    // 'default' | 'compact' | 'overlay'
          widthPx: 8,         // Custom scrollbar width
          intensity: 0.7,     // Opacity/intensity (0-1)
        }}
        
        // ============ UI Helper Options ============
        autoFocusPlayer={true}
        showFullscreenTipOnMount={true}
        
        // ============ Watermark Configuration ============
        watermark={{
          enabled: true,
          text: 'PREMIUM',
          showTime: true,
          updateInterval: 5000,
          randomPosition: true,
          style: {
            fontSize: 16,
            opacity: 0.4,
            color: '#ff0000',
          },
        }}
        
        // ============ Framework Branding ============
        showFrameworkBranding={true}
        
        // ============ Navigation Buttons ============
        navigation={{
          backButton: {
            enabled: true,
            icon: 'arrow',
            title: 'Back to Home',
            onClick: () => console.log('Back clicked'),
          },
          closeButton: {
            enabled: true,
            icon: 'x',
            title: 'Close Player',
            exitFullscreen: true,
            onClick: () => console.log('Close clicked'),
          },
        }}
        
        // ============ Paywall & Free Preview ============
        freeDuration={120}  // 2 minutes free
        paywall={{
          enabled: true,
          apiBase: 'http://localhost:3100',
          userId: 'user123',
          videoId: 'video456',
          gateways: ['stripe', 'cashfree'],
          pricing: {
            amount: 4.99,
            currency: 'USD',
            title: 'Rent for 48 hours',
          },
          branding: {
            title: 'Continue Watching',
            description: 'Rent this video to unlock full access',
            brandColor: '#ff4d4f',
          },
        }}
        
        // ============ Email Authentication ============
        emailAuth={{
          enabled: true,
          skipIfAuthenticated: true,
          apiEndpoints: {
            requestOtp: '/auth/request-otp',
            verifyOtp: '/auth/verify-otp',
          },
          ui: {
            title: 'Sign in to continue',
            description: 'Enter your email to receive a verification code',
          },
          validation: {
            otpLength: 6,
            otpTimeout: 300,
          },
        }}
        
        // ============ Chapter & Skip Configuration ============
        chapters={{
          enabled: true,
          data: {
            videoId: 'video123',
            duration: 3600,
            segments: [
              {
                id: 'intro',
                type: 'intro',
                startTime: 0,
                endTime: 30,
                title: 'Opening Credits',
                skipLabel: 'Skip Intro',
                autoSkip: false,
              },
              {
                id: 'recap',
                type: 'recap',
                startTime: 30,
                endTime: 90,
                title: 'Previously On',
                skipLabel: 'Skip Recap',
              },
              {
                id: 'credits',
                type: 'credits',
                startTime: 3300,
                endTime: 3600,
                title: 'End Credits',
                skipLabel: 'Skip Credits',
              },
            ],
          },
          autoHide: true,
          autoHideDelay: 5000,
          showChapterMarkers: true,
          skipButtonPosition: 'bottom-right',
          userPreferences: {
            autoSkipIntro: false,
            autoSkipRecap: false,
            autoSkipCredits: false,
            showSkipButtons: true,
            rememberChoices: true,
          },
        }}
        
        // ============ EPG (Electronic Program Guide) ============
        epg={{
          channels: [
            {
              id: 'ch1',
              name: 'Channel One',
              logo: '/logos/ch1.png',
              programs: [
                {
                  id: 'prog1',
                  title: 'News Today',
                  startTime: new Date('2025-01-28T12:00:00Z'),
                  endTime: new Date('2025-01-28T13:00:00Z'),
                  description: 'Daily news coverage',
                },
              ],
            },
          ],
        }}
        epgConfig={{
          timeSlotWidth: 120,
          showTimeline: true,
          enableKeyboardNav: true,
        }}
        showEPG={false}
        
        // ============ Theming ============
        playerTheme={{
          accent: '#ff4d4f',
          accent2: '#ff7875',
          iconColor: '#ffffff',
          textPrimary: '#ffffff',
          textSecondary: 'rgba(255, 255, 255, 0.7)',
        }}
        
        // ============ Responsive Configuration ============
        responsive={{
          enabled: true,
          aspectRatio: 16 / 9,
          maxWidth: '100vw',
          maxHeight: '100vh',
          breakpoints: {
            mobile: 768,
            tablet: 1024,
          },
        }}
        
        // ============ Cast Support ============
        cast={true}
        
        // ============ Player Ref (Optional) ============
        playerRef={playerRef}
        
        // ============ API Callbacks - Get Imperative Control ============
        onChapterAPI={(api) => {
          setChapterAPI(api);
          console.log('Chapter API available:', api);
        }}
        
        onQualityAPI={(api) => {
          setQualityAPI(api);
          console.log('Quality API available:', api);
          // Get available qualities
          const quals = api.getQualities();
          setQualities(quals);
        }}
        
        onEPGAPI={(api) => {
          setEPGAPI(api);
          console.log('EPG API available:', api);
        }}
        
        onUIHelperAPI={(api) => {
          setUIHelperAPI(api);
          console.log('UI Helper API available:', api);
        }}
        
        onFullscreenAPI={(api) => {
          setFullscreenAPI(api);
          console.log('Fullscreen API available:', api);
        }}
        
        onPlaybackAPI={(api) => {
          setPlaybackAPI(api);
          console.log('Playback API available:', api);
        }}
        
        // ============ Player Event Callbacks ============
        onReady={(player) => {
          console.log('Player ready!', player);
        }}
        
        onPlay={() => {
          console.log('Playing');
          setIsPlaying(true);
        }}
        
        onPause={() => {
          console.log('Paused');
          setIsPlaying(false);
        }}
        
        onEnded={() => {
          console.log('Video ended');
          setIsPlaying(false);
        }}
        
        onTimeUpdate={({ currentTime, duration }) => {
          setCurrentTime(currentTime);
          setDuration(duration);
        }}
        
        onProgress={({ buffered }) => {
          console.log('Buffered:', buffered + '%');
        }}
        
        onVolumeChange={({ volume, muted }) => {
          console.log('Volume changed:', volume, 'Muted:', muted);
          setVolume(Math.round(volume * 100));
        }}
        
        onQualityChange={(quality) => {
          console.log('Quality changed:', quality);
          setSelectedQuality(quality);
        }}
        
        onBuffering={(isBuffering) => {
          console.log('Buffering:', isBuffering);
        }}
        
        onFullscreenChange={(isFullscreen) => {
          console.log('Fullscreen:', isFullscreen);
        }}
        
        onError={(error) => {
          console.error('Player error:', error);
        }}
        
        // ============ Chapter Event Callbacks ============
        onChapterChange={(chapter) => {
          console.log('Chapter changed:', chapter);
        }}
        
        onSegmentEntered={(segment) => {
          console.log('Segment entered:', segment);
        }}
        
        onSegmentSkipped={(segment) => {
          console.log('Segment skipped:', segment);
        }}
        
        // ============ Navigation Event Callbacks ============
        onNavigationBackClicked={() => {
          console.log('Back button clicked');
        }}
        
        onNavigationCloseClicked={() => {
          console.log('Close button clicked');
        }}
        
        // ============ EPG Event Handlers ============
        onEPGProgramSelect={(program, channel) => {
          console.log('EPG program selected:', program, channel);
        }}
        
        onEPGFavorite={async (program, channel) => {
          console.log('Add to favorites:', program);
        }}
        
        onToggleEPG={(visible) => {
          console.log('EPG toggled:', visible);
        }}
      />
      
      {/* ============ Custom Controls Using APIs ============ */}
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.8)',
        padding: '20px',
        borderRadius: '12px',
        color: 'white',
        maxWidth: '300px',
      }}>
        <h3 style={{ margin: '0 0 15px 0' }}>API Controls</h3>
        
        {/* Playback Controls */}
        {playbackAPI && (
          <div style={{ marginBottom: '15px' }}>
            <h4>Playback</h4>
            <button onClick={() => playbackAPI.play()}>Play</button>
            <button onClick={() => playbackAPI.pause()}>Pause</button>
            <button onClick={() => playbackAPI.seek(0)}>Restart</button>
            <p>Time: {Math.round(currentTime)}s / {Math.round(duration)}s</p>
          </div>
        )}
        
        {/* Quality Controls */}
        {qualityAPI && qualities.length > 0 && (
          <div style={{ marginBottom: '15px' }}>
            <h4>Quality</h4>
            <select onChange={(e) => qualityAPI.setQuality(parseInt(e.target.value))}>
              <option value="-1">Auto</option>
              {qualities.map((q, i) => (
                <option key={i} value={i}>{q.label}</option>
              ))}
            </select>
          </div>
        )}
        
        {/* Chapter Controls */}
        {chapterAPI && chapterAPI.hasChapters() && (
          <div style={{ marginBottom: '15px' }}>
            <h4>Chapters</h4>
            <button onClick={() => {
              const next = chapterAPI.getNextChapter();
              if (next) chapterAPI.seekToChapter(next.id);
            }}>
              Next Chapter
            </button>
            <button onClick={() => chapterAPI.skipToSegment('intro')}>
              Skip Intro
            </button>
          </div>
        )}
        
        {/* UI Helper Controls */}
        {uiAPI && (
          <div style={{ marginBottom: '15px' }}>
            <h4>UI Helpers</h4>
            <button onClick={() => uiAPI.showFullscreenTip()}>
              Show Fullscreen Tip
            </button>
            <button onClick={() => uiAPI.showTemporaryMessage('Hello!')}>
              Show Message
            </button>
          </div>
        )}
        
        {/* Fullscreen Controls */}
        {fullscreenAPI && (
          <div style={{ marginBottom: '15px' }}>
            <h4>Fullscreen</h4>
            <button onClick={() => fullscreenAPI.toggleFullscreen()}>
              Toggle Fullscreen
            </button>
            <button onClick={() => fullscreenAPI.enterPictureInPicture()}>
              Picture-in-Picture
            </button>
          </div>
        )}
        
        {/* EPG Controls */}
        {epgAPI && (
          <div>
            <h4>EPG</h4>
            <button onClick={() => epgAPI.showEPGButton()}>
              Show EPG Button
            </button>
            <button onClick={() => epgAPI.hideEPGButton()}>
              Hide EPG Button
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComprehensivePlayerExample;
