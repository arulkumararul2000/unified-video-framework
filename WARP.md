# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

The Unified Video Framework is a cross-platform video player solution supporting iOS, Android, Web, Smart TVs (Samsung Tizen/LG webOS), Roku, and other platforms. It uses a monorepo structure managed by Lerna with TypeScript and provides DRM support, adaptive streaming, and integrated paywall/rental functionality.

## Development Commands

### Core Development Workflow
```bash
# Initial setup (run once)
npm install
npm run bootstrap          # Bootstrap monorepo dependencies

# Build workflow
npm run build             # Build core, web, react-native packages + fix imports
npm run build:all         # Build all packages using Lerna
npm run build:publish     # Production build (core + web only)

# Package-specific builds
npm run build:core        # Build @unified-video/core package
npm run build:web         # Build @unified-video/web package
npm run build:react-native # Build @unified-video/react-native package
npm run build:enact       # Build @unified-video/enact package (Smart TV)

# Development mode
npm run dev               # Run all packages in parallel development mode

# Testing
npm test                  # Run Jest test suite
npm run test:coverage     # Run tests with coverage report
npm run test:watch        # Run tests in watch mode

# Code quality
npm run lint              # ESLint for TypeScript/JavaScript
npm run type-check        # TypeScript type checking without compilation

# Documentation
npm run docs              # Generate TypeDoc documentation

# Rental API (Backend)
npm run build:rental-api  # Build rental API backend
npm run start:rental-api  # Start rental API in production
npm run dev:rental-api    # Start rental API in development mode

# Utilities
npm run clean             # Clean all build artifacts
npm run fix-imports       # Fix import paths after builds
npm run serve:demo        # Serve demo applications
```

### Single Test Execution
```bash
# Run specific test file
npm test -- VideoPlayer.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should play video"

# Run tests for specific package
cd packages/core && npm test

# Run tests with specific configuration
npm test -- --config=jest.config.js
```

## Architecture Overview

### Monorepo Structure
- **`packages/core/`** - Core interfaces, factory, and base classes (`@unified-video/core`)
- **`packages/web/`** - Web player implementation with HLS.js/Dash.js (`@unified-video/web`)
- **`packages/react-native/`** - Mobile player for iOS/Android (`@unified-video/react-native`)
- **`packages/enact/`** - Smart TV player for Samsung Tizen/LG webOS (`@unified-video/enact`)
- **`packages/roku/`** - Roku player implementation (`@unified-video/roku`)
- **`packages/android/`** - Android native implementation
- **`packages/ios/`** - iOS native implementation
- **`apps/demo/`** - Demo applications
- **`apps/rental-api/`** - Backend API for paywall/rental system

### Core Architecture Patterns

#### Factory Pattern for Platform Detection
The `VideoPlayerFactory` automatically detects the platform and loads the appropriate player implementation using dynamic imports. This allows the framework to work even when not all platform packages are installed.

#### Event-Driven Architecture
All player implementations extend `BasePlayer` and use a unified event system with events like `ready`, `play`, `pause`, `error`, `paywall:show`, etc.

#### Paywall Integration System
The framework includes built-in paywall support with:
- Configurable free preview duration
- Multiple payment gateways (Stripe, Cashfree, Google Pay, Pesapal)
- Email authentication flow
- Admin override capabilities
- Mock endpoints for development

#### DRM Support Architecture
Comprehensive DRM implementation supporting:
- **FairPlay** (iOS/Apple TV) 
- **Widevine** (Android/Chrome/Smart TVs)
- **PlayReady** (Windows/Xbox/Smart TVs)
- **ClearKey** for testing

### Platform-Specific Implementations

#### Web Player (`packages/web/`)
- Uses HLS.js for HLS streams and Dash.js for MPEG-DASH
- HTML5 video element as base with custom controls
- Supports Picture-in-Picture, fullscreen, and Chromecast

#### React Native Player (`packages/react-native/`)
- Wraps react-native-video for native playback performance
- Handles both iOS AVPlayer and Android ExoPlayer internally
- Supports offline downloads and background playback

#### Smart TV Players (`packages/enact/`)
- Built with LG's Enact framework for webOS and Tizen
- Remote control navigation with spatial focus management
- TV-optimized UI with 10-foot interface design

#### Core Interfaces (`packages/core/`)
- `IVideoPlayer` interface defines the contract all implementations must follow
- `PlayerState`, `DRMType`, `PlatformType` enums provide type safety
- `VideoSource`, `PaywallConfig`, `DRMConfig` interfaces for configuration

## Key Development Patterns

### Dynamic Import Strategy
The factory uses `eval('import(...)')` to prevent webpack from bundling unavailable packages, allowing graceful fallbacks when platform-specific packages aren't installed.

### TypeScript Project References
Uses TypeScript project references in `tsconfig.json` to enable efficient incremental builds across the monorepo packages.

### Import Path Management
The `scripts/fix-imports.js` script runs after builds to fix import paths in generated `.d.ts` files, ensuring proper module resolution.

### Testing Strategy
- Jest with ts-jest for TypeScript support
- jsdom environment for web components
- Coverage thresholds set to 70% for branches, functions, lines, statements
- Module name mapping to resolve monorepo package imports during testing

### Paywall System Architecture
- **Frontend**: Embedded paywall UI with customizable branding and multiple payment options
- **Backend**: REST API (`apps/rental-api/`) handling entitlements, payment processing, and admin functions
- **Database**: PostgreSQL schema for users, videos, rentals, and DRM licenses
- **Security**: JWT authentication, OTP generation, IP restrictions, and device limits

### Admin System Integration
Rules mention an `adminGlobalImageUploadsController` that handles AWS S3 and local folder storage, storing only image filenames in database columns.

### Authentication Flow
Rules specify that `/admin` routes redirect unauthenticated users to login, while login/signup/forgot password pages use light theme only.

## Development Considerations

### Platform Detection Priority
1. React Native environment detection first
2. Smart TV user agent detection (Tizen, webOS, Roku)
3. Android TV detection
4. Default to web for unknown environments

### Build Dependencies
- Lerna manages workspace dependencies with `--legacy-peer-deps` flag
- TypeScript 4.9+ required for all packages
- Node.js 14+ and npm 6+ specified in engines

### Testing Environment Setup
- jsdom for DOM manipulation testing
- Module name mapping handles monorepo package resolution
- Coverage collection from `packages/*/src/**/*.{ts,tsx}` excluding stories and type definitions

### Performance Optimizations
- Platform-specific code splitting via dynamic imports
- Lazy loading of streaming libraries (HLS.js, Dash.js)
- Adaptive bitrate configuration for optimal quality
- Buffer management for smooth playback

This framework requires understanding of video streaming protocols, DRM systems, cross-platform development, and payment processing integration.
