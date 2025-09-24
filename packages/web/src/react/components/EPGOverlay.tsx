import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { EPGProps, EPGProgram, EPGProgramRow, EPGAction, EPGNavigationState, EPGConfig } from '../types/EPGTypes';
import { 
  calculateOptimalTimeRange, 
  calculateScrollPosition,
  debounce,
  getProgramsInRange 
} from '../utils/EPGUtils';
import EPGNavigationControls from './EPGNavigationControls';
import EPGTimelineHeader from './EPGTimelineHeader';
import EPGProgramGrid from './EPGProgramGrid';
import EPGProgramDetails from './EPGProgramDetails';

const DEFAULT_CONFIG: EPGConfig = {
  timeSlotDuration: 60, // 1 hour
  visibleHours: 4,
  enableInfiniteScroll: true,
  lazyLoadThreshold: 200,
  showChannelLogos: true,
  showProgramImages: true,
  compactMode: false,
};

interface EPGOverlayState {
  selectedProgram: EPGProgram | null;
  selectedChannel: EPGProgramRow | null;
  timelineStart: number;
  timelineEnd: number;
  containerWidth: number;
  visibleHours: number;
  currentTime: number;
  isLoading: boolean;
  error: string | null;
}

export const EPGOverlay: React.FC<EPGProps> = ({
  data,
  config: userConfig = {},
  visible = true,
  onToggle,
  className = '',
  style = {},
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  
  // Merge user config with defaults
  const config = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...userConfig,
  }), [userConfig]);

  // Initialize state
  const [state, setState] = useState<EPGOverlayState>(() => {
    const currentTime = Date.now();
    const { start, end } = calculateOptimalTimeRange(currentTime, config.visibleHours);
    
    return {
      selectedProgram: null,
      selectedChannel: null,
      timelineStart: start,
      timelineEnd: end,
      containerWidth: 2400, // 4 hours * 600px per hour
      visibleHours: config.visibleHours,
      currentTime,
      isLoading: false,
      error: null,
    };
  });

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        currentTime: Date.now(),
      }));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Calculate container width based on visible hours
  const containerWidth = useMemo(() => {
    return state.visibleHours * 600; // 600px per hour
  }, [state.visibleHours]);

  // Filter programs for current time range
  const filteredData = useMemo(() => {
    if (!data?.timeline) return [];
    
    return getProgramsInRange(
      data.timeline,
      state.timelineStart,
      state.timelineEnd,
      1 // 1 hour padding
    );
  }, [data?.timeline, state.timelineStart, state.timelineEnd]);

  // Handle navigation
  const handleNavigate = useCallback(async (direction: 'left' | 'right' | 'today') => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      let newStart: number;
      let newEnd: number;

      if (direction === 'today') {
        const { start, end } = calculateOptimalTimeRange(Date.now(), state.visibleHours);
        newStart = start;
        newEnd = end;
      } else {
        const timeShift = state.visibleHours * 60 * 60 * 1000; // Convert hours to ms
        if (direction === 'left') {
          newStart = state.timelineStart - timeShift;
          newEnd = state.timelineEnd - timeShift;
        } else {
          newStart = state.timelineStart + timeShift;
          newEnd = state.timelineEnd + timeShift;
        }
      }

      setState(prev => ({
        ...prev,
        timelineStart: newStart,
        timelineEnd: newEnd,
        containerWidth: prev.visibleHours * 600,
        isLoading: false,
      }));

      // Trigger re-render
      setUpdateTrigger(prev => prev + 1);

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Navigation failed',
        isLoading: false,
      }));
    }
  }, [state.visibleHours, state.timelineStart, state.timelineEnd]);

  // Handle time range change
  const handleTimeRangeChange = useCallback((hours: number) => {
    const { start, end } = calculateOptimalTimeRange(state.currentTime, hours);
    
    setState(prev => ({
      ...prev,
      visibleHours: hours,
      timelineStart: start,
      timelineEnd: end,
      containerWidth: hours * 600,
    }));

    setUpdateTrigger(prev => prev + 1);
  }, [state.currentTime]);

  // Handle program selection
  const handleProgramSelect = useCallback((program: EPGProgram, channel: EPGProgramRow) => {
    setState(prev => ({
      ...prev,
      selectedProgram: program,
      selectedChannel: channel,
    }));

    // Call user callback if provided
    if (config.onProgramSelect) {
      config.onProgramSelect(program, channel);
    }
  }, [config]);

  // Handle channel selection
  const handleChannelSelect = useCallback((channel: EPGProgramRow) => {
    setState(prev => ({
      ...prev,
      selectedChannel: channel,
    }));

    // Call user callback if provided
    if (config.onChannelSelect) {
      config.onChannelSelect(channel);
    }
  }, [config]);

  // Handle program actions
  const handleAction = useCallback(async (action: EPGAction) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      switch (action.type) {
        case 'favorite':
          if (config.onFavorite) {
            await config.onFavorite(action.program, action.channel);
          }
          break;
        case 'record':
          if (config.onRecord) {
            await config.onRecord(action.program, action.channel);
          }
          break;
        case 'reminder':
          if (config.onSetReminder) {
            await config.onSetReminder(action.program, action.channel);
          }
          break;
        case 'catchup':
          if (config.onCatchup) {
            await config.onCatchup(action.program, action.channel);
          }
          break;
      }

      // Update program state optimistically
      if (filteredData && state.selectedProgram) {
        const updatedProgram = { ...state.selectedProgram };
        switch (action.type) {
          case 'favorite':
            updatedProgram.isFavorite = !updatedProgram.isFavorite;
            break;
          case 'record':
            updatedProgram.isRecording = !updatedProgram.isRecording;
            break;
          case 'reminder':
            updatedProgram.hasReminder = !updatedProgram.hasReminder;
            break;
        }

        setState(prev => ({
          ...prev,
          selectedProgram: updatedProgram,
          isLoading: false,
        }));
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Action failed',
        isLoading: false,
      }));
    }
  }, [config, filteredData, state.selectedProgram]);

  // Handle time slot click
  const handleTimeClick = useCallback((timestamp: number) => {
    const newStart = timestamp - (state.visibleHours * 30 * 60 * 1000); // Center the clicked time
    const newEnd = newStart + (state.visibleHours * 60 * 60 * 1000);
    
    setState(prev => ({
      ...prev,
      timelineStart: newStart,
      timelineEnd: newEnd,
    }));

    setUpdateTrigger(prev => prev + 1);
  }, [state.visibleHours]);

  // Handle close program details
  const handleCloseDetails = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedProgram: null,
    }));
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!visible) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handleNavigate('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNavigate('right');
          break;
        case 'Home':
          e.preventDefault();
          handleNavigate('today');
          break;
        case 'Escape':
          if (state.selectedProgram) {
            e.preventDefault();
            handleCloseDetails();
          }
          break;
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleKeyPress);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [visible, handleNavigate, handleCloseDetails, state.selectedProgram]);

  // Don't render if not visible
  if (!visible) return null;

  // Calculate navigation state
  const canNavigateLeft = true; // Always allow navigation to past
  const canNavigateRight = true; // Always allow navigation to future

  return (
    <div
      ref={overlayRef}
      className={`epg-overlay ${className}`}
      style={{
        position: 'fixed',
        top: '35%', // Video player takes 30-40% height
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0a0a0a',
        color: '#fff',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Navigation Controls */}
      <EPGNavigationControls
        onNavigate={handleNavigate}
        onTimeRangeChange={handleTimeRangeChange}
        canNavigateLeft={canNavigateLeft}
        canNavigateRight={canNavigateRight}
        currentTime={state.currentTime}
        timelineStart={state.timelineStart}
        timelineEnd={state.timelineEnd}
        visibleHours={state.visibleHours}
      />

      {/* Timeline Header */}
      <EPGTimelineHeader
        timelineStart={state.timelineStart}
        timelineEnd={state.timelineEnd}
        containerWidth={containerWidth}
        currentTime={state.currentTime}
        visibleHours={state.visibleHours}
        slotDuration={config.timeSlotDuration}
        onTimeClick={handleTimeClick}
      />

      {/* Main Content Area */}
      <div
        className="epg-main-content"
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Program Grid */}
        <EPGProgramGrid
          data={filteredData}
          timelineStart={state.timelineStart}
          timelineEnd={state.timelineEnd}
          containerWidth={containerWidth}
          currentTime={state.currentTime}
          selectedProgram={state.selectedProgram}
          onProgramSelect={handleProgramSelect}
          onChannelSelect={handleChannelSelect}
          channelHeight={80}
          visibleChannels={6}
          style={{ flex: 1 }}
        />

        {/* Program Details Panel */}
        {state.selectedProgram && (
          <div
            className="epg-details-panel"
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              width: '400px',
              maxHeight: '60%',
              zIndex: 200,
              animation: 'slideInRight 0.3s ease-out',
            }}
          >
            <EPGProgramDetails
              program={state.selectedProgram}
              channel={state.selectedChannel || undefined}
              onClose={handleCloseDetails}
              onAction={handleAction}
              isModal={false}
              currentTime={state.currentTime}
            />
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {state.isLoading && (
        <div
          className="epg-loading-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
          }}
        >
          <div
            style={{
              color: '#fff',
              fontSize: '18px',
              fontWeight: '600',
            }}
          >
            Loading...
          </div>
        </div>
      )}

      {/* Error Message */}
      {state.error && (
        <div
          className="epg-error-message"
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#e74c3c',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 400,
            maxWidth: '400px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)',
          }}
        >
          {state.error}
          <button
            onClick={() => setState(prev => ({ ...prev, error: null }))}
            style={{
              marginLeft: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Animation Styles */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .epg-overlay * {
          box-sizing: border-box;
        }
        
        .epg-overlay::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .epg-overlay::-webkit-scrollbar-track {
          background: #1a1a1a;
        }
        
        .epg-overlay::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 4px;
        }
        
        .epg-overlay::-webkit-scrollbar-thumb:hover {
          background: #666;
        }
      `}</style>
    </div>
  );
};

export default EPGOverlay;