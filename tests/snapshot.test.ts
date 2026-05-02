import { describe, it, expect } from 'vitest';
import {
  createSnapshot,
  stampSnapshot,
  diffSnapshots,
  isValidSnapshot,
  generateSnapshotId,
} from '../src/snapshot';
import type { PostData, Snapshot } from '../src/types';

const mockPost: PostData = {
  platform: 'youtube',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  id: 'dQw4w9WgXcQ',
  title: 'Rick Astley - Never Gonna Give You Up',
  author: { name: 'Rick Astley', username: 'rickastley' },
  metrics: { views: 1_400_000_000, likes: 16_000_000, comments: 2_000_000 },
};

// ── generateSnapshotId ───────────────────────────────────────────────────────
describe('generateSnapshotId()', () => {
  it('returns a valid UUID v4 string', () => {
    const id = generateSnapshotId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('generates unique IDs on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSnapshotId()));
    expect(ids.size).toBe(100);
  });
});

// ── createSnapshot ───────────────────────────────────────────────────────────
describe('createSnapshot()', () => {
  it('creates a snapshot with correct shape', () => {
    const snapshot = createSnapshot(mockPost);
    expect(snapshot.platform).toBe('youtube');
    expect(snapshot.url).toBe(mockPost.url);
    expect(snapshot.post).toEqual(mockPost);
    expect(snapshot.snapshotId).toBeTruthy();
  });

  it('does NOT set capturedAt — that is backend-only', () => {
    const snapshot = createSnapshot(mockPost);
    expect(snapshot.capturedAt).toBeUndefined();
  });

  it('generates a unique snapshotId each time', () => {
    const a = createSnapshot(mockPost);
    const b = createSnapshot(mockPost);
    expect(a.snapshotId).not.toBe(b.snapshotId);
  });

  it('stores optional raw data', () => {
    const raw = { some: 'api response' };
    const snapshot = createSnapshot(mockPost, raw);
    expect(snapshot.raw).toEqual(raw);
  });

  it('raw is undefined when not provided', () => {
    const snapshot = createSnapshot(mockPost);
    expect(snapshot.raw).toBeUndefined();
  });
});

// ── stampSnapshot ────────────────────────────────────────────────────────────
describe('stampSnapshot()', () => {
  it('adds capturedAt as an ISO 8601 string', () => {
    const snapshot = createSnapshot(mockPost);
    const stamped = stampSnapshot(snapshot);
    expect(stamped.capturedAt).toBeDefined();
    expect(new Date(stamped.capturedAt).toISOString()).toBe(stamped.capturedAt);
  });

  it('accepts a custom date', () => {
    const snapshot = createSnapshot(mockPost);
    const date = new Date('2024-01-15T10:30:00.000Z');
    const stamped = stampSnapshot(snapshot, date);
    expect(stamped.capturedAt).toBe('2024-01-15T10:30:00.000Z');
  });

  it('does not mutate the original snapshot', () => {
    const snapshot = createSnapshot(mockPost);
    const stamped = stampSnapshot(snapshot);
    expect(snapshot.capturedAt).toBeUndefined();
    expect(stamped.capturedAt).toBeDefined();
  });

  it('preserves all original snapshot fields', () => {
    const snapshot = createSnapshot(mockPost);
    const stamped = stampSnapshot(snapshot);
    expect(stamped.snapshotId).toBe(snapshot.snapshotId);
    expect(stamped.url).toBe(snapshot.url);
    expect(stamped.platform).toBe(snapshot.platform);
    expect(stamped.post).toEqual(snapshot.post);
  });
});

// ── diffSnapshots ────────────────────────────────────────────────────────────
describe('diffSnapshots()', () => {
  const makeStamped = (metrics: PostData['metrics'], capturedAt: string): Snapshot & { capturedAt: string } => ({
    ...createSnapshot({ ...mockPost, metrics }),
    capturedAt,
  });

  it('correctly diffs positive metric changes', () => {
    const before = makeStamped({ likes: 1000, views: 50000, comments: 200 }, '2024-01-01T00:00:00.000Z');
    const after = makeStamped({ likes: 1500, views: 75000, comments: 250 }, '2024-01-02T00:00:00.000Z');
    const diff = diffSnapshots(before, after);

    expect(diff.diff.likes).toBe(500);
    expect(diff.diff.views).toBe(25000);
    expect(diff.diff.comments).toBe(50);
  });

  it('correctly diffs negative metric changes', () => {
    const before = makeStamped({ likes: 2000 }, '2024-01-01T00:00:00.000Z');
    const after = makeStamped({ likes: 1800 }, '2024-01-02T00:00:00.000Z');
    const diff = diffSnapshots(before, after);
    expect(diff.diff.likes).toBe(-200);
  });

  it('omits metrics that are not present in both snapshots', () => {
    const before = makeStamped({ likes: 100 }, '2024-01-01T00:00:00.000Z');
    const after = makeStamped({ likes: 200, views: 5000 }, '2024-01-02T00:00:00.000Z');
    const diff = diffSnapshots(before, after);
    expect(diff.diff.likes).toBe(100);
    expect(diff.diff.views).toBeUndefined(); // views wasn't in before
  });

  it('throws when comparing snapshots from different URLs', () => {
    const a = { ...createSnapshot(mockPost), capturedAt: '2024-01-01T00:00:00.000Z' };
    const b = {
      ...createSnapshot({ ...mockPost, url: 'https://www.youtube.com/watch?v=other' }),
      capturedAt: '2024-01-02T00:00:00.000Z',
    };
    expect(() => diffSnapshots(a, b)).toThrow('Cannot diff snapshots from different URLs');
  });

  it('includes platform, url, and timestamps in the diff result', () => {
    const before = makeStamped({ likes: 100 }, '2024-01-01T00:00:00.000Z');
    const after = makeStamped({ likes: 200 }, '2024-01-02T00:00:00.000Z');
    const diff = diffSnapshots(before, after);
    expect(diff.platform).toBe('youtube');
    expect(diff.url).toBe(mockPost.url);
    expect(diff.beforeCapturedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(diff.afterCapturedAt).toBe('2024-01-02T00:00:00.000Z');
  });
});

// ── isValidSnapshot ──────────────────────────────────────────────────────────
describe('isValidSnapshot()', () => {
  it('returns true for a valid snapshot', () => {
    const snapshot = createSnapshot(mockPost);
    expect(isValidSnapshot(snapshot)).toBe(true);
  });

  it('returns true for a stamped snapshot', () => {
    const snapshot = stampSnapshot(createSnapshot(mockPost));
    expect(isValidSnapshot(snapshot)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidSnapshot(null)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isValidSnapshot('not a snapshot')).toBe(false);
  });

  it('returns false when snapshotId is missing', () => {
    const { snapshotId: _, ...noId } = createSnapshot(mockPost);
    expect(isValidSnapshot(noId)).toBe(false);
  });

  it('returns false when post is missing', () => {
    const { post: _, ...noPost } = createSnapshot(mockPost);
    expect(isValidSnapshot(noPost)).toBe(false);
  });

  it('returns false when url is missing', () => {
    const { url: _, ...noUrl } = createSnapshot(mockPost);
    expect(isValidSnapshot(noUrl)).toBe(false);
  });

  it('returns false when platform is missing', () => {
    const { platform: _, ...noPlatform } = createSnapshot(mockPost);
    expect(isValidSnapshot(noPlatform)).toBe(false);
  });
});
