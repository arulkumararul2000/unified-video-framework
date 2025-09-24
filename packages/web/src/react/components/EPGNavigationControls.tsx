import React, { useState, useCallback } from 'react';
import type { EPGComponentProps } from '../types/EPGTypes';

interface EPGNavigationControlsProps extends EPGComponentProps {
  onNavigate: (direction: 'left' | 'right' | 'today') => void;
  onTimeRangeChange?: (hours: number) => void;
  canNavigateLeft?: boolean;
  canNavigateRight?: boolean;
  currentTime?: number;
  timelineStart?: number;
  timelineEnd?: number;
  visibleHours?: number;
}

export const EPGNavigationControls: React.FC<EPGNavigationControlsProps> = ({
  onNavigate,
  onTimeRangeChange,
  canNavigateLeft = true,
  canNavigateRight = true,
  currentTime = Date.now(),
  timelineStart,
  timelineEnd,
  visibleHours = 4,
  className = '',
  style = {},
}) => {
  const [isNavigating, setIsNavigating] = useState(false);

  // Handle navigation with loading state
  const handleNavigate = useCallback(async (direction: 'left' | 'right' | 'today') => {
    if (isNavigating) return;
    
    setIsNavigating(true);
    try {
      await onNavigate(direction);
    } finally {
      setTimeout(() => setIsNavigating(false), 300);
    }
  }, [onNavigate, isNavigating]);

  // Handle time range change
  const handleTimeRangeChange = useCallback((hours: number) => {
    if (onTimeRangeChange) {
      onTimeRangeChange(hours);
    }
  }, [onTimeRangeChange]);

  // Format current time range display
  const getTimeRangeDisplay = () => {
    if (!timelineStart || !timelineEnd) return '';
    
    const startDate = new Date(timelineStart);
    const endDate = new Date(timelineEnd);
    const today = new Date();
    
    // Check if it's today
    if (startDate.toDateString() === today.toDateString()) {
      return `Today, ${startDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })} - ${endDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}`;
    }
    
    // Different day
    return `${startDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })}, ${startDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      hour12: true 
    })} - ${endDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      hour12: true 
    })}`;
  };

  return (
    <div
      className={`epg-navigation-controls ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#1a1a1a',
        borderBottom: '1px solid #333',
        height: '56px',
        ...style,
      }}
    >
      {/* Left Section - Time Range Display */}
      <div className="epg-time-range-display">
        <div
          style={{
            color: '#fff',
            fontSize: '16px',
            fontWeight: '600',
            lineHeight: '1.2',
          }}
        >
          {getTimeRangeDisplay()}
        </div>
        {timelineStart && timelineEnd && (
          <div
            style={{
              color: '#888',
              fontSize: '12px',
              lineHeight: '1.2',
              marginTop: '2px',
            }}
          >
            {visibleHours} hour{visibleHours !== 1 ? 's' : ''} view
          </div>
        )}
      </div>

      {/* Center Section - Navigation Controls */}
      <div
        className="epg-navigation-buttons"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Navigate Left Button */}
        <button
          className="epg-nav-button epg-nav-left"
          disabled={!canNavigateLeft || isNavigating}
          onClick={() => handleNavigate('left')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: canNavigateLeft && !isNavigating ? '#2a2a2a' : '#1a1a1a',
            color: canNavigateLeft && !isNavigating ? '#fff' : '#666',
            cursor: canNavigateLeft && !isNavigating ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            fontSize: '16px',
          }}
          onMouseEnter={(e) => {
            if (canNavigateLeft && !isNavigating) {
              e.currentTarget.style.backgroundColor = '#3a3a3a';
            }
          }}
          onMouseLeave={(e) => {
            if (canNavigateLeft && !isNavigating) {
              e.currentTarget.style.backgroundColor = '#2a2a2a';
            }
          }}
        >
          ◀
        </button>

        {/* Go to Current Time Button */}
        <button
          className="epg-nav-button epg-nav-today"
          disabled={isNavigating}
          onClick={() => handleNavigate('today')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '40px',
            padding: '0 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: !isNavigating ? '#ff6b35' : '#cc5528',
            color: '#fff',
            cursor: !isNavigating ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            fontSize: '14px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!isNavigating) {
              e.currentTarget.style.backgroundColor = '#ff8555';
            }
          }}
          onMouseLeave={(e) => {
            if (!isNavigating) {
              e.currentTarget.style.backgroundColor = '#ff6b35';
            }
          }}
        >
          {isNavigating ? '...' : 'NOW'}
        </button>

        {/* Navigate Right Button */}
        <button
          className="epg-nav-button epg-nav-right"
          disabled={!canNavigateRight || isNavigating}
          onClick={() => handleNavigate('right')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: canNavigateRight && !isNavigating ? '#2a2a2a' : '#1a1a1a',
            color: canNavigateRight && !isNavigating ? '#fff' : '#666',
            cursor: canNavigateRight && !isNavigating ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            fontSize: '16px',
          }}
          onMouseEnter={(e) => {
            if (canNavigateRight && !isNavigating) {
              e.currentTarget.style.backgroundColor = '#3a3a3a';
            }
          }}
          onMouseLeave={(e) => {
            if (canNavigateRight && !isNavigating) {
              e.currentTarget.style.backgroundColor = '#2a2a2a';
            }
          }}
        >
          ▶
        </button>
      </div>

      {/* Right Section - View Options */}
      <div
        className="epg-view-options"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Time Range Selector */}
        {onTimeRangeChange && (
          <div className="epg-time-range-selector">
            <label
              style={{
                color: '#888',
                fontSize: '12px',
                marginRight: '8px',
              }}
            >
              View:
            </label>
            <select
              value={visibleHours}
              onChange={(e) => handleTimeRangeChange(Number(e.target.value))}
              style={{
                backgroundColor: '#2a2a2a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value={2}>2 hours</option>
              <option value={4}>4 hours</option>
              <option value={6}>6 hours</option>
              <option value={8}>8 hours</option>
              <option value={12}>12 hours</option>
            </select>
          </div>
        )}

        {/* Current Time Indicator */}
        <div
          className="epg-current-time-badge"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#ff6b35',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#ff6b35',
              animation: 'pulse 2s infinite',
            }}
          />
          {new Date(currentTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default EPGNavigationControls;