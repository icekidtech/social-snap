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

export async function fetchTwitter(url: string, ctx: FetcherContext): Promise<PostData> {
  const tweetId = extractTwitterId(url);
  const bearerToken = ctx.config.apiKeys?.twitterBearerToken;

  // --- oEmbed (always available, no key needed) ---
  let oembed: TwitterOEmbed | null = null;
  try {
    oembed = await fetchJson<TwitterOEmbed>(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`,
      ctx
    );
  } catch {
    // continue
  }

  // --- Twitter API v2 (optional bearer token) ---
  let apiData: TwitterApiTweet | null = null;
  if (bearerToken && tweetId) {
    try {
      apiData = await fetchJson<TwitterApiTweet>(
        `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=created_at,public_metrics&expansions=author_id&user.fields=name,username,profile_image_url`,
        ctx,
        { headers: { Authorization: `Bearer ${bearerToken}` } }
      );
    } catch {
      // API failed, continue without metrics
    }
  }

  const tweet = apiData?.data;
  const author = apiData?.includes?.users?.[0];
  const metrics = tweet?.public_metrics;

  // Extract author username from oEmbed URL as fallback
  const oembedUsername = oembed?.author_url?.split('/').pop();

  return {
    platform: 'twitter',
    url,
    id: tweetId ?? tweet?.id,
    title: tweet?.text ?? stripHtml(oembed?.html ?? '').slice(0, 280),
    author: {
      name: author?.name ?? oembed?.author_name ?? '',
      username: author?.username ?? oembedUsername,
      avatarUrl: author?.profile_image_url,
      profileUrl: oembed?.author_url,
    },
    embedHtml: oembed?.html,
    publishedAt: tweet?.created_at,
    metrics: metrics
      ? {
          likes: metrics.like_count,
          reposts: metrics.retweet_count,
          comments: metrics.reply_count,
          quotes: metrics.quote_count,
          views: metrics.impression_count,
        }
      : undefined,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}