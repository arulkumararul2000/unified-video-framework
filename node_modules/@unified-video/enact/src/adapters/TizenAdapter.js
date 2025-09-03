import EventEmitter from 'events';

class TizenAdapter extends EventEmitter {
    constructor() {
        super();
        this.avplay = null;
        this.element = null;
        this.listener = null;
        this.currentSource = null;
        this.qualities = [];
        this.subtitles = [];
        this.currentQuality = null;
        this.currentSubtitle = null;
    }
    
    async initialize(element) {
        this.element = element;
        
        // Check if running on Tizen
        if (!window.tizen || !window.webapis) {
            console.warn('Tizen APIs not available, using fallback player');
            throw new Error('Tizen APIs not available');
        }
        
        this.avplay = window.webapis.avplay;
        
        // Set up AVPlay listener
        this.listener = {
            onbufferingstart: () => {
                console.log('Buffering started');
                this.emit('bufferingstart');
            },
            
            onbufferingprogress: (percent) => {
                console.log('Buffering progress:', percent);
                this.emit('bufferingprogress', percent);
            },
            
            onbufferingcomplete: () => {
                console.log('Buffering complete');
                this.emit('bufferingcomplete');
            },
            
            oncurrentplaytime: (milliseconds) => {
                this.emit('timeupdate', milliseconds / 1000);
            },
            
            onevent: (eventType, eventData) => {
                console.log('Event:', eventType, eventData);
                this.handleTizenEvent(eventType, eventData);
            },
            
            onerror: (eventType) => {
                console.error('Error:', eventType);
                this.emit('error', new Error(eventType));
            },
            
            ondrmevent: (drmEvent, drmData) => {
                console.log('DRM Event:', drmEvent, drmData);
                this.handleDRMEvent(drmEvent, drmData);
            },
            
            onsubtitlechange: (duration, text, data) => {
                this.emit('subtitlechange', { duration, text, data });
            },
            
            onstreamcompleted: () => {
                console.log('Stream completed');
                this.emit('ended');
            }
        };
        
        this.avplay.setListener(this.listener);
    }
    
