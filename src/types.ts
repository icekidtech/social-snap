export type Platform = 'twitter' | 'youtube' | 'instagram' | 'tiktok' | 'linkedin';

export interface Author {
  name: string;
  username?: string;
  avatarUrl?: string;
  profilePictureUrl?: string;
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
    // Unique ID generated client-side at fetch time.
    snapshotId: string;
    // Original URL that was pasted.
    url: string;
    // The platform the URL belongs to.
    platform: Platform;
    post: PostData;
    // ISO timestamp - populate server-side via .stamp()
    capturedAt?: string;
    // Raw API/oEmbed response for reference
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
     * Your backend should forward the request and return the raw response from the social media API.
     * This is required for browser usage since most social media APIs do not support CORS.
     */
    proxyUrl?: string;
    apiKeys?: ApiKeys;
    /** Request timeout in ms (default: 8000) */
    timeout?: number;
}

export interface FetcherContext {
    config: SocialSnapConfig;
    isServer: boolean;
}
