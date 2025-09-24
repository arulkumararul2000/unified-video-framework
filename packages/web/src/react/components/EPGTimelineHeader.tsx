import React, { useMemo, useRef, useEffect } from 'react';
import type { EPGComponentProps, EPGTimeSlot } from '../types/EPGTypes';
import { generateTimeSlots, getCurrentTimePosition, formatTime } from '../utils/EPGUtils';

interface EPGTimelineHeaderProps extends EPGComponentProps {
  timelineStart: number;
  timelineEnd: number;
  containerWidth: number;
  currentTime?: number;
  visibleHours?: number;
  slotDuration?: number;
  onTimeClick?: (timestamp: number) => void;
}

export const EPGTimelineHeader: React.FC<EPGTimelineHeaderProps> = ({
  timelineStart,
  timelineEnd,
  containerWidth,
  currentTime = Date.now(),
  visibleHours = 4,
  slotDuration = 60,
  onTimeClick,
  className = '',
  style = {},
}) => {
  const headerRef = useRef<HTMLDivElement>(null);

  // Generate time slots for the timeline
  const timeSlots = useMemo(() => {
    return generateTimeSlots(timelineStart, visibleHours, slotDuration);
  }, [timelineStart, visibleHours, slotDuration]);

  // Calculate current time indicator position
  const currentTimePosition = useMemo(() => {
    return getCurrentTimePosition(currentTime, timelineStart, timelineEnd, containerWidth);
  }, [currentTime, timelineStart, timelineEnd, containerWidth]);

  // Handle time slot click
  const handleTimeSlotClick = (timestamp: number) => {
    if (onTimeClick) {
      onTimeClick(timestamp);
    }
  };

  // Auto-scroll to current time when component mounts
  useEffect(() => {
    if (headerRef.current && currentTimePosition > 0) {
      const scrollLeft = Math.max(0, currentTimePosition - (headerRef.current.offsetWidth / 2));
      headerRef.current.scrollTo({
        left: scrollLeft,
        behavior: 'smooth',
      });
    }
  }, [currentTimePosition]);

  return (
    <div
      ref={headerRef}
      className={`epg-timeline-header ${className}`}
      style={{
        position: 'relative',
        height: '60px',
        overflow: 'hidden',
        borderBottom: '1px solid #333',
        backgroundColor: '#1a1a1a',
        ...style,
      }}
    >
      {/* Time Slots Container */}
      <div
        className="epg-timeline-slots"
        style={{
          position: 'relative',
          width: `${containerWidth}px`,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {timeSlots.map((slot, index) => {
          const slotPosition = ((slot.timestamp - timelineStart) / (timelineEnd - timelineStart)) * containerWidth;
          
          return (
            <div
              key={slot.timestamp}
              className="epg-time-slot"
              style={{
                position: 'absolute',
                left: `${slotPosition}px`,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                cursor: 'pointer',
                paddingLeft: '8px',
                minWidth: '80px',
                borderLeft: index > 0 ? '1px solid #333' : 'none',
              }}
              onClick={() => handleTimeSlotClick(slot.timestamp)}
            >
              {/* Time Label */}
              <div
                className="epg-time-label"
                style={{
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  lineHeight: '1.2',
                }}
              >
                {slot.label}
              </div>
              
              {/* Date info for first slot or midnight */}
              {(index === 0 || slot.hour === 0) && (
                <div
                  className="epg-date-label"
                  style={{
                    color: '#888',
                    fontSize: '11px',
                    lineHeight: '1.2',
                    marginTop: '2px',
                  }}
                >
                  {new Date(slot.timestamp).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Current Time Indicator */}
        {currentTimePosition > 0 && (
          <div
            className="epg-current-time-indicator"
            style={{
              position: 'absolute',
              left: `${currentTimePosition}px`,
              top: '0',
              bottom: '0',
              width: '2px',
              backgroundColor: '#ff6b35',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            {/* Current Time Badge */}
            <div
              style={{
                position: 'absolute',
                top: '8px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#ff6b35',
                color: '#fff',
                fontSize: '10px',
                fontWeight: '600',
                padding: '2px 6px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              NOW
            </div>
            
            {/* Current Time Value */}
            <div
              style={{
                position: 'absolute',
                bottom: '8px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#ff6b35',
                color: '#fff',
                fontSize: '10px',
                fontWeight: '600',
                padding: '2px 6px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {formatTime(currentTime)}
            </div>
          </div>
        )}

        {/* Hour Grid Lines */}
        {timeSlots.map((slot, index) => {
          if (index === 0) return null; // Skip first line
          
          const linePosition = ((slot.timestamp - timelineStart) / (timelineEnd - timelineStart)) * containerWidth;
          
          return (
            <div
              key={`grid-${slot.timestamp}`}
              className="epg-grid-line"
              style={{
                position: 'absolute',
                left: `${linePosition}px`,
                top: '0',
                bottom: '0',
                width: '1px',
                backgroundColor: '#333',
                opacity: 0.5,
                pointerEvents: 'none',
              }}
            />
          );
        })}
      </div>

      {/* Gradient Fade for Overflow */}
      <div
        className="epg-timeline-fade-left"
        style={{
          position: 'absolute',
          left: '0',
          top: '0',
          bottom: '0',
          width: '20px',
          background: 'linear-gradient(to right, #1a1a1a, transparent)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
      <div
        className="epg-timeline-fade-right"
        style={{
          position: 'absolute',
          right: '0',
          top: '0',
          bottom: '0',
          width: '20px',
          background: 'linear-gradient(to left, #1a1a1a, transparent)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
    </div>
  );
};

export default EPGTimelineHeader;