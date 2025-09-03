import kind from '@enact/core/kind';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Spotlight from '@enact/spotlight';
import { Panel } from '@enact/sandstone/Panels';
import VideoPlayerBase from '@enact/sandstone/VideoPlayer';
import { adaptEvent, forward, handle } from '@enact/core/handle';
import { platform } from '@enact/core/platform';

// Platform-specific adapters
import TizenAdapter from './adapters/TizenAdapter';
import WebOSAdapter from './adapters/WebOSAdapter';

const EnactVideoPlayer = kind({
    name: 'EnactVideoPlayer',
    
    propTypes: {
        source: PropTypes.shape({
            url: PropTypes.string.isRequired,
            type: PropTypes.string,
            drm: PropTypes.object,
            title: PropTypes.string,
            description: PropTypes.string,
            thumbnail: PropTypes.string
        }).isRequired,
        autoplay: PropTypes.bool,
        controls: PropTypes.bool,
        loop: PropTypes.bool,
        muted: PropTypes.bool,
        onError: PropTypes.func,
        onLoadStart: PropTypes.func,
        onLoadedMetadata: PropTypes.func,
        onPlay: PropTypes.func,
        onPause: PropTypes.func,
        onEnded: PropTypes.func,
        onTimeUpdate: PropTypes.func,
        onProgress: PropTypes.func,
        onQualityChange: PropTypes.func,
        onSubtitleChange: PropTypes.func,
        analytics: PropTypes.object
    },
    
    defaultProps: {
        autoplay: false,
        controls: true,
        loop: false,
        muted: false
    },
    
    styles: {
        css: require('./VideoPlayer.module.less'),
        className: 'videoPlayer'
    },
    
    handlers: {
        onPlay: handle(
            forward('onPlay'),
            (ev, props, context) => {
                if (props.analytics) {
                    props.analytics.track('play', {
                        url: props.source.url,
                        title: props.source.title,
                        timestamp: Date.now()
                    });
                }
            }
        ),
        
        onPause: handle(
            forward('onPause'),
            (ev, props, context) => {
                if (props.analytics) {
                    props.analytics.track('pause', {
                        url: props.source.url,
                        currentTime: ev.currentTime,
                        timestamp: Date.now()
                    });
                }
            }
        ),
        
        onError: handle(
            forward('onError'),
            (ev, props, context) => {
                if (props.analytics) {
                    props.analytics.track('error', {
                        error: ev.error,
                        url: props.source.url,
                        timestamp: Date.now()
                    });
                }
            }
        ),
        
        onEnded: handle(
            forward('onEnded'),
            (ev, props, context) => {
                if (props.analytics) {
                    props.analytics.track('ended', {
                        url: props.source.url,
                        duration: ev.duration,
                        timestamp: Date.now()
                    });
                }
            }
        )
    },
    
    computed: {
        platformAdapter: ({source}) => {
            if (platform.tv) {
                if (platform.tizen) {
                    return new TizenAdapter();
                } else if (platform.webos) {
                    return new WebOSAdapter();
                }
            }
            return null;
        }
    },
    
    render: ({source, platformAdapter, ...rest}) => {
        // Use platform-specific player if available
        if (platformAdapter) {
            return (
                <div className={rest.className}>
                    <PlatformVideoPlayer
                        adapter={platformAdapter}
                        source={source}
                        {...rest}
                    />
                </div>
            );
        }
        
        // Fallback to Enact's standard VideoPlayer
        return (
            <VideoPlayerBase
                {...rest}
                source={source.url}
                title={source.title}
                poster={source.thumbnail}
                infoComponents={source.description}
            />
        );
    }
});

// Platform-specific video player component
class PlatformVideoPlayer extends Component {
    constructor(props) {
        super(props);
        this.videoRef = React.createRef();
        this.state = {
            isReady: false,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            buffered: 0,
            volume: 1,
            isMuted: false,
            currentQuality: null,
            availableQualities: [],
            currentSubtitle: null,
            availableSubtitles: [],
            error: null
        };
    }
    
    async componentDidMount() {
        const { adapter, source } = this.props;
        
        try {
            // Initialize platform-specific player
            await adapter.initialize(this.videoRef.current);
            
            // Configure DRM if needed
            if (source.drm) {
                await adapter.configureDRM(source.drm);
            }
            
            // Load source
            await adapter.load(source);
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Get initial qualities and subtitles
            const qualities = await adapter.getAvailableQualities();
            const subtitles = await adapter.getAvailableSubtitles();
            
            this.setState({ 
                isReady: true,
                availableQualities: qualities,
                availableSubtitles: subtitles
            });
            
            // Auto-play if configured
            if (this.props.autoplay) {
                this.play();
            }
        } catch (error) {
            this.handleError(error);
        }
    }
    
