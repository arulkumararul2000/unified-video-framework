import { WebPlayer } from '../WebPlayer';
import { VideoSource } from '../../core/dist';

describe('WebPlayer', () => {
  let player: WebPlayer;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    player = new WebPlayer();
  });

  afterEach(async () => {
    await player.destroy();
    document.body.removeChild(container);
  });

  describe('initialization', () => {
    it('should initialize with container element', async () => {
      await expect(player.initialize(container)).resolves.not.toThrow();
    });

    it('should initialize with container selector', async () => {
      container.id = 'test-container';
      await expect(player.initialize('#test-container')).resolves.not.toThrow();
    });

    it('should throw error if container not found', async () => {
      await expect(player.initialize('#non-existent')).rejects.toThrow(
        'Container element not found'
      );
    });

    it('should create video element inside container', async () => {
      await player.initialize(container);
      const video = container.querySelector('video');
      expect(video).toBeTruthy();
    });

    it('should apply config options to video element', async () => {
      await player.initialize(container, {
        autoPlay: true,
        muted: true,
        controls: false
      });
      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video.autoplay).toBe(true);
      expect(video.muted).toBe(true);
      expect(video.controls).toBe(false);
    });
  });

  describe('media loading', () => {
    beforeEach(async () => {
      await player.initialize(container);
    });

    it('should detect MP4 format', async () => {
      const source: VideoSource = {
        url: 'https://example.com/video.mp4'
      };
      
      const spy = jest.spyOn(player as any, 'loadNative');
      await player.load(source);
      expect(spy).toHaveBeenCalled();
    });

    it('should detect HLS format', async () => {
      const source: VideoSource = {
        url: 'https://example.com/video.m3u8'
      };
      
      const spy = jest.spyOn(player as any, 'loadHLS');
      await player.load(source);
      expect(spy).toHaveBeenCalled();
    });

    it('should detect DASH format', async () => {
      const source: VideoSource = {
        url: 'https://example.com/video.mpd'
      };
      
      const spy = jest.spyOn(player as any, 'loadDASH');
      await player.load(source);
      expect(spy).toHaveBeenCalled();
    });

    it('should use explicit type over detection', async () => {
      const source: VideoSource = {
        url: 'https://example.com/stream',
        type: 'hls'
      };
      
      const spy = jest.spyOn(player as any, 'loadHLS');
      await player.load(source);
      expect(spy).toHaveBeenCalled();
    });

    it('should load subtitles when provided', async () => {
      const source: VideoSource = {
        url: 'https://example.com/video.mp4',
        subtitles: [
          {
            url: 'https://example.com/subs.vtt',
            language: 'en',
            label: 'English',
            kind: 'subtitles'
          }
        ]
      };
      
      await player.load(source);
      const tracks = container.querySelectorAll('track');
      expect(tracks.length).toBe(1);
      expect(tracks[0].getAttribute('srclang')).toBe('en');
    });
  });

  describe('playback controls', () => {
    beforeEach(async () => {
      await player.initialize(container);
      await player.load({ url: 'test.mp4' });
    });

    it('should play video', async () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      const playSpy = jest.spyOn(video, 'play').mockResolvedValue();
      
      await player.play();
      expect(playSpy).toHaveBeenCalled();
      expect(player.isPlaying()).toBe(true);
    });

    it('should pause video', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      const pauseSpy = jest.spyOn(video, 'pause');
      
      player.pause();
      expect(pauseSpy).toHaveBeenCalled();
      expect(player.isPaused()).toBe(true);
    });

    it('should seek to position', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      player.seek(10);
      expect(video.currentTime).toBe(10);
    });

    it('should stop playback', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      player.stop();
      expect(video.currentTime).toBe(0);
      expect(player.isEnded()).toBe(true);
    });
  });

  describe('volume controls', () => {
    beforeEach(async () => {
      await player.initialize(container);
    });

    it('should set volume', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      player.setVolume(0.5);
      expect(video.volume).toBe(0.5);
    });

    it('should clamp volume between 0 and 1', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      
      player.setVolume(-1);
      expect(video.volume).toBe(0);
      
      player.setVolume(2);
      expect(video.volume).toBe(1);
    });

    it('should mute video', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      player.mute();
      expect(video.muted).toBe(true);
    });

    it('should unmute video', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      player.mute();
      player.unmute();
      expect(video.muted).toBe(false);
    });

    it('should toggle mute state', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      const initialMuted = video.muted;
      
      player.toggleMute();
      expect(video.muted).toBe(!initialMuted);
      
      player.toggleMute();
      expect(video.muted).toBe(initialMuted);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await player.initialize(container);
    });

    it('should emit play event', async () => {
      const callback = jest.fn();
      player.on('onPlay', callback);
      
      await player.play();
      expect(callback).toHaveBeenCalled();
    });

    it('should emit pause event', () => {
      const callback = jest.fn();
      player.on('onPause', callback);
      
      player.pause();
      expect(callback).toHaveBeenCalled();
    });

    it('should emit timeupdate event', () => {
      const callback = jest.fn();
      player.on('onTimeUpdate', callback);
      
      const video = container.querySelector('video') as HTMLVideoElement;
      video.dispatchEvent(new Event('timeupdate'));
      
      expect(callback).toHaveBeenCalled();
    });

    it('should remove event listener', () => {
      const callback = jest.fn();
      player.on('onPlay', callback);
      player.off('onPlay', callback);
      
      player.play();
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle one-time event', async () => {
      const callback = jest.fn();
      player.once('onPlay', callback);
      
      await player.play();
      await player.play();
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('state management', () => {
    beforeEach(async () => {
      await player.initialize(container);
    });

    it('should return current player state', () => {
      const state = player.getState();
      
      expect(state).toHaveProperty('isPlaying');
      expect(state).toHaveProperty('isPaused');
      expect(state).toHaveProperty('currentTime');
      expect(state).toHaveProperty('duration');
      expect(state).toHaveProperty('volume');
    });

    it('should update playback rate', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      
      player.setPlaybackRate(1.5);
      expect(video.playbackRate).toBe(1.5);
      expect(player.getPlaybackRate()).toBe(1.5);
    });

    it('should get current time', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'currentTime', {
        value: 30,
        configurable: true
      });
      
      expect(player.getCurrentTime()).toBe(30);
    });

    it('should get duration', () => {
      const video = container.querySelector('video') as HTMLVideoElement;
      Object.defineProperty(video, 'duration', {
        value: 120,
        configurable: true
      });
      
      const callback = jest.fn();
      player.on('onLoadedMetadata', callback);
      video.dispatchEvent(new Event('loadedmetadata'));
      
      expect(player.getDuration()).toBe(120);
    });
  });

  describe('cleanup', () => {
    it('should destroy player and clean up resources', async () => {
      await player.initialize(container);
      await player.load({ url: 'test.mp4' });
      
      await player.destroy();
      
      expect(container.innerHTML).toBe('');
      expect(player.getState().isPlaying).toBe(false);
    });
  });
});
