/**
 * User preferences manager for chapter and skip functionality
 */

import { ChapterPreferences } from './types/ChapterTypes';

export class UserPreferencesManager {
  private static readonly STORAGE_KEY = 'uvf_chapter_preferences';
  private static readonly DEFAULT_PREFERENCES: ChapterPreferences = {
    autoSkipIntro: false,
    autoSkipRecap: false,
    autoSkipCredits: false,
    showSkipButtons: true,
    skipButtonTimeout: 5000,
    rememberChoices: true
  };

  private preferences: ChapterPreferences;
  private listeners: ((preferences: ChapterPreferences) => void)[] = [];

  constructor(initialPreferences?: Partial<ChapterPreferences>) {
    // Load preferences from storage or use defaults
    this.preferences = this.loadPreferences();
    
    // Apply initial preferences if provided
    if (initialPreferences) {
      this.updatePreferences(initialPreferences);
    }
  }

  /**
   * Get current preferences
   */
  public getPreferences(): ChapterPreferences {
    return { ...this.preferences };
  }

  /**
   * Update preferences
   */
  public updatePreferences(updates: Partial<ChapterPreferences>): void {
    const oldPreferences = { ...this.preferences };
    this.preferences = { ...this.preferences, ...updates };

    // Save to storage if rememberChoices is enabled
    if (this.preferences.rememberChoices) {
      this.savePreferences();
    }

    // Notify listeners if preferences changed
    if (!this.preferencesEqual(oldPreferences, this.preferences)) {
      this.notifyListeners();
    }
  }

  /**
   * Reset preferences to defaults
   */
  public resetPreferences(): void {
    this.preferences = { ...UserPreferencesManager.DEFAULT_PREFERENCES };
    this.savePreferences();
    this.notifyListeners();
  }

  /**
   * Get specific preference value
   */
  public getPreference<K extends keyof ChapterPreferences>(key: K): ChapterPreferences[K] {
    return this.preferences[key];
  }

  /**
   * Set specific preference value
   */
  public setPreference<K extends keyof ChapterPreferences>(
    key: K, 
    value: ChapterPreferences[K]
  ): void {
    this.updatePreferences({ [key]: value } as Partial<ChapterPreferences>);
  }

  /**
   * Toggle auto-skip for specific segment type
   */
  public toggleAutoSkip(segmentType: 'intro' | 'recap' | 'credits'): void {
    switch (segmentType) {
      case 'intro':
        this.setPreference('autoSkipIntro', !this.preferences.autoSkipIntro);
        break;
      case 'recap':
        this.setPreference('autoSkipRecap', !this.preferences.autoSkipRecap);
        break;
      case 'credits':
        this.setPreference('autoSkipCredits', !this.preferences.autoSkipCredits);
        break;
    }
  }

  /**
   * Check if auto-skip is enabled for segment type
   */
  public isAutoSkipEnabled(segmentType: 'intro' | 'recap' | 'credits'): boolean {
    switch (segmentType) {
      case 'intro':
        return this.preferences.autoSkipIntro || false;
      case 'recap':
        return this.preferences.autoSkipRecap || false;
      case 'credits':
        return this.preferences.autoSkipCredits || false;
      default:
        return false;
    }
  }

