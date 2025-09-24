/**
 * Basic test script for EPG components
 */

// Import the compiled EPG utilities
const EPGUtils = require('./dist/react/utils/EPGUtils');
const EPGTypes = require('./dist/react/types/EPGTypes');

console.log('=== EPG Implementation Test ===');

try {
  // Test utilities
  console.log('Testing EPG utilities...');
  
  const now = Date.now();
  const timeStr = EPGUtils.formatTime(now);
  console.log('Formatted time:', timeStr);
  
  const dateStr = EPGUtils.formatDateTime(now);
  console.log('Formatted date/time:', dateStr);
  
  // Test data structures
  console.log('\nTesting EPG data structures...');
  
  const startTime = now - 60 * 60 * 1000; // 1 hour ago
  const endTime = now + 60 * 60 * 1000;   // 1 hour ahead
  
  const sampleProgram = {
    id: 'test-program-1',
    title: 'Test Program',
    description: 'A test program description',
    since: new Date(startTime).toISOString(),
    till: new Date(endTime).toISOString(),
    category: 'Entertainment',
    rating: 'PG-13'
  };
  
  const progress = EPGUtils.getProgramProgress(sampleProgram, now);
  console.log('Program progress:', progress.toFixed(2) + '%');
  
  // Check that compiled files exist
  console.log('\nVerifying compiled files...');
  const fs = require('fs');
  console.log('- EPG.js exists:', fs.existsSync('./dist/react/EPG.js'));
  console.log('- EPGOverlay.js exists:', fs.existsSync('./dist/react/components/EPGOverlay.js'));
  console.log('- EPGProgramGrid.js exists:', fs.existsSync('./dist/react/components/EPGProgramGrid.js'));
  console.log('- EPGTimelineHeader.js exists:', fs.existsSync('./dist/react/components/EPGTimelineHeader.js'));
  console.log('- EPGProgramDetails.js exists:', fs.existsSync('./dist/react/components/EPGProgramDetails.js'));
  console.log('- EPGNavigationControls.js exists:', fs.existsSync('./dist/react/components/EPGNavigationControls.js'));
  console.log('- WebPlayerView.js exists:', fs.existsSync('./dist/react/WebPlayerView.js'));
  
  console.log('\n✅ EPG test completed successfully!');
} catch (error) {
  console.error('❌ EPG test failed:', error);
}