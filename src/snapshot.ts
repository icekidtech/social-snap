import type { Snapshot, PostData, Platform } from './types';

/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID() where available (Node 14.17+, modern browsers),
 * falls back to a Math.random()-based implementation.
 */
export function generateSnapshotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Wraps a PostData object into a Snapshot envelope.
 * Generates a unique snapshotId.
 * Does NOT set capturedAt — that is always done server-side via stampSnapshot().
 *
 * @param post    - The PostData returned by a platform fetcher
 * @param raw     - Optional raw API/oEmbed response to store for auditing
 */
export function createSnapshot(post: PostData, raw?: unknown): Snapshot {
  return {
    snapshotId: generateSnapshotId(),
    url: post.url,
    platform: post.platform,
    post,
    raw,
  };
}

/**
 * Adds a server-side capturedAt ISO 8601 timestamp to a snapshot.
 * Always call this on the backend — never trust a client-supplied timestamp.
 *
 * @param snapshot - The snapshot received from the client
 * @param date     - Optional date override (defaults to current server time)
 */
export function stampSnapshot(
  snapshot: Snapshot,
  date?: Date
): Snapshot & { capturedAt: string } {
  return {
    ...snapshot,
    capturedAt: (date ?? new Date()).toISOString(),
  };
}

/**
 * Compares two snapshots of the same post and returns a diff of metrics.
 * Useful for tracking how engagement changes over time.
 *
 * @param before - The earlier snapshot
 * @param after  - The later snapshot
 */
export interface MetricsDiff {
  platform: Platform;
  url: string;
  beforeCapturedAt?: string;
  afterCapturedAt?: string;
  diff: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
    reposts?: number;
    quotes?: number;
  };
}

export function diffSnapshots(before: Snapshot, after: Snapshot): MetricsDiff {
  if (before.url !== after.url) {
    throw new Error(
      `Cannot diff snapshots from different URLs: "${before.url}" vs "${after.url}"`
    );
  }

  const bm = before.post.metrics ?? {};
  const am = after.post.metrics ?? {};

  const diff: MetricsDiff['diff'] = {};

  const keys = ['likes', 'comments', 'shares', 'views', 'reposts', 'quotes'] as const;
  for (const key of keys) {
    const bVal = bm[key];
    const aVal = am[key];
    if (aVal !== undefined && bVal !== undefined) {
      diff[key] = aVal - bVal;
    }
  }

  return {
    platform: after.platform,
    url: after.url,
    beforeCapturedAt: before.capturedAt,
    afterCapturedAt: after.capturedAt,
    diff,
  };
}

/**
 * Validates that a value has the minimum shape of a Snapshot.
 * Useful for validating incoming request bodies on the backend.
 */
export function isValidSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s['snapshotId'] === 'string' &&
    typeof s['url'] === 'string' &&
    typeof s['platform'] === 'string' &&
    typeof s['post'] === 'object' &&
    s['post'] !== null
  );
}