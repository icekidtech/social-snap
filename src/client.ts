import type { SocialSnapConfig, Snapshot, PostData, FetcherContext } from './types';
import { detectPlatform } from './detectors/platform';
import { fetchYouTube } from './fetchers/youtube';
import { fetchTwitter } from './fetchers/twitter';
import { fetchTikTok } from './fetchers/tiktok';
import { fetchInstagram } from './fetchers/instagram';
import { fetchLinkedIn } from './fetchers/linkedin';

function generateId(): string {
  // crypto.randomUUID is available in browsers (2021+) and Node 14.17+
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function isServer(): boolean {
  return typeof window === 'undefined';
}

export class SocialSnap {
  private config: SocialSnapConfig;

  constructor(config: SocialSnapConfig = {}) {
    this.config = config;
  }

  /**
   * Fetch post data for a given social media URL.
   * Use this on the **frontend** to preview a pasted link.
   */
  async preview(url: string): Promise<PostData> {
    const platform = detectPlatform(url);
    const ctx: FetcherContext = { config: this.config, isServer: isServer() };

    switch (platform) {
      case 'youtube':
        return fetchYouTube(url, ctx);
      case 'twitter':
        return fetchTwitter(url, ctx);
      case 'tiktok':
        return fetchTikTok(url, ctx);
      case 'instagram':
        return fetchInstagram(url, ctx);
      case 'linkedin':
        return fetchLinkedIn(url, ctx);
    }
  }

  /**
   * Wrap a PostData result in a Snapshot envelope.
   * Call this after `preview()` to prepare the payload for your backend.
   *
   * @example
   * const post = await snap.preview(url);
   * const snapshot = snap.createSnapshot(post);
   * await fetch('/api/snapshots', { method: 'POST', body: JSON.stringify(snapshot) });
   */
  createSnapshot(post: PostData, raw?: unknown): Snapshot {
    return {
      snapshotId: generateId(),
      url: post.url,
      platform: post.platform,
      post,
      raw,
    };
  }

  /**
   * Convenience: preview + createSnapshot in one call.
   */
  async snap(url: string): Promise<Snapshot> {
    const post = await this.preview(url);
    return this.createSnapshot(post);
  }

  /**
   * Add a server-side `capturedAt` timestamp to a snapshot.
   * Call this on your **backend** when you receive the snapshot from the client.
   *
   * @example
   * // Express route
   * app.post('/api/snapshots', (req, res) => {
   *   const stamped = snap.stamp(req.body);
   *   await db.save(stamped);
   *   res.json(stamped);
   * });
   */
  stamp(snapshot: Snapshot, date?: Date): Snapshot & { capturedAt: string } {
    return {
      ...snapshot,
      capturedAt: (date ?? new Date()).toISOString(),
    };
  }

  /**
   * Detect which platform a URL belongs to without fetching.
   * Useful for showing a platform badge before the preview loads.
   */
  detectPlatform(url: string) {
    return detectPlatform(url);
  }
}
