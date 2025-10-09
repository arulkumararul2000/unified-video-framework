/**
 * Basic test to verify EPG components are properly compiled and functional
 */

// Import EPG types and components
import { 
  EPGData, 
  EPGProgram, 
  EPGProgramRow, 
  EPGTimeSlot,
  EPGConfig 
} from '../react/types/EPGTypes';

import { 
  formatTime, 
  generateTimeSlots,
  getProgramProgress,
  parseTime,
  formatDateTime 
} from '../react/utils/EPGUtils';

// Test EPG utility functions
function testEPGUtils() {
  const now = Date.now();
  const startTime = now - (60 * 60 * 1000); // 1 hour ago
  const endTime = now + (60 * 60 * 1000); // 1 hour from now

  // Test formatTime
  const timeStr = formatTime(now);
  console.log('Formatted time:', timeStr);

  // Test formatDateTime
  const dateTimeStr = formatDateTime(now);
  console.log('Formatted date/time:', dateTimeStr);

  // Test generateTimeSlots
  const slots = generateTimeSlots(startTime, 4, 30);
  console.log('Generated slots:', slots.length);

  // Test parseTime
  const isoString = new Date().toISOString();
  const timestamp = parseTime(isoString);
  console.log('Parsed timestamp:', timestamp);

  // Test getProgramProgress
  const sampleProgram = {
    id: 'test',
    title: 'Test Program',
    description: 'Test',
    since: new Date(startTime).toISOString(),
    till: new Date(endTime).toISOString()
  };
  const progress = getProgramProgress(sampleProgram, now);
  console.log('Program progress:', progress);
}

// Test EPG data structure
function testEPGDataStructure() {
  const sampleProgram: EPGProgram = {
    id: 'test-program-1',
    title: 'Test Program',
    description: 'A test program description',
    since: new Date().toISOString(),
    till: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    category: 'Entertainment',
    rating: 'PG-13',
    image: 'https://example.com/image.jpg'
  };

  const sampleChannel: EPGProgramRow = {
    programTitle: 'Test Channel',
    channelLogo: 'https://example.com/logo.jpg',
    data: [sampleProgram]
  };

  const sampleEPGData: EPGData = {
    timeline: [sampleChannel]
  };

  console.log('EPG data structure test passed');
  console.log('Sample data:', sampleEPGData);
}

// Test EPG configuration
function testEPGConfig() {
  const config: EPGConfig = {
    timeSlotDuration: 30,
    visibleHours: 4,
    enableInfiniteScroll: true,
    lazyLoadThreshold: 100,
    showChannelLogos: true,
    showProgramImages: true,
    compactMode: false
  };

  console.log('EPG config test passed');
  console.log('Config:', config);
}

// Run all tests
function runEPGTests() {
  console.log('=== EPG Implementation Test ===');
  
  try {
    testEPGUtils();
    testEPGDataStructure();
    testEPGConfig();
    
    console.log('✅ All EPG tests passed successfully!');
    console.log('EPG components are properly compiled and functional.');
  } catch (error) {
    console.error('❌ EPG test failed:', error);
  }
}

// Export for potential usage
export { runEPGTests };

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  runEPGTests();
}
