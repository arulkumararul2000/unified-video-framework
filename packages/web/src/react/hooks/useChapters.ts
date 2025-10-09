/**
 * React hook for video chapters and skip functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  VideoSegment,
  VideoChapters,
  ChapterConfig,
  ChapterEvents,
  SegmentType
} from '../../chapters/types/ChapterTypes';

export interface UseChaptersOptions {
  videoElement?: HTMLVideoElement | null;
  chapters?: VideoChapters;
  config?: ChapterConfig;
  onSegmentEntered?: (segment: VideoSegment) => void;
  onSegmentSkipped?: (fromSegment: VideoSegment, toSegment?: VideoSegment) => void;
  onSkipButtonShown?: (segment: VideoSegment) => void;
  onSkipButtonHidden?: (segment: VideoSegment) => void;
}

export interface UseChaptersResult {
  // State
  currentSegment: VideoSegment | null;
  chapters: VideoChapters | null;
  isSkipButtonVisible: boolean;
  
  // Actions
  loadChapters: (chapters: VideoChapters) => Promise<void>;
  skipToSegment: (segmentId: string) => void;
  skipCurrentSegment: () => void;
  
  // Queries
  getSegmentsByType: (type: SegmentType) => VideoSegment[];
  hasSegmentType: (type: SegmentType) => boolean;
  getChapterMarkers: () => Array<{
    position: number;
    segment: VideoSegment;
    color: string;
  }>;
  
  // Utils
  formatTime: (seconds: number) => string;
  isInSegment: (segmentId: string) => boolean;
}

export function useChapters(options: UseChaptersOptions = {}): UseChaptersResult {
  const {
    videoElement,
    chapters: initialChapters,
    config = { enabled: true },
    onSegmentEntered,
    onSegmentSkipped,
    onSkipButtonShown,
    onSkipButtonHidden
  } = options;

  // State
  const [currentSegment, setCurrentSegment] = useState<VideoSegment | null>(null);
  const [chapters, setChapters] = useState<VideoChapters | null>(initialChapters || null);
  const [isSkipButtonVisible, setIsSkipButtonVisible] = useState(false);

  // Refs
  const timeUpdateHandlerRef = useRef<(() => void) | null>(null);
  const previousSegmentRef = useRef<VideoSegment | null>(null);

  /**
   * Get current segment at given time
   */
  const getCurrentSegment = useCallback((currentTime: number): VideoSegment | null => {
    if (!chapters) return null;

    return chapters.segments.find(segment => 
      currentTime >= segment.startTime && currentTime < segment.endTime
    ) || null;
  }, [chapters]);

  /**
   * Handle time update
   */
  const handleTimeUpdate = useCallback(() => {
    if (!videoElement || !chapters) return;

    const newSegment = getCurrentSegment(videoElement.currentTime);
    
    if (newSegment !== currentSegment) {
      // Segment changed
      if (currentSegment) {
        // Exiting current segment
        setIsSkipButtonVisible(false);
        onSkipButtonHidden?.(currentSegment);
      }

      previousSegmentRef.current = currentSegment;
      setCurrentSegment(newSegment);

      if (newSegment) {
        // Entering new segment
        onSegmentEntered?.(newSegment);

        // Show skip button for skippable segments
        if (shouldShowSkipButton(newSegment)) {
          setIsSkipButtonVisible(true);
          onSkipButtonShown?.(newSegment);
        }
      }
    }
  }, [videoElement, chapters, currentSegment, onSegmentEntered, onSkipButtonShown, onSkipButtonHidden, getCurrentSegment]);

  /**
   * Check if segment should show skip button
   */
  const shouldShowSkipButton = useCallback((segment: VideoSegment): boolean => {
    if (!config.userPreferences?.showSkipButtons) {
      return false;
    }

    // Don't show for content segments by default
    if (segment.type === 'content') {
      return segment.showSkipButton === true;
    }

    // Show for other segment types unless explicitly disabled
    return segment.showSkipButton !== false;
  }, [config]);

  /**
   * Set up time update listener
   */
  useEffect(() => {
    if (!videoElement) return;

    const handler = () => handleTimeUpdate();
    timeUpdateHandlerRef.current = handler;
    
    videoElement.addEventListener('timeupdate', handler);
    
    return () => {
      videoElement.removeEventListener('timeupdate', handler);
    };
  }, [videoElement, handleTimeUpdate]);

  /**
   * Load chapters
   */
  const loadChapters = useCallback(async (newChapters: VideoChapters): Promise<void> => {
    // Validate chapters
    if (!newChapters.videoId || !newChapters.duration || !Array.isArray(newChapters.segments)) {
      throw new Error('Invalid chapters data');
    }

    // Sort segments by start time
    const sortedChapters = {
      ...newChapters,
      segments: [...newChapters.segments].sort((a, b) => a.startTime - b.startTime)
    };

    setChapters(sortedChapters);
    
    // Check current segment if video is playing
    if (videoElement) {
      const segment = getCurrentSegment(videoElement.currentTime);
      setCurrentSegment(segment);
    }
  }, [videoElement, getCurrentSegment]);

  /**
   * Skip to specific segment
   */
  const skipToSegment = useCallback((segmentId: string) => {
    if (!chapters || !videoElement) return;

    const segment = chapters.segments.find(s => s.id === segmentId);
    if (!segment) return;

    const fromSegment = currentSegment;
    
    // Emit skip event
    if (fromSegment) {
      onSegmentSkipped?.(fromSegment, segment);
    }

    // Seek to segment start
    videoElement.currentTime = segment.startTime;
  }, [chapters, videoElement, currentSegment, onSegmentSkipped]);

  /**
   * Skip current segment
   */
  const skipCurrentSegment = useCallback(() => {
    if (!currentSegment || !chapters || !videoElement) return;

    // Find next content segment
    const sortedSegments = [...chapters.segments].sort((a, b) => a.startTime - b.startTime);
    const currentIndex = sortedSegments.findIndex(s => s.id === currentSegment.id);
    
    if (currentIndex === -1) return;

    // Find next content segment
    let nextSegment: VideoSegment | undefined;
    for (let i = currentIndex + 1; i < sortedSegments.length; i++) {
      if (sortedSegments[i].type === 'content') {
        nextSegment = sortedSegments[i];
        break;
      }
    }

    const targetTime = nextSegment ? nextSegment.startTime : currentSegment.endTime;

    // Emit skip event
    onSegmentSkipped?.(currentSegment, nextSegment);

    // Seek to target time
    videoElement.currentTime = targetTime;
  }, [currentSegment, chapters, videoElement, onSegmentSkipped]);

  /**
   * Get segments by type
   */
  const getSegmentsByType = useCallback((type: SegmentType): VideoSegment[] => {
    if (!chapters) return [];
    return chapters.segments.filter(segment => segment.type === type);
  }, [chapters]);

  /**
   * Check if has segment type
   */
  const hasSegmentType = useCallback((type: SegmentType): boolean => {
    return getSegmentsByType(type).length > 0;
  }, [getSegmentsByType]);

  /**
   * Get chapter markers for progress bar
   */
  const getChapterMarkers = useCallback(() => {
    if (!chapters) return [];

    const segmentColors: Record<SegmentType, string> = {
      intro: '#ff5722',
      recap: '#ffc107',
      content: '#4caf50',
      credits: '#9c27b0',
      ad: '#f44336'
    };

    return chapters.segments
      .filter(segment => segment.type !== 'content')
      .map(segment => ({
        position: (segment.startTime / chapters.duration) * 100,
        segment,
        color: segmentColors[segment.type]
      }));
  }, [chapters]);

  /**
   * Format time as MM:SS or HH:MM:SS
   */
  const formatTime = useCallback((seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }, []);

  /**
   * Check if currently in specific segment
   */
  const isInSegment = useCallback((segmentId: string): boolean => {
    return currentSegment?.id === segmentId;
  }, [currentSegment]);

  // Load initial chapters
  useEffect(() => {
    if (initialChapters) {
      loadChapters(initialChapters);
    }
  }, [initialChapters, loadChapters]);

  return {
    // State
    currentSegment,
    chapters,
    isSkipButtonVisible,
    
    // Actions
    loadChapters,
    skipToSegment,
    skipCurrentSegment,
    
    // Queries
    getSegmentsByType,
    hasSegmentType,
    getChapterMarkers,
    
    // Utils
    formatTime,
    isInSegment
  };
}
