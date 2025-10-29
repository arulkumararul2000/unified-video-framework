/**
 * Core chapter management system for video segments and skip functionality
 */

import {
  VideoSegment,
  VideoChapters,
  ChapterConfig,
  ChapterEvents,
  ChapterMarker,
  SegmentType,
  DEFAULT_CHAPTER_CONFIG,
  SEGMENT_COLORS
} from './types/ChapterTypes';
import { SkipButtonController } from './SkipButtonController';

export class ChapterManager {
  private chapters: VideoChapters | null = null;
  private currentSegment: VideoSegment | null = null;
  private previousSegment: VideoSegment | null = null;
  private skipButtonController: SkipButtonController;
  private config: ChapterConfig;
  private eventListeners: Map<keyof ChapterEvents, Function[]> = new Map();
  private isDestroyed = false;

  constructor(
    private playerContainer: HTMLElement,
    private videoElement: HTMLVideoElement,
    config: ChapterConfig = DEFAULT_CHAPTER_CONFIG
  ) {
    // Merge config with defaults
    this.config = { ...DEFAULT_CHAPTER_CONFIG, ...config };
    
    // Initialize skip button controller
    this.skipButtonController = new SkipButtonController(
      playerContainer,
      this.config,
      (segment) => this.skipToNextSegment(segment),
      (segment) => this.emit('skipButtonShown', { segment, currentTime: this.videoElement.currentTime }),
      (segment, reason) => this.emit('skipButtonHidden', { 
        segment, 
        currentTime: this.videoElement.currentTime, 
        reason: reason as any 
      })
    );

    // Set up time update listener
    this.setupTimeUpdateListener();

    // Load chapters if provided in config
    if (this.config.data) {
      this.loadChapters(this.config.data);
    } else if (this.config.dataUrl) {
      this.loadChaptersFromUrl(this.config.dataUrl);
    }
  }

  /**
   * Load chapters data
   */
  public async loadChapters(chapters: VideoChapters): Promise<void> {
    try {
      // Validate chapters data
      this.validateChapters(chapters);

      this.chapters = chapters;
      this.sortSegments();
      
      // Emit loaded event
      this.emit('chaptersLoaded', {
        chapters: this.chapters,
        segmentCount: this.chapters.segments.length
      });

      // Update chapter markers if enabled
      if (this.config.showChapterMarkers) {
        this.updateChapterMarkers();
      }

      // Check current segment
      this.checkCurrentSegment(this.videoElement.currentTime);

    } catch (error) {
      this.emit('chaptersLoadError', { 
        error: error as Error 
      });
      throw error;
    }
  }

