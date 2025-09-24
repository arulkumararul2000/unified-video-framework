import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { EPGComponentProps, EPGProgramRow, EPGProgram, ProgramBlock } from '../types/EPGTypes';
import { 
  calculateProgramBlock, 
  isProgramLive, 
  getProgramProgress, 
  formatTime,
  formatDateTime,
  throttle 
} from '../utils/EPGUtils';

interface EPGProgramGridProps extends EPGComponentProps {
  data: EPGProgramRow[];
  timelineStart: number;
  timelineEnd: number;
  containerWidth: number;
  currentTime?: number;
  selectedProgram?: EPGProgram | null;
  onProgramSelect?: (program: EPGProgram, channel: EPGProgramRow) => void;
  onChannelSelect?: (channel: EPGProgramRow) => void;
  onTimelineScroll?: (scrollLeft: number) => void;
  timelineScrollLeft?: number;
  channelHeight?: number;
  visibleChannels?: number;
}

interface ProgramBlockComponentProps {
  block: ProgramBlock;
  isSelected: boolean;
  isLive: boolean;
  progress: number;
  onClick: () => void;
  channelHeight: number;
}

const ProgramBlockComponent: React.FC<ProgramBlockComponentProps> = ({
  block,
  isSelected,
  isLive,
  progress,
  onClick,
  channelHeight,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <div
      className={`epg-program-block ${isSelected ? 'selected' : ''} ${isLive ? 'live' : ''}`}
      style={{
        position: 'absolute',
        left: `${block.left}px`,
        width: `${block.width}px`,
        height: `${channelHeight - 4}px`,
        top: '2px',
        backgroundColor: isLive ? '#ff6b35' : isSelected ? '#4a90e2' : '#2a2a2a',
        border: `1px solid ${isSelected ? '#4a90e2' : isLive ? '#ff6b35' : '#444'}`,
        borderRadius: '4px',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
        zIndex: isSelected ? 10 : isHovered ? 8 : isLive ? 5 : 1,
        boxShadow: isSelected || isHovered 
          ? '0 4px 8px rgba(0,0,0,0.3)' 
          : '0 1px 3px rgba(0,0,0,0.2)',
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Progress Bar for Live Programs */}
      {isLive && progress > 0 && (
        <div
          className="epg-program-progress"
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            height: '2px',
            width: `${progress}%`,
            backgroundColor: '#fff',
            transition: 'width 0.3s ease',
          }}
        />
      )}
      
      {/* Program Content */}
      <div
        style={{
          padding: '4px 8px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          color: isLive || isSelected ? '#fff' : '#e0e0e0',
        }}
      >
        {/* Program Title */}
        <div
          className="epg-program-title"
          style={{
            fontSize: block.width > 120 ? '13px' : '11px',
            fontWeight: '600',
            lineHeight: '1.2',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '2px',
          }}
        >
          {block.program.title}
        </div>
        
        {/* Program Time */}
        {block.width > 80 && (
          <div
            className="epg-program-time"
            style={{
              fontSize: '10px',
              opacity: 0.8,
              lineHeight: '1.2',
            }}
          >
            {formatTime(block.start)} - {formatTime(block.end)}
          </div>
        )}
        
        {/* Program Category/Rating */}
        {block.width > 160 && (block.program.category || block.program.rating) && (
          <div
            className="epg-program-meta"
            style={{
              fontSize: '9px',
              opacity: 0.7,
              marginTop: 'auto',
              display: 'flex',
              gap: '4px',
            }}
          >
            {block.program.category && (
              <span className="category">{block.program.category}</span>
            )}
            {block.program.rating && (
              <span className="rating">{block.program.rating}</span>
            )}
          </div>
        )}
        
        {/* Live Indicator */}
        {isLive && (
          <div
            className="epg-live-indicator"
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              fontSize: '8px',
              fontWeight: '700',
              color: '#fff',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              padding: '1px 4px',
              borderRadius: '2px',
              letterSpacing: '0.5px',
            }}
          >
            LIVE
          </div>
        )}
      </div>
    </div>
  );
};

