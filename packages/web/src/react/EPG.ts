// EPG (Electronic Program Guide) exports for the unified video framework

// Main Components
export { default as EPGOverlay } from './components/EPGOverlay';
export { default as EPGTimelineHeader } from './components/EPGTimelineHeader';
export { default as EPGProgramGrid } from './components/EPGProgramGrid';
export { default as EPGNavigationControls } from './components/EPGNavigationControls';
export { default as EPGProgramDetails } from './components/EPGProgramDetails';

// Note: EPG support is now built into the main WebPlayerView component
// Simply pass epg prop to WebPlayerView to enable EPG functionality

// Types and Interfaces
export type {
  EPGData,
  EPGProgram,
  EPGProgramRow,
  EPGAction,
  EPGConfig,
  EPGProps,
  EPGTimeSlot,
  EPGNavigationState,
  EPGContextType,
  EPGComponentProps,
  TimeRange,
  ProgramBlock,
  EPGViewMode,
  EPGSortBy,
  EPGFilterType,
} from './types/EPGTypes';

// Utility Functions
export {
  parseTime,
  formatTime,
  formatDateTime,
  getProgramDuration,
  generateTimeSlots,
  calculateProgramBlock,
  isProgramLive,
  getProgramProgress,
  findProgramAtTime,
  getCurrentTimePosition,
  snapToTimeSlot,
  calculateOptimalTimeRange,
  getProgramsInRange,
  calculateScrollPosition,
  debounce,
  throttle,
} from './utils/EPGUtils';
