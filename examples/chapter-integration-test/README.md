# Chapter Integration Test

This example demonstrates the integration of the core ChapterManager with the WebPlayer in the Unified Video Framework.

## Features Tested

### Core Chapter Functionality
- **Chapter Management**: Loading, navigating, and tracking chapters
- **Segment Management**: Handling sponsor segments, intros, credits, etc.
- **Event System**: Emitting and handling chapter/segment events
- **Time-based Processing**: Automatic chapter/segment detection during playback

### Integration Features
- **Dual Manager System**: Core ChapterManager works alongside web-specific chapter features
- **Event Bridging**: Core chapter events are properly emitted through the WebPlayer
- **API Exposure**: Core chapter methods are available through the WebPlayer public API

## How to Use

1. **Open the Test Page**: Load `index.html` in a web browser
2. **Initialize Player**: The player initializes automatically with sample chapter data
3. **Load Video**: Click "Load Video" to load a sample video file
4. **Test Chapter Features**:
   - Navigate between chapters using Previous/Next buttons
   - Click on chapters in the list to jump to specific chapters
   - Watch the event log to see chapter events being fired
   - Observe chapter segments and their auto-skip behavior

## Chapter Data Format

### Chapters (Core Format)
```javascript
{
    id: 'chapter-1',
    title: 'Introduction',
    startTime: 0,
    endTime: 120,
    description: 'Opening introduction'
}
```

### Segments (Core Format)
```javascript
{
    id: 'intro-segment',
    startTime: 0,
    endTime: 30,
    category: 'intro',
    action: 'skip',
    title: 'Intro Sequence',
    description: 'Skippable introduction'
}
```

## Events Tested

- `chapterchange`: Fired when the current chapter changes
- `segmententered`: Fired when entering a segment (intro, sponsor, etc.)
- `segmentexited`: Fired when exiting a segment
- `segmentskipped`: Fired when a segment is skipped

## API Methods Tested

### Chapter Navigation
- `getCoreChapters()`: Get all chapters
- `getCoreSegments()`: Get all segments
- `getCurrentChapterInfo()`: Get current chapter
- `seekToChapter(chapterId)`: Jump to specific chapter
- `getNextChapter()`: Get next chapter from current time
- `getPreviousChapter()`: Get previous chapter from current time

### Configuration
- `updateChapterConfig(config)`: Update chapter settings

## Integration Architecture

The test demonstrates how the core ChapterManager integrates with the existing web-specific chapter functionality:

1. **Core ChapterManager**: Handles basic chapter/segment logic and events
2. **Web ChapterManager**: Handles UI elements like skip buttons and visual markers
3. **WebPlayer**: Bridges both managers and exposes unified API
4. **Event Processing**: Time updates are processed by both managers
5. **Data Conversion**: Web chapter format is converted to core format automatically

## Browser Compatibility

This test works in modern browsers that support:
- ES6 modules
- Fetch API
- HTMLVideoElement
- Modern CSS features

## Troubleshooting

### No Video Loads
- Check browser console for network errors
- Ensure the sample video URL is accessible
- Check for CORS restrictions

### Chapter Events Not Firing
- Ensure the video is actually playing
- Check that chapter data has valid time ranges
- Verify event listeners are properly attached

### Performance Issues
- Chapter processing is optimized with debouncing
- Time updates only process when time changes significantly
- Event handlers include error catching to prevent failures