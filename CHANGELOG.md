# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.85] - 2024-12-25

### Added
- **🦁 Brave Browser Fullscreen Support**: Comprehensive Brave browser detection and enhanced fullscreen handling
  - Accurate Brave browser detection using multiple detection methods
  - Private/Incognito mode detection for different handling approaches
  - Enhanced permissions checking and fullscreen capability analysis
  - `enterFullscreenWithBraveSupport()` method with targeted error handling for Brave-specific issues
  - Brave-specific user gesture validation and permission requests
- **🧪 Comprehensive Debug Testing**: Advanced debugging tools for Brave fullscreen issues
  - `brave-fullscreen-debug-test.html` - Comprehensive test page for diagnosing fullscreen problems
  - Browser environment detection with detailed capability analysis
  - Multiple fullscreen test methods (button click, keyboard shortcuts, double-click, direct API)
  - Debug logging system with export functionality for issue analysis
  - Permission state monitoring and site settings validation

### Enhanced
- **Fullscreen Button Handler**: Enhanced with Brave-specific logic and debugging
  - Special handling for Brave normal tabs vs private tabs
  - Enhanced error messages with browser-specific guidance
  - Multiple event dispatch methods for maximum compatibility
  - Fresh user gesture validation for reliable fullscreen activation
- **Cross-browser Compatibility**: Improved fullscreen API support
  - Multiple fullscreen API fallbacks (standard, webkit, moz, ms)
  - Enhanced error handling with specific guidance for common browser issues
  - Improved user gesture context preservation

### Fixed
- **Brave Browser Issues**: Resolved common fullscreen problems in Brave browser
  - Fixed "API can only be initiated by a user gesture" errors in normal tabs
  - Improved permission handling for Brave's stricter security policies
  - Better handling of Brave Shields and site settings interference
  - Enhanced fallback mechanisms when fullscreen APIs are restricted

### Improved
- **Developer Experience**: Better debugging and issue identification tools
  - Detailed browser capability detection and logging
  - Comprehensive test suite for diagnosing fullscreen issues across different browser modes
  - Enhanced error messages with actionable guidance for users
  - Export functionality for debug logs to assist with issue resolution

## [1.4.47] - 2024-01-24

### Fixed
- **EPG Alignment Issues**: Fixed critical alignment problems in Electronic Program Guide
  - Fixed misaligned grid lines between timeline header and program grid
  - Resolved channel row height inconsistencies (standardized to 80px)
  - Fixed timeline header and program grid vertical line alignment
- **EPG Scrolling Synchronization**: Implemented bidirectional scroll synchronization
  - Timeline header and program grid now scroll in perfect sync horizontally
  - Added scroll state management and event coordination
  - Hidden scrollbars for clean professional appearance
- **EPG Layout Structure**: Enhanced component architecture
  - Added 200px channel spacer in timeline header matching program grid
  - Improved grid line rendering with separate horizontal and vertical lines
  - Enhanced scroll event handling and throttling

### Changed
- **EPGProgramGrid**: Enhanced with scroll synchronization props (`onTimelineScroll`, `timelineScrollLeft`)
- **EPGTimelineHeader**: Restructured layout with scrollable container and channel spacer
- **EPGOverlay**: Added scroll state management and coordination between components

### Improved
- Professional TV guide appearance with perfect alignment
- Smooth synchronized scrolling experience
- Consistent visual measurements across all EPG components
- Better user experience for Electronic Program Guide interface

## [1.4.19] - 2024-09-09

### Fixed
- Fixed ES module import resolution issues when consumers install the package
- Updated fix-imports.js script to properly handle ES module import statements
- Fixed internal imports to include .js extensions for ES module compatibility
- Resolved "Cannot resolve module" errors in consumer projects
- Fixed directory import issues by updating all import statements to reference specific files

### Changed
- Enhanced build process to ensure ES modules work correctly when installed via npm
- Improved fix-imports script to handle both CommonJS and ES module import patterns

## [1.4.1] - 2024-09-06

### Fixed
- Fixed webpack warning about react-native module resolution in web environments
- Changed VideoPlayerFactory to use eval() for react-native require to prevent build-time resolution

## [1.4.0] - 2024-09-06

### Added
- Homepage and bugs URLs for better npm package display
- CHANGELOG.md to track version changes
- Engines field specifying Node.js >=14.0.0 and npm >=6.0.0 requirements
- peerDependenciesMeta to make HLS.js and dash.js optional peer dependencies

### Changed
- Updated README.md with correct import examples and usage documentation
- Removed "Under Development" warning from README
- Improved Quick Start examples with actual working code

### Improved
- Overall package documentation and npm page presentation
- TypeScript support with better type exports

## [1.3.4] - 2024-09-06

### Fixed
- Fixed react-native import error in VideoPlayerFactory by wrapping require in try-catch
- Improved module exports configuration for better subpath imports
- Added TypeScript declaration file for better type support
- Fixed import paths resolution issue when using `unified-video-framework/web`

### Added
- Added module declaration file `unified-video-framework.d.ts`
- Added proper export paths for `/packages/web/dist` and `/packages/core/dist`

### Changed
- Updated build process to exclude non-existent HTML5Player references

## [1.3.3] - 2024-09-06

### Fixed
- Resolved module resolution issue for @unified-video/core dependency
- Added post-build script to fix import paths in compiled JavaScript files
- Updated webpack configuration to bundle core with web package

### Added
- Added `scripts/fix-imports.js` to automatically fix import paths after build
- Added `fix-imports` npm script to build process

### Changed
- Modified build scripts to run fix-imports after compilation
- Updated prepublishOnly script to use build:publish

## [1.3.2] - 2024-09-06

### Added
- Initial public release with core functionality
- Web player implementation with HLS and DASH support
- React Native player implementation
- Core interfaces and base player class
- Support for multiple platforms (iOS, Android, Web, Smart TVs)
- DRM support architecture
- Analytics integration hooks
- Custom controls and theming
- Watermark overlay support
- Picture-in-Picture support
- Subtitle and audio track management

### Features
- Unified API across all platforms
- Dynamic loading of streaming libraries (HLS.js, dash.js)
- Fallback mechanisms for unsupported formats
- Event-driven architecture
- TypeScript support with full type definitions
- Modular package structure (monorepo)
