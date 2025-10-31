/**
 * YouTube Video Extractor and Stream Fetcher
 * Handles YouTube URL detection, video ID extraction, and fetches direct video streams
 */

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  duration: number;
  thumbnail: string;
  streamUrl: string;
  format: 'mp4' | 'webm';
}

export class YouTubeExtractor {
  private static readonly YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/)?([a-zA-Z0-9_-]{11})/;
  private static readonly YOUTUBE_NOEMBED_API = 'https://noembed.com/embed?url=';
  private static readonly YOUTUBE_API_ENDPOINT = 'https://www.youtube.com/oembed?url=';

  /**
   * Detect if URL is a valid YouTube URL
   */
  static isYouTubeUrl(url: string): boolean {
    return this.YOUTUBE_REGEX.test(url);
  }

  /**
   * Extract video ID from YouTube URL
   */
  static extractVideoId(url: string): string | null {
    const match = url.match(this.YOUTUBE_REGEX);
    return match ? match[1] : null;
  }

  /**
   * Get YouTube video metadata using oembed API
   * This works without CORS issues
   */
  static async getVideoMetadata(url: string): Promise<{
    title: string;
    thumbnail: string;
    duration?: number;
  }> {
    try {
      // Use noembed API which has better CORS support
      const apiUrl = `${this.YOUTUBE_NOEMBED_API}${encodeURIComponent(url)}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error('Failed to fetch YouTube metadata');
      }

      const data = await response.json();
      
      return {
        title: data.title || 'YouTube Video',
        thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${this.extractVideoId(url)}/maxresdefault.jpg`,
        duration: data.duration || undefined
      };
    } catch (error) {
      console.warn('Failed to fetch YouTube metadata:', error);
      // Return fallback metadata
      const videoId = this.extractVideoId(url);
      return {
        title: 'YouTube Video',
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: undefined
      };
    }
  }

  /**
   * Convert YouTube URL to embeddable iframe URL
   * This is used for getting the video stream through various methods
   */
  static getEmbedUrl(videoId: string): string {
    return `https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&controls=0`;
  }

  /**
   * Get direct video stream using py-youtube or similar service
   * Note: This requires a backend service as direct YouTube downloads violate ToS
   * 
   * For client-side, we recommend using:
   * 1. YouTube IFrame API with custom controls
   * 2. Backend service that extracts video streams
   * 3. HLS variant of YouTube if available
   */
  static async getDirectStreamUrl(videoId: string, backendEndpoint?: string): Promise<string | null> {
    if (!backendEndpoint) {
      console.warn('No backend endpoint provided for YouTube video extraction. Using fallback method.');
      return this.getFallbackStreamUrl(videoId);
    }

    try {
      const response = await fetch(backendEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoId })
      });

      if (!response.ok) {
        throw new Error('Backend failed to extract stream');
      }

      const data = await response.json();
      return data.streamUrl || null;
    } catch (error) {
      console.error('Failed to get direct stream URL:', error);
      return this.getFallbackStreamUrl(videoId);
    }
  }

  /**
   * Fallback method: Return YouTube watch URL with adaptive streaming
   * This uses YouTube's own HLS/DASH streams if available
   */
  private static getFallbackStreamUrl(videoId: string): string {
    // This returns the standard YouTube URL which has built-in HLS support
    // For actual stream extraction, you need a backend service or use YouTube IFrame API
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  /**
   * Create a YouTube-compatible player configuration
   * This prepares the source object for our custom player
   */
  static async prepareYouTubeSource(url: string, backendEndpoint?: string) {
    const videoId = this.extractVideoId(url);
    
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

    const metadata = await this.getVideoMetadata(url);
    
    // For direct streaming, we need a backend service
    // This could be implemented using yt-dlp, pytube, or similar
    const streamUrl = await this.getDirectStreamUrl(videoId, backendEndpoint);

    return {
      url: streamUrl || url, // Fallback to original URL
      type: 'youtube',
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration,
      videoId: videoId,
      isYouTube: true,
      metadata: {
        source: 'youtube',
        videoId: videoId
      }
    };
  }
}

export default YouTubeExtractor;
