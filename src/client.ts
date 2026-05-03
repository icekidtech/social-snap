import type { SocialSnapConfig, Snapshot, PostData, FetcherContext } from './types';
import { detectPlatform } from './detectors/platform';
import { createSnapshot, stampSnapshot } from './snapshot';
import { fetchYouTube } from './fetchers/youtube';
import { fetchTwitter } from './fetchers/twitter';
import { fetchTikTok } from './fetchers/tiktok';
import { fetchInstagram } from './fetchers/instagram';
import { fetchLinkedIn } from './fetchers/linkedin';

function isServer(): boolean {
  return typeof window === 'undefined';
}

export class SocialSnap {
  private config: SocialSnapConfig;

  constructor(config: SocialSnapConfig = {}) {
    this.config = config;
  }

  private makeContext(): FetcherContext {
    return {
      config: this.config,
      isServer: isServer(),
      warn: (source: string, err: unknown) => {
        if (this.config.debug) {
          console.warn(
            `\n[social-snap DEBUG:${source}]`,
            err instanceof Error ? `${err.message}` : err
          );
        }
      },
    };
  }

  /**
   * Fetch post data for a given social media URL.
   * Use this on the **frontend** to preview a pasted link.
   */
  async preview(url: string): Promise<PostData> {
    const platform = detectPlatform(url);
    const ctx = this.makeContext();

    switch (platform) {
      case 'youtube':   return fetchYouTube(url, ctx);
      case 'twitter':   return fetchTwitter(url, ctx);
      case 'tiktok':    return fetchTikTok(url, ctx);
      case 'instagram': return fetchInstagram(url, ctx);
      case 'linkedin':  return fetchLinkedIn(url, ctx);
    }
  }

  /**
   * Wrap a PostData result in a Snapshot envelope.
   */
  createSnapshot(post: PostData, raw?: unknown): Snapshot {
    return createSnapshot(post, raw);
  }

  /**
   * Convenience: preview + createSnapshot in one call.
   */
  async snap(url: string): Promise<Snapshot> {
    const post = await this.preview(url);
    return this.createSnapshot(post);
  }

  /**
   * Add a server-side capturedAt timestamp to a snapshot.
   * Always call this on your backend, never on the client.
   */
  stamp(snapshot: Snapshot, date?: Date): Snapshot & { capturedAt: string } {
    return stampSnapshot(snapshot, date);
  }

  /**
   * Detect which platform a URL belongs to without fetching.
   */
  detectPlatform(url: string) {
    return detectPlatform(url);
  }
}