export const EPGProgramGrid: React.FC<EPGProgramGridProps> = ({
  data,
  timelineStart,
  timelineEnd,
  containerWidth,
  currentTime = Date.now(),
  selectedProgram,
  onProgramSelect,
  onChannelSelect,
  onTimelineScroll,
  timelineScrollLeft = 0,
  channelHeight = 80,
  visibleChannels = 6,
  className = '',
  style = {},
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const channelNamesRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Calculate visible program blocks
  const programBlocks = useMemo(() => {
    const blocks: Map<string, ProgramBlock[]> = new Map();
    
    data.forEach(channel => {
      const channelBlocks: ProgramBlock[] = [];
      
      channel.data.forEach(program => {
        const block = calculateProgramBlock(
          program,
          channel,
          timelineStart,
          timelineEnd,
          containerWidth,
          channelHeight
        );
        
        if (block) {
          channelBlocks.push(block);
        }
      });
      
      blocks.set(channel.programTitle, channelBlocks);
    });
    
    return blocks;
  }, [data, timelineStart, timelineEnd, containerWidth, channelHeight]);

  // Handle program selection
  const handleProgramSelect = useCallback((program: EPGProgram, channel: EPGProgramRow) => {
    if (onProgramSelect) {
      onProgramSelect(program, channel);
    }
  }, [onProgramSelect]);

  // Handle channel selection
  const handleChannelSelect = useCallback((channel: EPGProgramRow) => {
    if (onChannelSelect) {
      onChannelSelect(channel);
    }
  }, [onChannelSelect]);

  // Enhanced scroll handler for both vertical and horizontal scrolling
  const handleScroll = useMemo(
    () => throttle((e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      setScrollTop(target.scrollTop);
      setScrollLeft(target.scrollLeft);
      
      // Notify parent about horizontal scroll for timeline sync
      if (onTimelineScroll) {
        onTimelineScroll(target.scrollLeft);
      }
    }, 16),
    [onTimelineScroll]
  );
  
  // Sync channel names scroll with grid scroll
  useEffect(() => {
    if (channelNamesRef.current) {
      const channelNamesContainer = channelNamesRef.current.querySelector('.epg-channel-names-content');
      if (channelNamesContainer) {
        (channelNamesContainer as HTMLElement).style.transform = `translateY(-${scrollTop}px)`;
      }
    }
  }, [scrollTop]);
  
  // Sync program grid horizontal scroll with timeline
  useEffect(() => {
    if (gridRef.current && timelineScrollLeft !== undefined) {
      gridRef.current.scrollLeft = timelineScrollLeft;
    }
  }, [timelineScrollLeft]);

  // Calculate which channels are visible
  const visibleChannelRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / channelHeight);
    const endIndex = Math.min(
      startIndex + visibleChannels + 2, // Buffer for smooth scrolling
      data.length
    );
    
    return { startIndex, endIndex };
  }, [scrollTop, channelHeight, visibleChannels, data.length]);

  return (
    <div
      className={`epg-program-grid ${className}`}
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        ...style,
      }}
    >
      {/* Channel Names Column */}
      <div
        ref={channelNamesRef}
        className="epg-channel-names"
        style={{
          position: 'absolute',
          left: '0',
          top: '0',
          bottom: '0',
          width: '200px',
          backgroundColor: '#1a1a1a',
          borderRight: '1px solid #333',
          zIndex: 10,
          overflow: 'hidden',
        }}
      >
        <div
          className="epg-channel-names-content"
          style={{
            height: `${data.length * channelHeight}px`,
            position: 'relative',
          }}
        >
          {data.slice(visibleChannelRange.startIndex, visibleChannelRange.endIndex).map((channel, index) => {
            const actualIndex = visibleChannelRange.startIndex + index;
            
            return (
              <div
                key={channel.programTitle}
                className="epg-channel-name"
                style={{
                  position: 'absolute',
                  top: `${actualIndex * channelHeight}px`,
                  left: '0',
                  right: '0',
                  height: `${channelHeight}px`,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  borderBottom: '1px solid #333',
                  cursor: 'pointer',
                  backgroundColor: '#1a1a1a',
                  transition: 'background-color 0.2s ease',
                }}
                onClick={() => handleChannelSelect(channel)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2a2a2a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a1a1a';
                }}
              >
                {/* Channel Logo */}
                {channel.channelLogo && (
                  <img
                    src={channel.channelLogo}
                    alt={channel.programTitle}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      marginRight: '8px',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                
                {/* Channel Title */}
                <div
                  style={{
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {channel.programTitle}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Programs Grid */}
      <div
        ref={gridRef}
        className="epg-programs-container"
        style={{
          position: 'absolute',
          left: '200px',
          top: '0',
          right: '0',
          bottom: '0',
          overflow: 'auto',
        }}
        onScroll={handleScroll}
      >
        <div
          className="epg-programs-grid"
          style={{
            position: 'relative',
            width: `${containerWidth}px`,
            height: `${data.length * channelHeight}px`,
          }}
        >
          {/* Horizontal Grid Lines (Channel separators) */}
          {data.map((_, index) => (
            <div
              key={`h-grid-line-${index}`}
              style={{
                position: 'absolute',
                top: `${(index + 1) * channelHeight}px`,
                left: '0',
                right: '0',
                height: '1px',
                backgroundColor: '#333',
                opacity: 0.5,
              }}
            />
          ))}
          
          {/* Vertical Grid Lines (Time slots) */}
          {(() => {
            const lines = [];
            const timeRange = timelineEnd - timelineStart;
            const slotDuration = 60 * 60 * 1000; // 1 hour in milliseconds
            const numSlots = Math.ceil(timeRange / slotDuration);
            
            for (let i = 0; i <= numSlots; i++) {
              const lineTime = timelineStart + (i * slotDuration);
              const linePosition = ((lineTime - timelineStart) / timeRange) * containerWidth;
              
              lines.push(
                <div
                  key={`v-grid-line-${i}`}
                  style={{
                    position: 'absolute',
                    left: `${linePosition}px`,
                    top: '0',
                    bottom: '0',
                    width: '1px',
                    backgroundColor: '#333',
                    opacity: 0.3,
                  }}
                />
              );
            }
            return lines;
          })()}

          {/* Program Blocks */}
          {data.slice(visibleChannelRange.startIndex, visibleChannelRange.endIndex).map((channel, index) => {
            const actualIndex = visibleChannelRange.startIndex + index;
            const channelBlocks = programBlocks.get(channel.programTitle) || [];
            
            return (
              <div
                key={channel.programTitle}
                className="epg-channel-programs"
                style={{
                  position: 'absolute',
                  top: `${actualIndex * channelHeight}px`,
                  left: '0',
                  right: '0',
                  height: `${channelHeight}px`,
                }}
              >
                {channelBlocks.map((block, blockIndex) => {
                  const isSelected = selectedProgram?.id === block.program.id;
                  const isLive = isProgramLive(block.program, currentTime);
                  const progress = isLive ? getProgramProgress(block.program, currentTime) : 0;
                  
                  return (
                    <ProgramBlockComponent
                      key={`${block.program.id}-${blockIndex}`}
                      block={block}
                      isSelected={isSelected}
                      isLive={isLive}
                      progress={progress}
                      channelHeight={channelHeight}
                      onClick={() => handleProgramSelect(block.program, channel)}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Current Time Line */}
          {currentTime >= timelineStart && currentTime <= timelineEnd && (
            <div
              className="epg-current-time-line"
              style={{
                position: 'absolute',
                left: `${((currentTime - timelineStart) / (timelineEnd - timelineStart)) * containerWidth}px`,
                top: '0',
                bottom: '0',
                width: '2px',
                backgroundColor: '#ff6b35',
                zIndex: 20,
                pointerEvents: 'none',
                boxShadow: '0 0 4px rgba(255, 107, 53, 0.5)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default EPGProgramGrid;