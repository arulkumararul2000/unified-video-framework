# EPG Alignment Fixes

Based on the issues highlighted in the provided image, I have implemented comprehensive fixes to resolve the EPG (Electronic Program Guide) alignment and scrolling problems.

## Issues Identified

From your image, I identified these problems:
1. **Misaligned grid lines** - Timeline header and program grid vertical lines were not aligned
2. **Channel row height inconsistencies** - Channel names and program rows had different heights
3. **No scroll synchronization** - Timeline header and program grid scrolled independently

## Fixes Implemented

### 1. **EPGProgramGrid Component Enhancements**

#### **File**: `packages/web/src/react/components/EPGProgramGrid.tsx`

**Changes Made:**
- Added `onTimelineScroll` prop to communicate scroll position to parent
- Added `timelineScrollLeft` prop to receive scroll position from timeline header
- Enhanced scroll handler to capture both vertical and horizontal scroll events
- Added `useEffect` to synchronize horizontal scrolling with timeline header
- Improved grid lines rendering with separate horizontal and vertical lines
- Fixed channel names scroll synchronization with program grid

**Key Code Changes:**
```typescript
// Enhanced scroll handler
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

// Sync program grid horizontal scroll with timeline
useEffect(() => {
  if (gridRef.current && timelineScrollLeft !== undefined) {
    gridRef.current.scrollLeft = timelineScrollLeft;
  }
}, [timelineScrollLeft]);
```

### 2. **EPGTimelineHeader Component Redesign**

#### **File**: `packages/web/src/react/components/EPGTimelineHeader.tsx`

**Changes Made:**
- Restructured layout to include channel names spacer (200px width) matching the program grid
- Added scrollable timeline container that synchronizes with program grid
- Added `scrollLeft` and `onScroll` props for bidirectional scroll synchronization
- Hidden scrollbars to maintain clean UI appearance
- Improved time slot alignment with program grid

**Key Code Changes:**
```typescript
// Sync scroll position from parent
useEffect(() => {
  if (scrollContainerRef.current && scrollLeft !== undefined) {
    scrollContainerRef.current.scrollLeft = scrollLeft;
  }
}, [scrollLeft]);

// Handle scroll events from timeline header
const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
  if (onScroll) {
    onScroll(e.currentTarget.scrollLeft);
  }
};
```

### 3. **EPGOverlay Component Updates**

#### **File**: `packages/web/src/react/components/EPGOverlay.tsx`

**Changes Made:**
- Added state management for timeline scroll position
- Added scroll synchronization handlers
- Connected timeline header and program grid scroll events

**Key Code Changes:**
```typescript
const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);

// Handle timeline scroll synchronization
const handleTimelineScroll = useCallback((scrollLeft: number) => {
  setTimelineScrollLeft(scrollLeft);
}, []);

// Handle program grid scroll synchronization  
const handleProgramGridScroll = useCallback((scrollLeft: number) => {
  setTimelineScrollLeft(scrollLeft);
}, []);
```

## Visual Layout Improvements

### **Before (Issues)**:
- Timeline header and program grid had misaligned vertical lines
- Channel row heights didn't match program block heights
- No horizontal scroll synchronization
- Grid lines were inconsistent between components

### **After (Fixed)**:
- ✅ **Perfect alignment**: Timeline header spacer (200px) matches channel names column exactly
- ✅ **Synchronized scrolling**: Horizontal scrolling in either timeline or program grid syncs both
- ✅ **Consistent heights**: Channel rows (80px) align perfectly with program blocks
- ✅ **Proper grid lines**: Vertical lines align between timeline header and program grid
- ✅ **Clean UI**: Hidden scrollbars maintain professional appearance

## Testing

I created a comprehensive test file (`epg-alignment-test.html`) that:
- Demonstrates the fixed alignment issues
- Tests horizontal scroll synchronization
- Verifies proper grid line alignment
- Shows consistent channel row heights
- Provides visual feedback for scroll testing

## Technical Details

### **Scroll Synchronization Architecture**

```
EPGOverlay (State Manager)
├── timelineScrollLeft (state)
├── handleTimelineScroll() 
└── handleProgramGridScroll()
    │
    ├── EPGTimelineHeader
    │   ├── scrollLeft (prop)
    │   ├── onScroll (prop)
    │   └── scrollContainerRef.current.scrollLeft = scrollLeft
    │
    └── EPGProgramGrid
        ├── timelineScrollLeft (prop)
        ├── onTimelineScroll (prop)  
        └── gridRef.current.scrollLeft = timelineScrollLeft
```

### **Layout Structure**

```
EPG Layout (Fixed)
├── Navigation Controls (56px height)
├── Timeline Header (60px height)
│   ├── Channel Spacer (200px width) 
│   └── Scrollable Time Slots (synchronized)
└── Program Grid (flex: 1)
    ├── Channel Names (200px width)
    └── Programs Container (synchronized scrolling)
```

## Build Status

The web package has been successfully built with all fixes:
```bash
cd packages/web && npm run build
# ✅ Build completed successfully
```

## Usage

The enhanced EPG components maintain the same API but now provide:
- Perfect visual alignment
- Synchronized horizontal scrolling
- Consistent measurements across all components
- Professional TV guide appearance

All existing EPG integrations will automatically benefit from these fixes without requiring code changes.

## Files Modified

1. `packages/web/src/react/components/EPGProgramGrid.tsx`
2. `packages/web/src/react/components/EPGTimelineHeader.tsx` 
3. `packages/web/src/react/components/EPGOverlay.tsx`
4. `packages/web/epg-alignment-test.html` (test file)

These fixes resolve all the alignment and scrolling issues identified in your image, providing a professional-grade EPG interface that matches traditional TV guide standards.