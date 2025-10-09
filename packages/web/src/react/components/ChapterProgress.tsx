/**
 * React component for progress bar with chapter markers
 */

import React, { useMemo } from 'react';
import {
  VideoSegment,
  VideoChapters,
  SEGMENT_COLORS
} from '../../chapters/types/ChapterTypes';

export interface ChapterMarker {
  segment: VideoSegment;
  position: number; // Percentage position (0-100)
  color: string;
  label: string;
}

export interface ChapterProgressProps {
  /** Chapter data */
  chapters: VideoChapters | null;
  
  /** Current playback progress (0-100) */
  progress?: number;
  
  /** Buffered progress (0-100) */
  buffered?: number;
  
  /** Whether to show chapter markers */
  showMarkers?: boolean;
  
  /** Custom marker colors */
  markerColors?: Partial<typeof SEGMENT_COLORS>;
  
  /** Callback when marker is clicked */
  onMarkerClick?: (segment: VideoSegment) => void;
  
  /** Callback when progress bar is clicked */
  onProgressClick?: (percentage: number) => void;
  
  /** Custom CSS class name */
  className?: string;
  
  /** Custom styles */
  style?: React.CSSProperties;
  
  /** Whether progress bar is interactive */
  interactive?: boolean;
}

export const ChapterProgress: React.FC<ChapterProgressProps> = ({
  chapters,
  progress = 0,
  buffered = 0,
  showMarkers = true,
  markerColors = {},
  onMarkerClick,
  onProgressClick,
  className = '',
  style = {},
  interactive = true
}) => {
  /**
   * Generate chapter markers
   */
  const markers = useMemo((): ChapterMarker[] => {
    if (!chapters || !showMarkers) return [];

    const colors = { ...SEGMENT_COLORS, ...markerColors };

    return chapters.segments
      .filter(segment => segment.type !== 'content') // Don't show markers for content
      .map(segment => ({
        segment,
        position: (segment.startTime / chapters.duration) * 100,
        color: colors[segment.type] || '#ffffff',
        label: segment.title || segment.type
      }))
      .sort((a, b) => a.position - b.position);
  }, [chapters, showMarkers, markerColors]);

  /**
   * Handle progress bar click
   */
  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !onProgressClick) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    
    onProgressClick(Math.max(0, Math.min(100, percentage)));
  };

  /**
   * Handle marker click
   */
  const handleMarkerClick = (event: React.MouseEvent, segment: VideoSegment) => {
    event.stopPropagation(); // Prevent progress bar click
    onMarkerClick?.(segment);
  };

  // Combine classes
  const progressClasses = [
    'uvf-chapter-progress',
    interactive ? 'interactive' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={progressClasses}
      style={{
        position: 'relative',
        width: '100%',
        height: '4px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '2px',
        cursor: interactive ? 'pointer' : 'default',
        ...style
      }}
      onClick={handleProgressClick}
    >
      {/* Buffered progress */}
      <div
        className="uvf-chapter-progress-buffered"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${Math.max(0, Math.min(100, buffered))}%`,
          backgroundColor: 'rgba(255, 255, 255, 0.4)',
          borderRadius: 'inherit',
          transition: 'width 0.3s ease'
        }}
      />

      {/* Current progress */}
      <div
        className="uvf-chapter-progress-current"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: `${Math.max(0, Math.min(100, progress))}%`,
          background: 'linear-gradient(90deg, var(--uvf-accent-1, #ff5722) 0%, var(--uvf-accent-2, #ff8a50) 100%)',
          borderRadius: 'inherit',
          transition: 'width 0.1s ease'
        }}
      />

      {/* Chapter markers */}
      {markers.map((marker, index) => (
        <div
          key={`${marker.segment.id}-${index}`}
          className={`uvf-chapter-progress-marker uvf-marker-${marker.segment.type}`}
          style={{
            position: 'absolute',
            top: '50%',
            left: `${marker.position}%`,
            width: '3px',
            height: '150%',
            backgroundColor: marker.color,
            transform: 'translate(-50%, -50%)',
            cursor: 'pointer',
            borderRadius: '1px',
            zIndex: 10,
            transition: 'all 0.2s ease'
          }}
          title={`${marker.label} (${formatTime(marker.segment.startTime)})`}
          onClick={(e) => handleMarkerClick(e, marker.segment)}
          onMouseEnter={(e) => {
            const element = e.currentTarget as HTMLElement;
            element.style.width = '4px';
            element.style.height = '200%';
            element.style.boxShadow = `0 0 8px ${marker.color}`;
          }}
          onMouseLeave={(e) => {
            const element = e.currentTarget as HTMLElement;
            element.style.width = '3px';
            element.style.height = '150%';
            element.style.boxShadow = 'none';
          }}
        />
      ))}
    </div>
  );
};

/**
 * Format time in MM:SS or HH:MM:SS format
 */
function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
