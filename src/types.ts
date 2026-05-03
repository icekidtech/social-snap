export type Platform = 'twitter' | 'youtube' | 'instagram' | 'tiktok' | 'linkedin';

export interface Author {
  name: string;
  username?: string;
  avatarUrl?: string;
  profileUrl?: string;
}

export interface PostMetrics {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  reposts?: number;
  quotes?: number;
}

export interface PostData {
  id?: string;
  title?: string;
  description?: string;
  author?: Author;
  thumbnailUrl?: string;
  embedHtml?: string;
  metrics?: PostMetrics;
  publishedAt?: string;
  platform: Platform;
  url: string;
}

export interface Snapshot {
  /** Unique ID generated client-side at fetch time */
  snapshotId: string;
  /** Original URL that was pasted */
  url: string;
  platform: Platform;
  post: PostData;
  /** ISO timestamp — populated server-side via .stamp() */
  capturedAt?: string;
  /** Raw API/oEmbed response for reference */
  raw?: unknown;
}

export interface ApiKeys {
    // YouTube Data API v3 key
    youtubeApiKey?: string;
    // Twitter/X API Bearer Token
    twitterBearerToken?: string;
    // Instagram/Facebook Graph API Access Token
    instagramAccessToken?: string;
}

export interface SocialSnapConfig {
  /**
   * Proxy base URL used in browser environments to avoid CORS.
   * The SDK will call: `{proxyUrl}?url=<encoded social url>`
   * Your backend should forward the request and return the raw response.
   */
  proxyUrl?: string;
  apiKeys?: ApiKeys;
  /** Request timeout in ms (default: 8000) */
  timeout?: number;
  /**
   * Enable debug mode — surfaces silent API errors to the console
   * instead of swallowing them. Useful during development.
   */
  debug?: boolean;
}

export interface FetcherContext {
  config: SocialSnapConfig;
  isServer: boolean;
  /** Call this to report a non-fatal error when debug mode is on */
  warn: (source: string, err: unknown) => void;
}
