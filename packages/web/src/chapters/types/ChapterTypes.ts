/**
 * Types and interfaces for video chapters and skip functionality
 */

export type SegmentType = 'intro' | 'recap' | 'content' | 'credits' | 'ad';

export type SkipButtonPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/**
 * Represents a video segment/chapter
 */
export interface VideoSegment {
  /** Unique identifier for the segment */
  id: string;
  
  /** Type of segment */
  type: SegmentType;
  
  /** Start time in seconds */
  startTime: number;
  
  /** End time in seconds */
  endTime: number;
  
  /** Display title for the segment */
  title?: string;
  
  /** Description of the segment */
  description?: string;
  
  /** Custom text for the skip button */
  skipLabel?: string;
  
  /** Whether to auto-skip after a delay */
  autoSkip?: boolean;
  
  /** Delay in seconds before auto-skip */
  autoSkipDelay?: number;
  
  /** Whether to show skip button for this segment */
  showSkipButton?: boolean;
}

/**
 * Complete chapter data for a video
 */
export interface VideoChapters {
  /** Video identifier */
  videoId: string;
  
  /** Total video duration in seconds */
  duration: number;
  
  /** Array of video segments */
  segments: VideoSegment[];
  
  /** Metadata about the chapters */
  metadata?: {
    version?: string;
    createdAt?: string;
    updatedAt?: string;
    source?: 'manual' | 'auto-detected' | 'crowdsourced';
  };
}

/**
 * Configuration for chapter functionality
 */
export interface ChapterConfig {
  /** Enable/disable chapter functionality */
  enabled: boolean;
  
  /** Chapter data object */
  data?: VideoChapters;
  
  /** URL to fetch chapter data from */
  dataUrl?: string;
  
  /** Auto-hide skip button after showing */
  autoHide?: boolean;
  
  /** Delay before auto-hiding skip button (ms) */
  autoHideDelay?: number;
  
  /** Show chapter markers on progress bar */
  showChapterMarkers?: boolean;
  
  /** Position of skip button */
  skipButtonPosition?: SkipButtonPosition;
  
  /** Custom CSS styles */
  customStyles?: {
    skipButton?: Partial<CSSStyleDeclaration>;
    chapterMarkers?: Partial<CSSStyleDeclaration>;
    progressMarkers?: {
      intro?: string;
      recap?: string;
      content?: string;
      credits?: string;
      ad?: string;
    };
  };
  
  /** User preferences */
  userPreferences?: ChapterPreferences;
}

/**
 * User preferences for chapter behavior
 */
export interface ChapterPreferences {
  /** Auto-skip intro segments */
  autoSkipIntro?: boolean;
  
  /** Auto-skip recap segments */
  autoSkipRecap?: boolean;
  
  /** Auto-skip credits segments */
  autoSkipCredits?: boolean;
  
  /** Show skip buttons */
  showSkipButtons?: boolean;
  
  /** Skip button timeout in milliseconds */
  skipButtonTimeout?: number;
  
  /** Remember user choices */
  rememberChoices?: boolean;
  
  /** Resume playback after skip (default: true for better UX) */
  resumePlaybackAfterSkip?: boolean;
}

/**
 * Events emitted by the chapter system
 */
export interface ChapterEvents {
  /** When entering a new segment */
  segmentEntered: {
    segment: VideoSegment;
    currentTime: number;
    previousSegment?: VideoSegment;
  };
  
  /** When exiting a segment */
  segmentExited: {
    segment: VideoSegment;
    currentTime: number;
    nextSegment?: VideoSegment;
  };
  
  /** When a segment is skipped */
  segmentSkipped: {
    fromSegment: VideoSegment;
    toSegment?: VideoSegment;
    skipMethod: 'button' | 'auto' | 'manual';
    currentTime: number;
  };
  
  /** When skip button is shown */
  skipButtonShown: {
    segment: VideoSegment;
    currentTime: number;
  };
  
  /** When skip button is hidden */
  skipButtonHidden: {
    segment: VideoSegment;
    currentTime: number;
    reason: 'timeout' | 'segment-end' | 'user-action' | 'manual';
  };
  
  /** When chapters are loaded */
  chaptersLoaded: {
    chapters: VideoChapters;
    segmentCount: number;
  };
  
  /** When chapter loading fails */
  chaptersLoadError: {
    error: Error;
    url?: string;
  };
}

/**
 * Skip button state
 */
export interface SkipButtonState {
  visible: boolean;
  segment: VideoSegment | null;
  autoSkipCountdown?: number;
  position: SkipButtonPosition;
}

/**
 * Chapter marker data for progress bar
 */
export interface ChapterMarker {
  segment: VideoSegment;
  position: number; // Percentage position on progress bar (0-100)
  color?: string;
  label?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CHAPTER_CONFIG: ChapterConfig = {
  enabled: false,
  autoHide: true,
  autoHideDelay: 5000,
  showChapterMarkers: true,
  skipButtonPosition: 'bottom-right',
  customStyles: {},
  userPreferences: {
    autoSkipIntro: false,
    autoSkipRecap: false,
    autoSkipCredits: false,
    showSkipButtons: true,
    skipButtonTimeout: 5000,
    rememberChoices: true,
    resumePlaybackAfterSkip: true
  }
};

/**
 * Default skip button labels for different segment types
 */
export const DEFAULT_SKIP_LABELS: Record<SegmentType, string> = {
  intro: 'Skip Intro',
  recap: 'Skip Recap',
  content: 'Skip',
  credits: 'Skip Credits',
  ad: 'Skip Ad'
};

/**
 * Colors for different segment types in chapter markers
 */
export const SEGMENT_COLORS: Record<SegmentType, string> = {
  intro: '#ff5722',    // Orange-red
  recap: '#ffc107',    // Amber
  content: '#4caf50',  // Green
  credits: '#9c27b0',  // Purple
  ad: '#FFFF00'        // Yellow (like YouTube ads)
};
