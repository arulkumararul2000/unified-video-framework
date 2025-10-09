/**
 * Controller for skip button UI and interactions
 */

import {
  VideoSegment,
  SkipButtonState,
  SkipButtonPosition,
  ChapterConfig,
  DEFAULT_SKIP_LABELS
} from './types/ChapterTypes';

export class SkipButtonController {
  private skipButton: HTMLElement | null = null;
  private currentSegment: VideoSegment | null = null;
  private autoSkipTimeout: NodeJS.Timeout | null = null;
  private hideTimeout: NodeJS.Timeout | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;
  private state: SkipButtonState;
  
  constructor(
    private playerContainer: HTMLElement,
    private config: ChapterConfig,
    private onSkip: (segment: VideoSegment) => void,
    private onButtonShown: (segment: VideoSegment) => void,
    private onButtonHidden: (segment: VideoSegment, reason: string) => void
  ) {
    this.state = {
      visible: false,
      segment: null,
      position: config.skipButtonPosition || 'bottom-right'
    };
  }

  /**
   * Show skip button for a segment
   */
  public showSkipButton(segment: VideoSegment, currentTime: number): void {
    // Check if skip buttons are disabled in preferences
    if (!this.config.userPreferences?.showSkipButtons) {
      return;
    }

    // Check if this specific segment should show a skip button
    if (segment.showSkipButton === false) {
      return;
    }

    this.currentSegment = segment;
    this.state.segment = segment;

    // Create button if it doesn't exist
    if (!this.skipButton) {
      this.skipButton = this.createSkipButton();
      this.playerContainer.appendChild(this.skipButton);
    }

    // Update button content and show it
    this.updateSkipButton(segment);
    this.showButton();

    // Handle auto-skip functionality
    this.handleAutoSkip(segment, currentTime);

    // Handle auto-hide functionality
    this.handleAutoHide();

    // Emit event
    this.onButtonShown(segment);
  }

  /**
   * Hide skip button
   */
  public hideSkipButton(reason: 'timeout' | 'segment-end' | 'user-action' | 'manual' = 'manual'): void {
    if (!this.skipButton || !this.state.visible) {
      return;
    }

    this.hideButton();
    this.clearTimeouts();

    // Emit event
    if (this.currentSegment) {
      this.onButtonHidden(this.currentSegment, reason);
    }

    this.state.visible = false;
    this.state.segment = null;
    this.currentSegment = null;
  }

  /**
   * Update skip button position
   */
  public updatePosition(position: SkipButtonPosition): void {
    this.state.position = position;
    if (this.skipButton) {
      this.applyPositionStyles(this.skipButton, position);
    }
  }

  /**
   * Check if button is currently visible
   */
  public isVisible(): boolean {
    return this.state.visible;
  }

  /**
   * Get current button state
   */
  public getState(): SkipButtonState {
    return { ...this.state };
  }

  /**
   * Destroy the skip button controller
   */
  public destroy(): void {
    this.clearTimeouts();
    if (this.skipButton) {
      this.skipButton.remove();
      this.skipButton = null;
    }
    this.currentSegment = null;
    this.state.visible = false;
    this.state.segment = null;
  }

  /**
   * Create the skip button DOM element
   */
  private createSkipButton(): HTMLElement {
    const button = document.createElement('button');
    button.className = 'uvf-skip-button';
    button.setAttribute('type', 'button');
    button.setAttribute('aria-label', 'Skip segment');

    // Apply position styles
    this.applyPositionStyles(button, this.state.position);

    // Add click handler
    button.addEventListener('click', () => {
      if (this.currentSegment) {
        this.onSkip(this.currentSegment);
        this.hideSkipButton('user-action');
      }
    });

    // Apply custom styles if provided
    if (this.config.customStyles?.skipButton) {
      Object.assign(button.style, this.config.customStyles.skipButton);
    }

    return button;
  }

  /**
   * Update skip button content for current segment
   */
  private updateSkipButton(segment: VideoSegment): void {
    if (!this.skipButton) return;

    // Set button text
    const skipLabel = segment.skipLabel || DEFAULT_SKIP_LABELS[segment.type];
    this.skipButton.textContent = skipLabel;

    // Update aria-label for accessibility
    this.skipButton.setAttribute('aria-label', `${skipLabel} - ${segment.title || segment.type}`);

    // Add segment type class for styling
    this.skipButton.className = `uvf-skip-button uvf-skip-${segment.type}`;
    
    // Apply position class
    this.skipButton.classList.add(`uvf-skip-button-${this.state.position}`);
  }

