/**
 * Chapter functionality exports for unified-video-framework
 */

// Core classes
export { ChapterManager } from './ChapterManager';
export { SkipButtonController } from './SkipButtonController';
export { UserPreferencesManager } from './UserPreferencesManager';

// Types and interfaces
export * from './types/ChapterTypes';

// React components and hooks
export { useChapters } from '../react/hooks/useChapters';
export { SkipButton } from '../react/components/SkipButton';
export { ChapterProgress } from '../react/components/ChapterProgress';

// Re-export commonly used types
export type {
  UseChaptersOptions,
  UseChaptersResult
} from '../react/hooks/useChapters';

export type {
  SkipButtonProps
} from '../react/components/SkipButton';

export type {
  ChapterProgressProps
} from '../react/components/ChapterProgress';

export type {
  ChapterMarker
} from '../react/components/ChapterProgress';
