// Jest setup for DOM APIs not implemented by JSDOM

// Mock HTMLMediaElement methods used by the player
Object.defineProperty(HTMLMediaElement.prototype, 'load', {
  configurable: true,
  value: jest.fn()
});
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: jest.fn().mockResolvedValue()
});
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: jest.fn()
});

// Mock Canvas 2D context
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => {
    return {
      clearRect: jest.fn(),
      fillText: jest.fn(),
      createLinearGradient: () => ({ addColorStop: jest.fn() }),
      font: '',
      fillStyle: '',
      textAlign: 'left'
    } as any;
  }
});

// Stub HLS.js for tests to avoid dynamic script loading
// Provides minimal API used by WebPlayer
// @ts-ignore
window.Hls = {
  isSupported: () => true,
  Events: {
    MANIFEST_PARSED: 'manifestParsed',
    LEVEL_SWITCHED: 'levelSwitched',
    ERROR: 'error'
  },
  ErrorTypes: {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError'
  }
};

// Provide constructor behavior
// @ts-ignore
window.Hls = class {
  static isSupported() { return true; }
  static Events = {
    MANIFEST_PARSED: 'manifestParsed',
    LEVEL_SWITCHED: 'levelSwitched',
    ERROR: 'error'
  };
  static ErrorTypes = {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError'
  };
  private handlers: Record<string, Function[]> = {};
  constructor(_: any) {}
  loadSource(_: string) {}
  attachMedia(_: HTMLVideoElement | null) {}
  on(evt: string, handler: Function) {
    this.handlers[evt] = this.handlers[evt] || [];
    this.handlers[evt].push(handler);
  }
  startLoad() {}
  recoverMediaError() {}
  destroy() {}
  get currentLevel() { return -1; }
  set currentLevel(_val: number) {}
};

// Stub dash.js for tests to avoid dynamic script loading
// @ts-ignore
(function(){
  const MediaPlayer = function() {
    return {
      create() {
        const listeners: Record<string, Function[]> = {};
        return {
          initialize: (_video: HTMLVideoElement | null, _url: string, _autoPlay?: boolean) => {},
          updateSettings: (_: any) => {},
          on: (evt: string, handler: Function) => {
            listeners[evt] = listeners[evt] || [];
            listeners[evt].push(handler);
          },
          reset: () => {},
          setQualityFor: (_type: string, _index: number) => {},
          getBitrateInfoListFor: (_type: string) => [
            { height: 1080, width: 1920, bitrate: 4000000 },
            { height: 720, width: 1280, bitrate: 2500000 }
          ]
        } as any;
      }
    };
  };
  // Attach static events map to function object
  // @ts-ignore
  MediaPlayer.events = {
    QUALITY_CHANGE_RENDERED: 'qualityChangeRendered',
    STREAM_INITIALIZED: 'streamInitialized',
    ERROR: 'error'
  };
  // @ts-ignore
  window.dashjs = { MediaPlayer };
})();