  /**
   * Apply position styles to skip button
   */
  private applyPositionStyles(button: HTMLElement, position: SkipButtonPosition): void {
    // Reset position classes
    button.classList.remove(
      'uvf-skip-button-bottom-right',
      'uvf-skip-button-bottom-left', 
      'uvf-skip-button-top-right',
      'uvf-skip-button-top-left'
    );

    // Add new position class
    button.classList.add(`uvf-skip-button-${position}`);

    // Apply CSS styles based on position
    const styles: Partial<CSSStyleDeclaration> = {
      position: 'absolute',
      zIndex: '1000'
    };

    switch (position) {
      case 'bottom-right':
        Object.assign(styles, {
          bottom: '100px',
          right: '30px'
        });
        break;
      case 'bottom-left':
        Object.assign(styles, {
          bottom: '100px',
          left: '30px'
        });
        break;
      case 'top-right':
        Object.assign(styles, {
          top: '30px',
          right: '30px'
        });
        break;
      case 'top-left':
        Object.assign(styles, {
          top: '30px',
          left: '30px'
        });
        break;
    }

    Object.assign(button.style, styles);
  }

  /**
   * Show the skip button with animation
   */
  private showButton(): void {
    if (!this.skipButton) return;

    this.skipButton.classList.add('visible');
    this.state.visible = true;
  }

  /**
   * Hide the skip button with animation
   */
  private hideButton(): void {
    if (!this.skipButton) return;

    this.skipButton.classList.remove('visible');
    this.skipButton.classList.remove('auto-skip', 'countdown');
  }

  /**
   * Handle auto-skip functionality
   */
  private handleAutoSkip(segment: VideoSegment, currentTime: number): void {
    if (!segment.autoSkip || !segment.autoSkipDelay) {
      return;
    }

    // Check user preferences for auto-skip
    const preferences = this.config.userPreferences;
    const shouldAutoSkip = (
      (segment.type === 'intro' && preferences?.autoSkipIntro) ||
      (segment.type === 'recap' && preferences?.autoSkipRecap) ||
      (segment.type === 'credits' && preferences?.autoSkipCredits)
    );

    if (!shouldAutoSkip) {
      return;
    }

    // Add auto-skip class for styling
    this.skipButton?.classList.add('auto-skip');

    // Start countdown
    this.startAutoSkipCountdown(segment, segment.autoSkipDelay);
  }

  /**
   * Start auto-skip countdown
   */
  private startAutoSkipCountdown(segment: VideoSegment, delay: number): void {
    if (!this.skipButton) return;

    let remainingTime = delay;
    this.state.autoSkipCountdown = remainingTime;

    // Update button text with countdown
    const originalText = this.skipButton.textContent || '';
    
    // Start countdown animation
    this.skipButton.classList.add('countdown');
    
    // Update countdown every second
    this.countdownInterval = setInterval(() => {
      remainingTime -= 1;
      this.state.autoSkipCountdown = remainingTime;

      if (this.skipButton) {
        this.skipButton.textContent = `${originalText} (${remainingTime})`;
      }

      if (remainingTime <= 0) {
        this.clearTimeouts();
        if (this.currentSegment) {
          this.onSkip(this.currentSegment);
          this.hideSkipButton('timeout');
        }
      }
    }, 1000);

    // Set final timeout as backup
    this.autoSkipTimeout = setTimeout(() => {
      if (this.currentSegment) {
        this.onSkip(this.currentSegment);
        this.hideSkipButton('timeout');
      }
    }, delay * 1000);
  }

  /**
   * Handle auto-hide functionality
   */
  private handleAutoHide(): void {
    if (!this.config.autoHide || !this.config.autoHideDelay) {
      return;
    }

    this.hideTimeout = setTimeout(() => {
      this.hideSkipButton('timeout');
    }, this.config.autoHideDelay);
  }

  /**
   * Clear all timeouts
   */
  private clearTimeouts(): void {
    if (this.autoSkipTimeout) {
      clearTimeout(this.autoSkipTimeout);
      this.autoSkipTimeout = null;
    }

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    this.state.autoSkipCountdown = undefined;
  }
}
