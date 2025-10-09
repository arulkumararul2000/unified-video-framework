/**
 * React component for skip button
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  VideoSegment,
  SkipButtonPosition,
  DEFAULT_SKIP_LABELS
} from '../../chapters/types/ChapterTypes';

export interface SkipButtonProps {
  /** Current segment to show skip button for */
  segment: VideoSegment | null;
  
  /** Whether button is visible */
  visible?: boolean;
  
  /** Button position */
  position?: SkipButtonPosition;
  
  /** Auto-hide delay in milliseconds */
  autoHideDelay?: number;
  
  /** Custom skip button text */
  skipLabel?: string;
  
  /** Callback when skip button is clicked */
  onSkip?: (segment: VideoSegment) => void;
  
  /** Callback when button is shown */
  onShow?: (segment: VideoSegment) => void;
  
  /** Callback when button is hidden */
  onHide?: (segment: VideoSegment, reason: string) => void;
  
  /** Custom CSS class name */
  className?: string;
  
  /** Custom styles */
  style?: React.CSSProperties;
  
  /** Enable auto-skip countdown */
  enableAutoSkip?: boolean;
  
  /** Auto-skip delay in seconds */
  autoSkipDelay?: number;
}

export const SkipButton: React.FC<SkipButtonProps> = ({
  segment,
  visible = false,
  position = 'bottom-right',
  autoHideDelay = 5000,
  skipLabel,
  onSkip,
  onShow,
  onHide,
  className = '',
  style = {},
  enableAutoSkip = false,
  autoSkipDelay = 10
}) => {
  // State
  const [isVisible, setIsVisible] = useState(visible);
  const [isAutoSkip, setIsAutoSkip] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Refs
  const autoHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSkipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousSegmentRef = useRef<VideoSegment | null>(null);

  /**
   * Clear all timeouts
   */
  const clearTimeouts = () => {
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
      autoHideTimeoutRef.current = null;
    }
    if (autoSkipTimeoutRef.current) {
      clearTimeout(autoSkipTimeoutRef.current);
      autoSkipTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  /**
   * Start auto-skip countdown
   */
  const startAutoSkip = (segment: VideoSegment, delay: number) => {
    setIsAutoSkip(true);
    setCountdown(delay);

    // Start countdown interval
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          // Auto-skip triggered
          clearTimeouts();
          onSkip?.(segment);
          handleHide('timeout');
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    // Set backup timeout
    autoSkipTimeoutRef.current = setTimeout(() => {
      clearTimeouts();
      onSkip?.(segment);
      handleHide('timeout');
    }, delay * 1000);
  };

  /**
   * Handle button click
   */
  const handleSkip = () => {
    if (!segment) return;
    
    clearTimeouts();
    onSkip?.(segment);
    handleHide('user-action');
  };

  /**
   * Handle button show
   */
  const handleShow = () => {
    if (!segment) return;
    
    setIsVisible(true);
    onShow?.(segment);

    // Start auto-hide timer
    if (autoHideDelay > 0) {
      autoHideTimeoutRef.current = setTimeout(() => {
        handleHide('timeout');
      }, autoHideDelay);
    }

    // Start auto-skip if enabled
    if (enableAutoSkip && segment.autoSkip && segment.autoSkipDelay) {
      startAutoSkip(segment, segment.autoSkipDelay);
    }
  };

  /**
   * Handle button hide
   */
  const handleHide = (reason: string = 'manual') => {
    if (!segment) return;
    
    clearTimeouts();
    setIsVisible(false);
    setIsAutoSkip(false);
    setCountdown(null);
    onHide?.(segment, reason);
  };

  // Effect to handle visibility changes
  useEffect(() => {
    if (visible && segment && segment !== previousSegmentRef.current) {
      previousSegmentRef.current = segment;
      handleShow();
    } else if (!visible || !segment) {
      if (previousSegmentRef.current) {
        handleHide('segment-end');
      }
      previousSegmentRef.current = null;
    }
  }, [visible, segment]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeouts();
    };
  }, []);

  // Don't render if no segment or not visible
  if (!segment || !isVisible) {
    return null;
  }

  // Get skip label
  const buttonText = skipLabel || segment.skipLabel || DEFAULT_SKIP_LABELS[segment.type];
  const displayText = isAutoSkip && countdown !== null 
    ? `${buttonText} (${countdown})`
    : buttonText;

  // Get position classes
  const positionClass = `uvf-skip-button-${position}`;
  const segmentClass = `uvf-skip-${segment.type}`;
  const autoSkipClass = isAutoSkip ? 'auto-skip' : '';
  const countdownClass = isAutoSkip && countdown !== null ? 'countdown' : '';

  // Combine classes
  const buttonClasses = [
    'uvf-skip-button',
    'visible',
    positionClass,
    segmentClass,
    autoSkipClass,
    countdownClass,
    className
  ].filter(Boolean).join(' ');

  // Default styles based on position
  const defaultStyles: React.CSSProperties = {
    position: 'absolute',
    zIndex: 1000,
    ...style
  };

  switch (position) {
    case 'bottom-right':
      Object.assign(defaultStyles, {
        bottom: '100px',
        right: '30px'
      });
      break;
    case 'bottom-left':
      Object.assign(defaultStyles, {
        bottom: '100px',
        left: '30px'
      });
      break;
    case 'top-right':
      Object.assign(defaultStyles, {
        top: '30px',
        right: '30px'
      });
      break;
    case 'top-left':
      Object.assign(defaultStyles, {
        top: '30px',
        left: '30px'
      });
      break;
  }

  return (
    <button
      type="button"
      className={buttonClasses}
      style={defaultStyles}
      onClick={handleSkip}
      aria-label={`${buttonText} - ${segment.title || segment.type}`}
    >
      {displayText}
      
      {/* Progress bar for auto-skip countdown */}
      {isAutoSkip && countdown !== null && (
        <div 
          className="uvf-skip-countdown-progress"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '3px',
            backgroundColor: 'currentColor',
            width: `${((autoSkipDelay - countdown) / autoSkipDelay) * 100}%`,
            transition: 'width 1s linear',
            borderRadius: '0 0 6px 6px'
          }}
        />
      )}
    </button>
  );
};