    componentWillUnmount() {
        if (this.props.adapter) {
            this.props.adapter.destroy();
        }
    }
    
    setupEventListeners() {
        const { adapter } = this.props;
        
        adapter.on('play', () => {
            this.setState({ isPlaying: true });
            this.props.onPlay?.();
        });
        
        adapter.on('pause', () => {
            this.setState({ isPlaying: false });
            this.props.onPause?.();
        });
        
        adapter.on('timeupdate', (time) => {
            this.setState({ currentTime: time });
            this.props.onTimeUpdate?.({ currentTime: time });
        });
        
        adapter.on('durationchange', (duration) => {
            this.setState({ duration: duration });
        });
        
        adapter.on('progress', (buffered) => {
            this.setState({ buffered: buffered });
            this.props.onProgress?.({ buffered });
        });
        
        adapter.on('volumechange', (volume, muted) => {
            this.setState({ volume, isMuted: muted });
        });
        
        adapter.on('ended', () => {
            this.setState({ isPlaying: false });
            this.props.onEnded?.({ duration: this.state.duration });
            
            if (this.props.loop) {
                this.play();
            }
        });
        
        adapter.on('error', (error) => {
            this.handleError(error);
        });
        
        adapter.on('qualitychange', (quality) => {
            this.setState({ currentQuality: quality });
            this.props.onQualityChange?.({ quality });
        });
        
        adapter.on('subtitlechange', (subtitle) => {
            this.setState({ currentSubtitle: subtitle });
            this.props.onSubtitleChange?.({ subtitle });
        });
    }
    
    handleError(error) {
        console.error('Video player error:', error);
        this.setState({ error: error.message || 'An error occurred' });
        this.props.onError?.({ error });
    }
    
    play = () => {
        this.props.adapter.play();
    }
    
    pause = () => {
        this.props.adapter.pause();
    }
    
    seek = (time) => {
        this.props.adapter.seek(time);
    }
    
    setVolume = (volume) => {
        this.props.adapter.setVolume(volume);
    }
    
    toggleMute = () => {
        const newMuted = !this.state.isMuted;
        this.props.adapter.setMuted(newMuted);
    }
    
    setQuality = (quality) => {
        this.props.adapter.setQuality(quality);
    }
    
    setSubtitle = (subtitle) => {
        this.props.adapter.setSubtitle(subtitle);
    }
    
    enterFullscreen = () => {
        this.props.adapter.enterFullscreen();
    }
    
    exitFullscreen = () => {
        this.props.adapter.exitFullscreen();
    }
    
    render() {
        const { isReady, error, isPlaying } = this.state;
        const { controls, source } = this.props;
        
        if (error) {
            return (
                <div className="video-error">
                    <h3>Playback Error</h3>
                    <p>{error}</p>
                </div>
            );
        }
        
        return (
            <div className="platform-video-container">
                <div ref={this.videoRef} className="platform-video-player">
                    {!isReady && (
                        <div className="loading">
                            <span>Loading...</span>
                        </div>
                    )}
                </div>
                
                {controls && isReady && (
                    <VideoControls
                        isPlaying={this.state.isPlaying}
                        currentTime={this.state.currentTime}
                        duration={this.state.duration}
                        buffered={this.state.buffered}
                        volume={this.state.volume}
                        isMuted={this.state.isMuted}
                        currentQuality={this.state.currentQuality}
                        availableQualities={this.state.availableQualities}
                        currentSubtitle={this.state.currentSubtitle}
                        availableSubtitles={this.state.availableSubtitles}
                        onPlay={this.play}
                        onPause={this.pause}
                        onSeek={this.seek}
                        onVolumeChange={this.setVolume}
                        onMuteToggle={this.toggleMute}
                        onQualityChange={this.setQuality}
                        onSubtitleChange={this.setSubtitle}
                        onFullscreen={this.enterFullscreen}
                    />
                )}
            </div>
        );
    }
}

// Import VideoControls component
import VideoControls from './components/VideoControls';

export default EnactVideoPlayer;
export { PlatformVideoPlayer };
