// EPG (Electronic Program Guide) TypeScript interfaces for the unified video framework

export interface EPGProgram {
  id: number | string;
  title: string;
  description: string;
  since: string; // ISO date string
  till: string; // ISO date string
  image?: string;
  category?: string;
  rating?: string;
  isFavorite?: boolean;
  isRecording?: boolean;
  hasReminder?: boolean;
  hasCatchup?: boolean;
  metadata?: Record<string, any>;
}

export interface EPGProgramRow {
  programTitle: string;
  channelLogo?: string;
  channelId?: string | number;
  data: EPGProgram[];
}

export interface EPGData {
  timeline: EPGProgramRow[];
}

export interface EPGTimeSlot {
  hour: number;
  label: string;
  timestamp: number;
}

export interface EPGAction {
  type: 'favorite' | 'record' | 'reminder' | 'catchup';
  program: EPGProgram;
  channel: EPGProgramRow;
}

export interface EPGNavigationState {
  currentTimeOffset: number;
  visibleTimeRange: {
    start: number;
    end: number;
  };
  scrollPosition: {
    horizontal: number;
    vertical: number;
  };
}

export interface EPGConfig {
  // Timeline configuration
  timeSlotDuration: number; // in minutes (default: 60)
  visibleHours: number; // number of hours visible at once (default: 4)
  
  // Scrolling configuration
  enableInfiniteScroll: boolean;
  lazyLoadThreshold: number; // in pixels
  
  // UI configuration
  showChannelLogos: boolean;
  showProgramImages: boolean;
  compactMode: boolean;
  
  // Action handlers
  onFavorite?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
  onRecord?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
  onSetReminder?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
  onCatchup?: (program: EPGProgram, channel: EPGProgramRow) => void | Promise<void>;
  onProgramSelect?: (program: EPGProgram, channel: EPGProgramRow) => void;
  onChannelSelect?: (channel: EPGProgramRow) => void;
}

export interface EPGProps {
  data: EPGData;
  config?: Partial<EPGConfig>;
  visible?: boolean;
  onToggle?: (visible: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface EPGContextType {
  epgData: EPGData | null;
  config: EPGConfig;
  navigation: EPGNavigationState;
  selectedProgram: EPGProgram | null;
  currentTime: number;
  
  // Actions
  selectProgram: (program: EPGProgram | null, channel?: EPGProgramRow) => void;
  navigateTime: (direction: 'left' | 'right' | 'today') => void;
  scrollTo: (time: number) => void;
  executeAction: (action: EPGAction) => void | Promise<void>;
  
  // UI state
  isLoading: boolean;
  error: string | null;
}

export interface EPGComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

// Utility types for time calculations
export interface TimeRange {
  start: number;
  end: number;
  duration: number;
}

export interface ProgramBlock extends TimeRange {
  program: EPGProgram;
  channel: EPGProgramRow;
  width: number; // calculated width in pixels
  left: number; // calculated left position in pixels
}

export type EPGViewMode = 'grid' | 'list' | 'compact';
export type EPGSortBy = 'time' | 'channel' | 'category' | 'rating';
export type EPGFilterType = 'all' | 'favorites' | 'recordings' | 'reminders' | 'category';
