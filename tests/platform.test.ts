import { describe, it, expect } from 'vitest';
import { detectPlatform, extractYouTubeId, extractTwitterId } from '../src/detectors/platform';
import { UnsupportedPlatformError } from '../src/errors';

// ── detectPlatform ───────────────────────────────────────────────────────────
describe('detectPlatform()', () => {
  describe('YouTube', () => {
    const urls = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/abc123def45',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
    ];
    it.each(urls)('detects YouTube: %s', (url) => {
      expect(detectPlatform(url)).toBe('youtube');
    });
  });

  describe('Twitter / X', () => {
    const urls = [
      'https://twitter.com/user/status/1234567890123456789',
      'https://x.com/user/status/1234567890123456789',
      'https://www.twitter.com/elonmusk/status/9876543210',
    ];
    it.each(urls)('detects Twitter: %s', (url) => {
      expect(detectPlatform(url)).toBe('twitter');
    });
  });

  describe('TikTok', () => {
    const urls = [
      'https://www.tiktok.com/@username/video/1234567890123456789',
      'https://tiktok.com/@creator/video/9876543210',
      'https://vm.tiktok.com/AbCdEfGh/',
    ];
    it.each(urls)('detects TikTok: %s', (url) => {
      expect(detectPlatform(url)).toBe('tiktok');
    });
  });

  describe('Instagram', () => {
    const urls = [
      'https://www.instagram.com/p/ABC123def/',
      'https://instagram.com/reel/XYZ789ghi/',
      'https://www.instagram.com/tv/DEF456jkl/',
    ];
    it.each(urls)('detects Instagram: %s', (url) => {
      expect(detectPlatform(url)).toBe('instagram');
    });
  });

  describe('LinkedIn', () => {
    const urls = [
      'https://www.linkedin.com/posts/user-name-activity-1234567890123456789-abcd/',
      'https://linkedin.com/feed/update/urn:li:activity:1234567890123456789/',
    ];
    it.each(urls)('detects LinkedIn: %s', (url) => {
      expect(detectPlatform(url)).toBe('linkedin');
    });
  });

  describe('Unsupported platforms', () => {
    const unsupported = [
      'https://reddit.com/r/programming/comments/abc/post_title/',
      'https://facebook.com/post/123456',
      'https://threads.net/@user/post/abc123',
      'https://mastodon.social/@user/123456',
      'not-a-url-at-all',
      '',
    ];
    it.each(unsupported)('throws UnsupportedPlatformError for: %s', (url) => {
      expect(() => detectPlatform(url)).toThrow(UnsupportedPlatformError);
    });
  });
});

// ── extractYouTubeId ─────────────────────────────────────────────────────────
describe('extractYouTubeId()', () => {
  it('extracts ID from watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts ID from Shorts URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/shorts/abc123')).toBe('abc123');
  });

  it('extracts ID from watch URL with extra params', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PL123')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube URL', () => {
    expect(extractYouTubeId('https://example.com')).toBeNull();
  });
});

// ── extractTwitterId ─────────────────────────────────────────────────────────
describe('extractTwitterId()', () => {
  it('extracts tweet ID from twitter.com URL', () => {
    expect(extractTwitterId('https://twitter.com/user/status/1234567890123456789')).toBe('1234567890123456789');
  });

  it('extracts tweet ID from x.com URL', () => {
    expect(extractTwitterId('https://x.com/user/status/9876543210')).toBe('9876543210');
  });

  it('returns null when no status ID found', () => {
    expect(extractTwitterId('https://twitter.com/user')).toBeNull();
  });
});
