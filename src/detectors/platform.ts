import type { Platform } from '../types';
import { UnsupportedPlatformError } from '../errors';

const PLATFORM_PATTERNS: Record<Platform, RegExp[]> = {
  twitter: [
    /^https?:\/\/(www\.)?(twitter|x)\.com\/.+\/status\/\d+/i,
  ],
  youtube: [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?.*v=[\w-]+/i,
    /^https?:\/\/youtu\.be\/[\w-]+/i,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/i,
  ],
  instagram: [
    /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[\w-]+/i,
  ],
  tiktok: [
    /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/video\/\d+/i,
    /^https?:\/\/vm\.tiktok\.com\/[\w]+/i,
  ],
  linkedin: [
    /^https?:\/\/(www\.)?linkedin\.com\/posts\/.+/i,
    /^https?:\/\/(www\.)?linkedin\.com\/feed\/update\/.+/i,
  ],
};

export function detectPlatform(url: string): Platform {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    if (patterns.some((p) => p.test(url))) {
      return platform as Platform;
    }
  }
  throw new UnsupportedPlatformError(url);
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([\w-]+)/,
    /youtu\.be\/([\w-]+)/,
    /\/shorts\/([\w-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function extractTwitterId(url: string): string | null {
  const m = url.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}