  /**
   * Add preference change listener
   */
  public addListener(listener: (preferences: ChapterPreferences) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove preference change listener
   */
  public removeListener(listener: (preferences: ChapterPreferences) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Create preferences UI panel
   */
  public createPreferencesPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'uvf-chapter-preferences-panel';
    panel.innerHTML = `
      <div class="uvf-preferences-header">
        <h3>Skip Preferences</h3>
      </div>
      <div class="uvf-preferences-body">
        <div class="uvf-preference-item">
          <label>
            <input type="checkbox" id="uvf-pref-auto-skip-intro" ${this.preferences.autoSkipIntro ? 'checked' : ''}>
            <span>Auto-skip intros</span>
          </label>
        </div>
        <div class="uvf-preference-item">
          <label>
            <input type="checkbox" id="uvf-pref-auto-skip-recap" ${this.preferences.autoSkipRecap ? 'checked' : ''}>
            <span>Auto-skip recaps</span>
          </label>
        </div>
        <div class="uvf-preference-item">
          <label>
            <input type="checkbox" id="uvf-pref-auto-skip-credits" ${this.preferences.autoSkipCredits ? 'checked' : ''}>
            <span>Auto-skip credits</span>
          </label>
        </div>
        <div class="uvf-preference-item">
          <label>
            <input type="checkbox" id="uvf-pref-show-buttons" ${this.preferences.showSkipButtons ? 'checked' : ''}>
            <span>Show skip buttons</span>
          </label>
        </div>
        <div class="uvf-preference-item">
          <label>
            <span>Button timeout:</span>
            <select id="uvf-pref-timeout">
              <option value="3000" ${this.preferences.skipButtonTimeout === 3000 ? 'selected' : ''}>3 seconds</option>
              <option value="5000" ${this.preferences.skipButtonTimeout === 5000 ? 'selected' : ''}>5 seconds</option>
              <option value="10000" ${this.preferences.skipButtonTimeout === 10000 ? 'selected' : ''}>10 seconds</option>
              <option value="0" ${this.preferences.skipButtonTimeout === 0 ? 'selected' : ''}>Never hide</option>
            </select>
          </label>
        </div>
        <div class="uvf-preference-item">
          <label>
            <input type="checkbox" id="uvf-pref-remember" ${this.preferences.rememberChoices ? 'checked' : ''}>
            <span>Remember preferences</span>
          </label>
        </div>
      </div>
      <div class="uvf-preferences-footer">
        <button type="button" id="uvf-pref-reset">Reset to Defaults</button>
      </div>
    `;

    // Add event listeners
    this.setupPreferencesEventListeners(panel);

    return panel;
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): ChapterPreferences {
    try {
      const stored = localStorage.getItem(UserPreferencesManager.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...UserPreferencesManager.DEFAULT_PREFERENCES, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load chapter preferences from storage:', error);
    }
    
    return { ...UserPreferencesManager.DEFAULT_PREFERENCES };
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      localStorage.setItem(
        UserPreferencesManager.STORAGE_KEY, 
        JSON.stringify(this.preferences)
      );
    } catch (error) {
      console.warn('Failed to save chapter preferences to storage:', error);
    }
  }

  /**
   * Check if two preference objects are equal
   */
  private preferencesEqual(a: ChapterPreferences, b: ChapterPreferences): boolean {
    return (
      a.autoSkipIntro === b.autoSkipIntro &&
      a.autoSkipRecap === b.autoSkipRecap &&
      a.autoSkipCredits === b.autoSkipCredits &&
      a.showSkipButtons === b.showSkipButtons &&
      a.skipButtonTimeout === b.skipButtonTimeout &&
      a.rememberChoices === b.rememberChoices
    );
  }

  /**
   * Notify all listeners of preference changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getPreferences());
      } catch (error) {
        console.error('Error in preference change listener:', error);
      }
    });
  }

  /**
   * Setup event listeners for preferences panel
   */
  private setupPreferencesEventListeners(panel: HTMLElement): void {
    // Auto-skip checkboxes
    const autoSkipIntro = panel.querySelector('#uvf-pref-auto-skip-intro') as HTMLInputElement;
    const autoSkipRecap = panel.querySelector('#uvf-pref-auto-skip-recap') as HTMLInputElement;
    const autoSkipCredits = panel.querySelector('#uvf-pref-auto-skip-credits') as HTMLInputElement;
    const showButtons = panel.querySelector('#uvf-pref-show-buttons') as HTMLInputElement;
    const remember = panel.querySelector('#uvf-pref-remember') as HTMLInputElement;
    const timeout = panel.querySelector('#uvf-pref-timeout') as HTMLSelectElement;
    const resetButton = panel.querySelector('#uvf-pref-reset') as HTMLButtonElement;

    // Event listeners
    if (autoSkipIntro) {
      autoSkipIntro.addEventListener('change', () => {
        this.setPreference('autoSkipIntro', autoSkipIntro.checked);
      });
    }

    if (autoSkipRecap) {
      autoSkipRecap.addEventListener('change', () => {
        this.setPreference('autoSkipRecap', autoSkipRecap.checked);
      });
    }

    if (autoSkipCredits) {
      autoSkipCredits.addEventListener('change', () => {
        this.setPreference('autoSkipCredits', autoSkipCredits.checked);
      });
    }

    if (showButtons) {
      showButtons.addEventListener('change', () => {
        this.setPreference('showSkipButtons', showButtons.checked);
      });
    }

    if (remember) {
      remember.addEventListener('change', () => {
        this.setPreference('rememberChoices', remember.checked);
      });
    }

    if (timeout) {
      timeout.addEventListener('change', () => {
        this.setPreference('skipButtonTimeout', parseInt(timeout.value, 10));
      });
    }

    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this.resetPreferences();
        // Update UI
        if (autoSkipIntro) autoSkipIntro.checked = this.preferences.autoSkipIntro || false;
        if (autoSkipRecap) autoSkipRecap.checked = this.preferences.autoSkipRecap || false;
        if (autoSkipCredits) autoSkipCredits.checked = this.preferences.autoSkipCredits || false;
        if (showButtons) showButtons.checked = this.preferences.showSkipButtons || true;
        if (remember) remember.checked = this.preferences.rememberChoices || true;
        if (timeout) timeout.value = String(this.preferences.skipButtonTimeout || 5000);
      });
    }
  }

  /**
   * Get default preferences
   */
  public static getDefaultPreferences(): ChapterPreferences {
    return { ...UserPreferencesManager.DEFAULT_PREFERENCES };
  }
}
