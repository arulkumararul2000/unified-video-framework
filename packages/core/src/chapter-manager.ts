import { Chapter, ChapterSegment, ChapterConfig, EventHandler } from './interfaces';

export interface ChapterManagerEvents {
  chapterchange: Chapter | null;
  segmententered: ChapterSegment;
  segmentexited: ChapterSegment;
  segmentskipped: ChapterSegment;
}

export class ChapterManager {
  private config: ChapterConfig;
  private chapters: Chapter[] = [];
  private segments: ChapterSegment[] = [];
  private currentChapter: Chapter | null = null;
  private activeSegments: Set<string> = new Set();
  private lastProcessedTime: number = -1;
  private eventHandlers: Map<keyof ChapterManagerEvents, EventHandler[]> = new Map();

  constructor(config: ChapterConfig = {}) {
    this.config = { ...config };
    this.chapters = config.chapters || [];
    this.segments = config.segments || [];
    
    // Initialize event handler arrays
    this.eventHandlers.set('chapterchange', []);
    this.eventHandlers.set('segmententered', []);
    this.eventHandlers.set('segmentexited', []);
    this.eventHandlers.set('segmentskipped', []);
  }

  /**
   * Update the configuration
   */
  updateConfig(config: ChapterConfig): void {
    this.config = { ...this.config, ...config };
    this.chapters = config.chapters || this.chapters;
    this.segments = config.segments || this.segments;
  }

  /**
   * Load chapter data from a URL
   */
  async loadChapterData(url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch chapter data: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.chapters) {
        this.chapters = data.chapters;
      }
      if (data.segments) {
        this.segments = data.segments;
      }
    } catch (error) {
      console.error('Error loading chapter data:', error);
      throw error;
    }
  }

  /**
   * Initialize the chapter manager
   */
  async initialize(): Promise<void> {
    if (this.config.dataUrl) {
      await this.loadChapterData(this.config.dataUrl);
    }
    
    // Sort chapters and segments by start time
    this.chapters.sort((a, b) => a.startTime - b.startTime);
    this.segments.sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * Process current time and handle chapter/segment changes
   */
  processTimeUpdate(currentTime: number): void {
    if (Math.abs(currentTime - this.lastProcessedTime) < 0.1) {
      return; // Skip if time hasn't changed significantly
    }
    
    this.lastProcessedTime = currentTime;
    this.processChapterChange(currentTime);
    this.processSegments(currentTime);
  }

  /**
   * Process chapter changes
   */
  private processChapterChange(currentTime: number): void {
    const newChapter = this.getCurrentChapter(currentTime);
    
    if (newChapter !== this.currentChapter) {
      this.currentChapter = newChapter;
      this.emit('chapterchange', newChapter);
      
      if (this.config.onChapterChange) {
        this.config.onChapterChange(newChapter);
      }
    }
  }

  /**
   * Process segment enter/exit events
   */
  private processSegments(currentTime: number): void {
    const currentSegments = this.segments.filter(
      segment => currentTime >= segment.startTime && currentTime <= segment.endTime
    );

    // Check for newly entered segments
    for (const segment of currentSegments) {
      if (!this.activeSegments.has(segment.id)) {
        this.activeSegments.add(segment.id);
        this.emit('segmententered', segment);
        
        if (this.config.onSegmentEntered) {
          this.config.onSegmentEntered(segment);
        }
        
        // Auto-skip if enabled and segment has skip action
        if (this.config.autoSkip && segment.action === 'skip') {
          this.skipSegment(segment);
        }
      }
    }

    // Check for exited segments
    const currentSegmentIds = new Set(currentSegments.map(s => s.id));
    for (const activeSegmentId of this.activeSegments) {
      if (!currentSegmentIds.has(activeSegmentId)) {
        const segment = this.segments.find(s => s.id === activeSegmentId);
        if (segment) {
          this.activeSegments.delete(activeSegmentId);
          this.emit('segmentexited', segment);
          
          if (this.config.onSegmentExited) {
            this.config.onSegmentExited(segment);
          }
        }
      }
    }
  }

  /**
   * Get the current chapter based on time
   */
  getCurrentChapter(currentTime: number): Chapter | null {
    return this.chapters.find(
      chapter => currentTime >= chapter.startTime && currentTime <= chapter.endTime
    ) || null;
  }

  /**
   * Get all chapters
   */
  getChapters(): Chapter[] {
    return [...this.chapters];
  }

  /**
   * Get all segments
   */
  getSegments(): ChapterSegment[] {
    return [...this.segments];
  }

  /**
   * Get segments at a specific time
   */
  getSegmentsAtTime(currentTime: number): ChapterSegment[] {
    return this.segments.filter(
      segment => currentTime >= segment.startTime && currentTime <= segment.endTime
    );
  }

  /**
   * Skip a segment
   */
  skipSegment(segment: ChapterSegment): void {
    this.emit('segmentskipped', segment);
    
    if (this.config.onSegmentSkipped) {
      this.config.onSegmentSkipped(segment);
    }
  }

  /**
   * Seek to a specific chapter
   */
  seekToChapter(chapterId: string): Chapter | null {
    const chapter = this.chapters.find(c => c.id === chapterId);
    if (chapter) {
      // The actual seeking will be handled by the player
      // This method returns the chapter to seek to
      return chapter;
    }
    return null;
  }

  /**
   * Get next chapter
   */
  getNextChapter(currentTime: number): Chapter | null {
    return this.chapters.find(chapter => chapter.startTime > currentTime) || null;
  }

  /**
   * Get previous chapter
   */
  getPreviousChapter(currentTime: number): Chapter | null {
    const previousChapters = this.chapters
      .filter(chapter => chapter.startTime < currentTime)
      .sort((a, b) => b.startTime - a.startTime);
    
    return previousChapters[0] || null;
  }

  /**
   * Add event listener
   */
  on<K extends keyof ChapterManagerEvents>(event: K, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof ChapterManagerEvents>(event: K, handler?: EventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    if (handler) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    } else {
      handlers.length = 0;
    }
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Emit an event
   */
  private emit<K extends keyof ChapterManagerEvents>(event: K, data: ChapterManagerEvents[K]): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in chapter manager event handler for ${event}:`, error);
      }
    });
  }

  /**
   * Reset the chapter manager state
   */
  reset(): void {
    this.currentChapter = null;
    this.activeSegments.clear();
    this.lastProcessedTime = -1;
  }

  /**
   * Destroy the chapter manager and clean up
   */
  destroy(): void {
    this.reset();
    this.eventHandlers.clear();
  }

  /**
   * Get the current chapter
   */
  getCurrentChapterInfo(): Chapter | null {
    return this.currentChapter;
  }

  /**
   * Check if chapter functionality is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled !== false;
  }
}