import type { PostData, FetcherContext } from '../types';
import { fetchJson } from '../utils/http';
import { extractTwitterId } from '../detectors/platform';

interface TwitterOEmbed {
  html: string;
  author_name: string;
  author_url: string;
  url: string;
}

interface TwitterApiResponse {
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
  // Twitter API v2 error shape
  errors?: Array<{ message: string; code?: number }>;
  title?: string;   // e.g. "Unauthorized"
  detail?: string;  // e.g. "Forbidden"
  status?: number;
}

/**
 * Strip tracking params and normalise x.com → twitter.com for oEmbed.
 * oEmbed still uses the twitter.com domain even for x.com posts.
 */
function normaliseUrl(url: string): string {
  const match = url.match(/(?:twitter|x)\.com\/([^/?]+)\/status\/(\d+)/);
  if (!match) return url;
  return `https://twitter.com/${match[1]}/status/${match[2]}`;
}

export async function fetchTwitter(url: string, ctx: FetcherContext): Promise<PostData> {
  const tweetId     = extractTwitterId(url);
  const bearerToken = ctx.config.apiKeys?.twitterBearerToken;
  const cleanUrl    = normaliseUrl(url);

  // ── Twitter API v2 (preferred path — requires Bearer token) ───────────────
  if (bearerToken && tweetId) {
    try {
      const apiData = await fetchJson<TwitterApiResponse>(
        `https://api.twitter.com/2/tweets/${tweetId}` +
        `?tweet.fields=created_at,public_metrics` +
        `&expansions=author_id` +
        `&user.fields=name,username,profile_image_url`,
        ctx,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );

      // Surface any API-level errors (e.g. wrong token scope, suspended tweet)
      if (apiData.errors?.length || apiData.title) {
        const msg =
          apiData.errors?.[0]?.message ??
          apiData.detail ??
          apiData.title ??
          'Unknown API error';
        ctx.warn('twitter/api-v2', `API returned an error: ${msg}`);
      }

      const tweet   = apiData?.data;
      const author  = apiData?.includes?.users?.[0];
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
                // impression_count requires Elevated access — omit if missing
                ...(metrics.impression_count !== undefined && {
                  views: metrics.impression_count,
                }),
              }
            : undefined,
        };
      }
    } catch (err) {
      ctx.warn('twitter/api-v2', err);
      // Fall through to oEmbed
    }
  }

  // ── oEmbed (no key needed, but X has restricted this since 2023) ──────────
  try {
    const result = await fetchJson<TwitterOEmbed>(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}&omit_script=true`,
      ctx
    );
    // Validate response has real content — X sometimes returns 200 with empty fields
    if (!result?.author_name || !result?.html) {
      ctx.warn('twitter/oembed', 'oEmbed returned empty author_name or html — likely restricted');
    } else {
      const username = result.author_url?.split('/').filter(Boolean).pop();
      return {
        platform:  'twitter',
        url,
        id:        tweetId ?? undefined,
        title:     stripHtml(result.html).slice(0, 280),
        embedHtml: result.html,
        author: {
          name:       result.author_name,
          username,
          profileUrl: result.author_url,
        },
      };
    }
  } catch (err) {
    ctx.warn('twitter/oembed', err);
  }

  // ── Minimal fallback — we have at least the tweet ID and username ──────────
  const username = url.match(/(?:twitter|x)\.com\/([^/?]+)\/status/)?.[1];
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
