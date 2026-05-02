export { SocialSnap } from './client';
export {
  createSnapshot,
  stampSnapshot,
  diffSnapshots,
  isValidSnapshot,
  generateSnapshotId,
} from './snapshot';
export type { MetricsDiff } from './snapshot';
export type {
  Platform,
  Snapshot,
  PostData,
  PostMetrics,
  Author,
  SocialSnapConfig,
  ApiKeys,
  FetcherContext,
} from './types';
export { detectPlatform } from './detectors/platform';
export {
  SocialSnapError,
  UnsupportedPlatformError,
  FetchError,
  ParseError,
} from './errors';