    async load(source) {
        try {
            this.currentSource = source;
            
            // Open the media URL
            await this.avplay.open(source.url);
            
            // Set display method
            this.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
            
            // Get display rect
            const rect = this.element.getBoundingClientRect();
            this.avplay.setDisplayRect(
                rect.left,
                rect.top,
                rect.width,
                rect.height
            );
            
            // Set stream info if needed
            if (source.streamInfo) {
                Object.entries(source.streamInfo).forEach(([key, value]) => {
                    this.avplay.setStreamingProperty(key, value);
                });
            }
            
            // Parse available qualities from stream info
            this.parseStreamInfo();
            
            // Set subtitles if available
            if (source.subtitles && source.subtitles.length > 0) {
                this.subtitles = source.subtitles;
                this.setSubtitleTrack(source.subtitles[0]);
            }
            
            // Prepare the player
            await this.prepareAsync();
            
            // Get duration
            const duration = this.avplay.getDuration() / 1000;
            this.emit('durationchange', duration);
            
            this.emit('ready');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    
    prepareAsync() {
        return new Promise((resolve, reject) => {
            this.avplay.prepareAsync(
                () => resolve(),
                (error) => reject(new Error(error))
            );
        });
    }
    
    async configureDRM(drmConfig) {
        if (!drmConfig) return;
        
        const drmParam = {
            LicenseServer: drmConfig.licenseUrl,
            CustomData: drmConfig.customData || '',
            DeleteLicenseAfterUse: drmConfig.deleteLicenseAfterUse || false
        };
        
        // Add headers if provided
        if (drmConfig.headers) {
            drmParam.HttpRequestHeaders = Object.entries(drmConfig.headers)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\\r\\n');
        }
        
        // Set DRM operation
        if (drmConfig.type === 'PLAYREADY' || drmConfig.type === 'playready') {
            this.avplay.setDrm('PLAYREADY', 'SetProperties', JSON.stringify(drmParam));
        } else if (drmConfig.type === 'WIDEVINE' || drmConfig.type === 'widevine') {
            this.avplay.setDrm('WIDEVINE', 'SetProperties', JSON.stringify(drmParam));
        }
    }
    
    play() {
        this.avplay.play();
        this.emit('play');
    }
    
    pause() {
        this.avplay.pause();
        this.emit('pause');
    }
    
    seek(seconds) {
        const milliseconds = Math.floor(seconds * 1000);
        this.avplay.seekTo(milliseconds);
        this.emit('seek', seconds);
    }
    
    stop() {
        this.avplay.stop();
        this.emit('stop');
    }
    
    setVolume(level) {
        // Tizen volume is 0-100
        const tizenVolume = Math.floor(level * 100);
        this.avplay.setVolume(tizenVolume);
        this.emit('volumechange', level, false);
    }
    
    setMuted(muted) {
        if (muted) {
            this.avplay.setVolume(0);
        } else {
            this.setVolume(1); // Restore to full volume
        }
        this.emit('volumechange', muted ? 0 : 1, muted);
    }
    
    getCurrentTime() {
        return this.avplay.getCurrentTime() / 1000;
    }
    
    getDuration() {
        return this.avplay.getDuration() / 1000;
    }
    
    getState() {
        return this.avplay.getState();
    }
    
    // Quality management
    getAvailableQualities() {
        return this.qualities;
    }
    
    setQuality(quality) {
        if (!quality || !this.qualities.includes(quality)) return;
        
        // Store current position
        const currentTime = this.getCurrentTime();
        
        // Set bitrate properties
        this.avplay.setStreamingProperty('ADAPTIVE_INFO', JSON.stringify({
            BITRATES: quality.bitrate.toString()
        }));
        
        this.currentQuality = quality;
        this.emit('qualitychange', quality);
        
        // Restore position
        this.seek(currentTime);
    }
    
    // Subtitle management
    getAvailableSubtitles() {
        return this.subtitles;
    }
    
    setSubtitle(subtitle) {
        if (!subtitle) {
            // Disable subtitles
            this.avplay.setSelectTrack('TEXT', -1);
            this.currentSubtitle = null;
        } else {
            // Enable specific subtitle track
            const trackIndex = this.subtitles.indexOf(subtitle);
            if (trackIndex >= 0) {
                this.avplay.setSelectTrack('TEXT', trackIndex);
                this.currentSubtitle = subtitle;
            }
        }
        this.emit('subtitlechange', subtitle);
    }
    
    // Fullscreen (Tizen TVs are always fullscreen)
    enterFullscreen() {
        // No-op on TV
    }
    
    exitFullscreen() {
        // No-op on TV
    }
    
    parseStreamInfo() {
        try {
            const streamInfo = this.avplay.getCurrentStreamInfo();
            if (streamInfo) {
                // Parse video stream info for qualities
                for (let i = 0; i < streamInfo.length; i++) {
                    const info = streamInfo[i];
                    if (info.type === 'VIDEO') {
                        this.qualities.push({
                            id: `quality_${i}`,
                            label: `${info.height}p`,
                            height: info.height,
                            width: info.width,
                            bitrate: info.bitrate || 0,
                            codec: info.codec
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Failed to parse stream info:', error);
        }
    }
    
    handleTizenEvent(eventType, eventData) {
        switch (eventType) {
            case 'PLAYER_MSG_RESOLUTION_CHANGED':
                this.emit('resolutionchanged', eventData);
                this.parseStreamInfo(); // Update qualities
                break;
            case 'PLAYER_MSG_BITRATE_CHANGE':
                this.emit('bitratechange', eventData);
                break;
            case 'PLAYER_MSG_FRAGMENT_INFO':
                this.emit('fragmentinfo', eventData);
                break;
            case 'PLAYER_MSG_HTTP_ERROR':
                this.emit('error', new Error(`HTTP Error: ${eventData}`));
                break;
            case 'PLAYER_MSG_NONE':
                // Playback started successfully
                break;
            default:
                this.emit('tizenevent', { type: eventType, data: eventData });
        }
    }
    
    handleDRMEvent(drmEvent, drmData) {
        switch (drmEvent) {
            case 'DRM_LICENSE_ACQUIRED':
                console.log('DRM license acquired');
                this.emit('drmlicenseacquired');
                break;
            case 'DRM_LICENSE_EXPIRED':
                console.error('DRM license expired');
                this.emit('drmlicenseexpired');
                this.emit('error', new Error('DRM license expired'));
                break;
            default:
                this.emit('drmevent', { event: drmEvent, data: drmData });
        }
    }
    
    // Get buffered percentage
    getBuffered() {
        try {
            const buffered = this.avplay.getBufferedRange();
            if (buffered && buffered.length > 0) {
                const duration = this.getDuration();
                const bufferedEnd = buffered[buffered.length - 1] / 1000;
                return (bufferedEnd / duration) * 100;
            }
        } catch (error) {
            console.error('Failed to get buffered range:', error);
        }
        return 0;
    }
    
    destroy() {
        if (this.avplay) {
            try {
                this.avplay.stop();
                this.avplay.close();
            } catch (error) {
                console.error('Error destroying player:', error);
            }
            this.avplay = null;
        }
        this.removeAllListeners();
        this.element = null;
        this.listener = null;
    }
}

export default TizenAdapter;
