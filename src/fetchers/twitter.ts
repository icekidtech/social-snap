import type { PostData, FetcherContext } from '../types';
import { fetchJson } from '../utils/http';
import { extractTwitterId } from '../detectors/platform';

interface TwitterOEmbed {
  html: string;
  author_name: string;
  author_url: string;
  url: string;
}

interface TwitterApiTweet {
  data?: {
    id: string;
    text: string;
    author_id: string;
    created_at?: string;
    public_metrics?: {
      retweet_count: number;
      reply_count: number;
      like_count: number;
      quote_count: number;
      impression_count?: number;
    };
  };
  includes?: {
    users?: Array<{
      id: string;
      name: string;
      username: string;
      profile_image_url?: string;
    }>;
  };
}

/**
 * Normalise an X/Twitter URL:
 * - Convert x.com → twitter.com (oEmbed still uses twitter.com)
 * - Strip tracking query params like ?s=20, ?t=xxx that break oEmbed
 */
function normaliseTwitterUrl(url: string): string {
  let clean = url
    .replace(/^https?:\/\/(www\.)?x\.com/, 'https://twitter.com')
    .replace(/^https?:\/\/(www\.)?twitter\.com/, 'https://twitter.com');

  // Keep only the path up to /status/<id> — drop all query params
  const match = clean.match(/(https:\/\/twitter\.com\/[^/]+\/status\/\d+)/);
  return match ? match[1] : clean;
}

export async function fetchTwitter(url: string, ctx: FetcherContext): Promise<PostData> {
  const tweetId = extractTwitterId(url);
  const bearerToken = ctx.config.apiKeys?.twitterBearerToken;
  const normalisedUrl = normaliseTwitterUrl(url);

  // ── Twitter API v2 (preferred — bearer token required) ───────────────────
  if (bearerToken && tweetId) {
    try {
      const apiData = await fetchJson<TwitterApiTweet>(
        `https://api.twitter.com/2/tweets/${tweetId}` +
        `?tweet.fields=created_at,public_metrics` +
        `&expansions=author_id` +
        `&user.fields=name,username,profile_image_url`,
        ctx,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );

      const tweet  = apiData?.data;
      const author = apiData?.includes?.users?.[0];
      const metrics = tweet?.public_metrics;

      if (tweet) {
        return {
          platform:    'twitter',
          url,
          id:          tweet.id,
          title:       tweet.text,
          publishedAt: tweet.created_at,
          author: author
            ? {
                name:       author.name,
                username:   author.username,
                avatarUrl:  author.profile_image_url,
                profileUrl: `https://twitter.com/${author.username}`,
              }
            : undefined,
          metrics: metrics
            ? {
                likes:    metrics.like_count,
                reposts:  metrics.retweet_count,
                comments: metrics.reply_count,
                quotes:   metrics.quote_count,
                views:    metrics.impression_count,
              }
            : undefined,
        };
      }
    } catch {
      // API failed — fall through to oEmbed
    }
  }

  // ── oEmbed (no key needed, but X has restricted this since 2023) ──────────
  let oembed: TwitterOEmbed | null = null;
  try {
    const result = await fetchJson<TwitterOEmbed>(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalisedUrl)}&omit_script=true`,
      ctx
    );
    // Validate the response has actual content — X sometimes returns
    // a 200 with empty author_name / html on restricted tweets
    if (result?.author_name && result?.html) {
      oembed = result;
    }
  } catch {
    // oEmbed blocked or unavailable — continue to minimal fallback
  }

  if (oembed) {
    const oembedUsername = oembed.author_url?.split('/').filter(Boolean).pop();
    return {
      platform:   'twitter',
      url,
      id:         tweetId ?? undefined,
      title:      stripHtml(oembed.html).slice(0, 280),
      embedHtml:  oembed.html,
      author: {
        name:       oembed.author_name,
        username:   oembedUsername,
        profileUrl: oembed.author_url,
      },
    };
  }

  // ── Minimal fallback — we have at least the tweet ID ─────────────────────
  // This happens when oEmbed is restricted and no bearer token is provided.
  const username = url.match(/(?:twitter|x)\.com\/([^/]+)\/status/)?.[1];
  return {
    platform: 'twitter',
    url,
    id:       tweetId ?? undefined,
    author:   username ? { name: username, username } : undefined,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
