// EPG utility functions for time calculations and formatting

import type { EPGProgram, EPGTimeSlot, TimeRange, ProgramBlock, EPGProgramRow } from '../types/EPGTypes';

/**
 * Convert ISO date string to timestamp
 */
export const parseTime = (isoString: string): number => {
  return new Date(isoString).getTime();
};

/**
 * Format timestamp to readable time string
 */
export const formatTime = (timestamp: number, format: '12h' | '24h' = '12h'): string => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  if (format === '24h') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

/**
 * Format date with time
 */
export const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Check if it's today
  if (date.toDateString() === today.toDateString()) {
    return `Today ${formatTime(timestamp)}`;
  }
  
  // Check if it's tomorrow
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${formatTime(timestamp)}`;
  }
  
  // Otherwise, show full date
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  
  return date.toLocaleDateString('en-US', options);
};

/**
 * Calculate program duration in minutes
 */
export const getProgramDuration = (program: EPGProgram): number => {
  const start = parseTime(program.since);
  const end = parseTime(program.till);
  return Math.round((end - start) / (1000 * 60)); // Convert to minutes
};

/**
 * Generate time slots for the timeline header
 */
export const generateTimeSlots = (
  startTime: number,
  visibleHours: number,
  slotDuration: number = 60 // minutes
): EPGTimeSlot[] => {
  const slots: EPGTimeSlot[] = [];
  const slotMs = slotDuration * 60 * 1000;
  
  // Round start time to nearest slot boundary
  const roundedStart = Math.floor(startTime / slotMs) * slotMs;
  
  for (let i = 0; i <= visibleHours; i++) {
    const timestamp = roundedStart + (i * slotMs);
    const date = new Date(timestamp);
    const hour = date.getHours();
    
    slots.push({
      hour,
      label: formatTime(timestamp),
      timestamp,
    });
  }
  
  return slots;
};

/**
 * Calculate program block position and width
 */
export const calculateProgramBlock = (
  program: EPGProgram,
  channel: EPGProgramRow,
  timelineStart: number,
  timelineEnd: number,
  containerWidth: number,
  channelHeight: number = 80
): ProgramBlock | null => {
  const programStart = parseTime(program.since);
  const programEnd = parseTime(program.till);
  
  // Skip programs outside visible timeline
  if (programEnd <= timelineStart || programStart >= timelineEnd) {
    return null;
  }
  
  // Calculate visible portion of the program
  const visibleStart = Math.max(programStart, timelineStart);
  const visibleEnd = Math.min(programEnd, timelineEnd);
  const visibleDuration = visibleEnd - visibleStart;
  const totalTimelineRange = timelineEnd - timelineStart;
  
  // Calculate dimensions
  const width = Math.max(10, (visibleDuration / totalTimelineRange) * containerWidth);
  const left = ((visibleStart - timelineStart) / totalTimelineRange) * containerWidth;
  
  return {
    program,
    channel,
    start: programStart,
    end: programEnd,
    duration: programEnd - programStart,
    width,
    left,
  };
};

/**
 * Check if program is currently live
 */
export const isProgramLive = (program: EPGProgram, currentTime: number = Date.now()): boolean => {
  const start = parseTime(program.since);
  const end = parseTime(program.till);
  return currentTime >= start && currentTime < end;
};

/**
 * Get program progress percentage (0-100)
 */
export const getProgramProgress = (program: EPGProgram, currentTime: number = Date.now()): number => {
  const start = parseTime(program.since);
  const end = parseTime(program.till);
  
  if (currentTime < start) return 0;
  if (currentTime >= end) return 100;
  
  return ((currentTime - start) / (end - start)) * 100;
};

/**
 * Find program at specific time for a channel
 */
export const findProgramAtTime = (channel: EPGProgramRow, timestamp: number): EPGProgram | null => {
  return channel.data.find(program => {
    const start = parseTime(program.since);
    const end = parseTime(program.till);
    return timestamp >= start && timestamp < end;
  }) || null;
};

/**
 * Get current time position in pixels
 */
export const getCurrentTimePosition = (
  currentTime: number,
  timelineStart: number,
  timelineEnd: number,
  containerWidth: number
): number => {
  if (currentTime < timelineStart || currentTime > timelineEnd) {
    return -1; // Outside visible range
  }
  
  const totalRange = timelineEnd - timelineStart;
  const elapsed = currentTime - timelineStart;
  return (elapsed / totalRange) * containerWidth;
};

/**
 * Snap time to nearest slot boundary
 */
export const snapToTimeSlot = (timestamp: number, slotDuration: number = 60): number => {
  const slotMs = slotDuration * 60 * 1000;
  return Math.round(timestamp / slotMs) * slotMs;
};

/**
 * Calculate optimal timeline range for current time
 */
export const calculateOptimalTimeRange = (
  currentTime: number = Date.now(),
  visibleHours: number = 4
): { start: number; end: number } => {
  const currentHour = new Date(currentTime);
  currentHour.setMinutes(0, 0, 0);
  
  // Start 1 hour before current time, show visibleHours total
  const start = currentHour.getTime() - (60 * 60 * 1000);
  const end = start + (visibleHours * 60 * 60 * 1000);
  
  return { start, end };
};

/**
 * Get programs for time range with padding
 */
export const getProgramsInRange = (
  channels: EPGProgramRow[],
  startTime: number,
  endTime: number,
  paddingHours: number = 1
): EPGProgramRow[] => {
  const paddingMs = paddingHours * 60 * 60 * 1000;
  const extendedStart = startTime - paddingMs;
  const extendedEnd = endTime + paddingMs;
  
  return channels.map(channel => ({
    ...channel,
    data: channel.data.filter(program => {
      const programStart = parseTime(program.since);
      const programEnd = parseTime(program.till);
      
      // Include programs that overlap with extended range
      return programEnd > extendedStart && programStart < extendedEnd;
    }),
  }));
};

/**
 * Calculate scroll position for time
 */
export const calculateScrollPosition = (
  targetTime: number,
  timelineStart: number,
  timelineEnd: number,
  containerWidth: number,
  visibleWidth: number
): number => {
  const timelineRange = timelineEnd - timelineStart;
  const targetPosition = ((targetTime - timelineStart) / timelineRange) * containerWidth;
  
  // Center the target time in visible area
  return Math.max(0, targetPosition - (visibleWidth / 2));
};

/**
 * Debounce function for scroll events
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function for frequent events
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};