  /**
   * Load chapters from URL
   */
  public async loadChaptersFromUrl(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load chapters: ${response.statusText}`);
      }

      const chapters: VideoChapters = await response.json();
      await this.loadChapters(chapters);

    } catch (error) {
      this.emit('chaptersLoadError', { 
        error: error as Error,
        url 
      });
      throw error;
    }
  }

  /**
   * Get current segment at given time
   */
  public getCurrentSegment(currentTime: number): VideoSegment | null {
    if (!this.chapters) return null;

    return this.chapters.segments.find(segment => 
      currentTime >= segment.startTime && currentTime < segment.endTime
    ) || null;
  }

  /**
   * Skip to next segment after current one
   */
  public skipToNextSegment(currentSegment: VideoSegment): void {
    if (!this.chapters) return;

    const nextSegment = this.getNextContentSegment(currentSegment);
    const targetTime = nextSegment ? nextSegment.startTime : currentSegment.endTime;

    // Store current playback state
    const wasPlaying = !this.videoElement.paused;

    // Emit skip event
    this.emit('segmentSkipped', {
      fromSegment: currentSegment,
      toSegment: nextSegment || undefined,
      skipMethod: 'button',
      currentTime: this.videoElement.currentTime
    });

    // Seek to target time
    this.videoElement.currentTime = targetTime;

    // Resume playback if video was playing before skip (better UX)
    const shouldResumePlayback = this.config.userPreferences?.resumePlaybackAfterSkip !== false;
    if (shouldResumePlayback && wasPlaying && this.videoElement.paused) {
      // Use a small delay to ensure seeking is complete
      setTimeout(() => {
        if (!this.videoElement.paused) return; // Don't play if already playing
        this.videoElement.play().catch(() => {
          // Handle autoplay restrictions gracefully
          console.warn('[ChapterManager] Could not resume playback after skip - user interaction may be required');
        });
      }, 50);
    }
  }

  /**
   * Skip to specific segment by ID
   */
  public skipToSegment(segmentId: string): void {
    if (!this.chapters) return;

    const segment = this.chapters.segments.find(s => s.id === segmentId);
    if (!segment) return;

    const fromSegment = this.currentSegment;
    
    // Store current playback state
    const wasPlaying = !this.videoElement.paused;
    
    // Emit skip event
    if (fromSegment) {
      this.emit('segmentSkipped', {
        fromSegment,
        toSegment: segment,
        skipMethod: 'manual',
        currentTime: this.videoElement.currentTime
      });
    }

    // Seek to segment start
    this.videoElement.currentTime = segment.startTime;

    // Resume playback if video was playing before skip (better UX)
    const shouldResumePlayback = this.config.userPreferences?.resumePlaybackAfterSkip !== false;
    if (shouldResumePlayback && wasPlaying && this.videoElement.paused) {
      // Use a small delay to ensure seeking is complete
      setTimeout(() => {
        if (!this.videoElement.paused) return; // Don't play if already playing
        this.videoElement.play().catch(() => {
          // Handle autoplay restrictions gracefully
          console.warn('[ChapterManager] Could not resume playback after skip - user interaction may be required');
        });
      }, 50);
    }
  }

  /**
   * Get all segments
   */
  public getSegments(): VideoSegment[] {
    return this.chapters?.segments || [];
  }

  /**
   * Get segment by ID
   */
  public getSegment(segmentId: string): VideoSegment | null {
    if (!this.chapters) return null;
    return this.chapters.segments.find(s => s.id === segmentId) || null;
  }

  /**
   * Get segments by type
   */
  public getSegmentsByType(type: SegmentType): VideoSegment[] {
    if (!this.chapters) return [];
    return this.chapters.segments.filter(s => s.type === type);
  }

  /**
   * Get chapter markers for progress bar
   */
  public getChapterMarkers(): ChapterMarker[] {
    if (!this.chapters || !this.config.showChapterMarkers) return [];

    return this.chapters.segments
      .filter(segment => segment.type !== 'content') // Don't show markers for content segments
      .map(segment => {
        // Use custom color if provided, otherwise fallback to default
        const customColor = this.config.customStyles?.progressMarkers?.[segment.type];
        const color = customColor || SEGMENT_COLORS[segment.type];
        
        return {
          segment,
          position: (segment.startTime / this.chapters!.duration) * 100,
          color,
          label: segment.title || segment.type
        };
      });
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ChapterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update skip button position if changed
    if (newConfig.skipButtonPosition) {
      this.skipButtonController.updatePosition(newConfig.skipButtonPosition);
    }

    // Update chapter markers if setting changed
    if ('showChapterMarkers' in newConfig) {
      if (newConfig.showChapterMarkers) {
        this.updateChapterMarkers();
      } else {
        this.removeChapterMarkers();
      }
    }
  }

  /**
   * Add event listener
   */
  public on<K extends keyof ChapterEvents>(event: K, listener: (data: ChapterEvents[K]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  public off<K extends keyof ChapterEvents>(event: K, listener: (data: ChapterEvents[K]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Destroy the chapter manager
   */
  public destroy(): void {
    this.isDestroyed = true;
    this.skipButtonController.destroy();
    this.removeChapterMarkers();
    this.eventListeners.clear();
    this.chapters = null;
    this.currentSegment = null;
    this.previousSegment = null;
  }

  /**
   * Check if chapters are loaded
   */
  public hasChapters(): boolean {
    return this.chapters !== null && this.chapters.segments.length > 0;
  }

  /**
   * Get current chapter data
   */
  public getChapters(): VideoChapters | null {
    return this.chapters;
  }

  /**
   * Set up time update listener
   */
  private setupTimeUpdateListener(): void {
    const handleTimeUpdate = () => {
      if (this.isDestroyed) return;
      this.checkCurrentSegment(this.videoElement.currentTime);
    };

    this.videoElement.addEventListener('timeupdate', handleTimeUpdate);
  }

  /**
   * Check and update current segment
   */
  private checkCurrentSegment(currentTime: number): void {
    if (!this.chapters) return;

    const newSegment = this.getCurrentSegment(currentTime);

    // Check if segment changed
    if (newSegment !== this.currentSegment) {
      // Handle segment exit
      if (this.currentSegment) {
        this.emit('segmentExited', {
          segment: this.currentSegment,
          currentTime,
          nextSegment: newSegment || undefined
        });

        // Hide skip button when exiting skippable segments
        if (this.shouldShowSkipButton(this.currentSegment)) {
          this.skipButtonController.hideSkipButton('segment-end');
        }
      }

      // Update current segment
      this.previousSegment = this.currentSegment;
      this.currentSegment = newSegment;

      // Handle segment entry
      if (this.currentSegment) {
        this.emit('segmentEntered', {
          segment: this.currentSegment,
          currentTime,
          previousSegment: this.previousSegment || undefined
        });

        // Show skip button for skippable segments
        if (this.shouldShowSkipButton(this.currentSegment)) {
          this.skipButtonController.showSkipButton(this.currentSegment, currentTime);
        }
      }
    }
  }

  /**
   * Check if segment should show skip button
   */
  private shouldShowSkipButton(segment: VideoSegment): boolean {
    // Don't show for content segments by default
    if (segment.type === 'content') {
      return segment.showSkipButton === true;
    }

    // Show for other segment types unless explicitly disabled
    return segment.showSkipButton !== false;
  }

  /**
   * Get next content segment after current segment
   */
  private getNextContentSegment(currentSegment: VideoSegment): VideoSegment | null {
    if (!this.chapters) return null;

    const sortedSegments = [...this.chapters.segments].sort((a, b) => a.startTime - b.startTime);
    const currentIndex = sortedSegments.findIndex(s => s.id === currentSegment.id);
    
    if (currentIndex === -1) return null;

    // Find next content segment
    for (let i = currentIndex + 1; i < sortedSegments.length; i++) {
      if (sortedSegments[i].type === 'content') {
        return sortedSegments[i];
      }
    }

    return null;
  }

  /**
   * Sort segments by start time
   */
  private sortSegments(): void {
    if (this.chapters) {
      this.chapters.segments.sort((a, b) => a.startTime - b.startTime);
    }
  }

  /**
   * Validate chapters data
   */
  private validateChapters(chapters: VideoChapters): void {
    if (!chapters.videoId) {
      throw new Error('Chapters must have a videoId');
    }

    if (!chapters.duration || chapters.duration <= 0) {
      throw new Error('Chapters must have a valid duration');
    }

    if (!Array.isArray(chapters.segments)) {
      throw new Error('Chapters must have a segments array');
    }

    // Validate each segment
    chapters.segments.forEach((segment, index) => {
      if (!segment.id) {
        throw new Error(`Segment at index ${index} must have an id`);
      }

      if (!segment.type) {
        throw new Error(`Segment at index ${index} must have a type`);
      }

      if (segment.startTime < 0 || segment.endTime <= segment.startTime) {
        throw new Error(`Segment at index ${index} has invalid time range`);
      }

      if (segment.endTime > chapters.duration) {
        throw new Error(`Segment at index ${index} extends beyond video duration`);
      }
    });
  }

  /**
   * Update chapter markers on progress bar
   */
  private updateChapterMarkers(): void {
    if (!this.chapters || !this.config.showChapterMarkers) return;

    const progressBar = this.playerContainer.querySelector('.uvf-progress-bar');
    if (!progressBar) return;

    // Remove existing markers
    this.removeChapterMarkers();

    // Add new markers
    const markers = this.getChapterMarkers();
    markers.forEach(marker => {
      const markerElement = document.createElement('div');
      markerElement.className = `uvf-chapter-marker uvf-chapter-marker-${marker.segment.type}`;
      markerElement.style.left = `${marker.position}%`;
      markerElement.style.backgroundColor = marker.color || SEGMENT_COLORS[marker.segment.type];
      markerElement.setAttribute('title', marker.label || '');
      markerElement.setAttribute('data-segment-id', marker.segment.id);

      progressBar.appendChild(markerElement);
    });
  }

  /**
   * Remove chapter markers from progress bar
   */
  private removeChapterMarkers(): void {
    const markers = this.playerContainer.querySelectorAll('.uvf-chapter-marker');
    markers.forEach(marker => marker.remove());
  }

  /**
   * Emit event
   */
  private emit<K extends keyof ChapterEvents>(event: K, data: ChapterEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in chapter event listener for ${event}:`, error);
        }
      });
    }
  }
}
