import type { PostData, FetcherContext } from '../types';
import { fetchJson, fetchHtml } from '../utils/http';
import { parseOGTags } from '../utils/og';
import { extractYouTubeId } from '../detectors/platform';

interface YouTubeOEmbed {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  html: string;
}

interface YouTubeApiResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title: string;
      description: string;
      publishedAt: string;
      channelTitle: string;
      thumbnails?: { high?: { url: string } };
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
}

export async function fetchYouTube(url: string, ctx: FetcherContext): Promise<PostData> {
  const videoId = extractYouTubeId(url);
  // Strip share tracking params (e.g. ?si=...) before oEmbed lookup
  const cleanUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
  const apiKey  = ctx.config.apiKeys?.youtubeApiKey;

  // --- oEmbed (always available) ---
  let oembed: YouTubeOEmbed | null = null;
  try {
    oembed = await fetchJson<YouTubeOEmbed>(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      ctx
    );
  } catch (err) {
    ctx.warn('youtube/oembed', err);
  }

  // --- YouTube Data API v3 (optional) ---
  let apiData: YouTubeApiResponse | null = null;
  if (apiKey && videoId) {
    try {
      apiData = await fetchJson<YouTubeApiResponse>(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${apiKey}`,
        ctx
      );
    } catch (err) {
      ctx.warn('youtube/api-v3', err);
    }
  }

  const item    = apiData?.items?.[0];
  const stats   = item?.statistics;
  const snippet = item?.snippet;

  if (oembed || item) {
    return {
      platform:    'youtube',
      url,
      id:          videoId ?? undefined,
      title:       snippet?.title ?? oembed?.title,
      description: snippet?.description,
      author: {
        name:       snippet?.channelTitle ?? oembed?.author_name ?? '',
        profileUrl: oembed?.author_url,
      },
      thumbnailUrl: snippet?.thumbnails?.high?.url ?? oembed?.thumbnail_url,
      embedHtml:    oembed?.html,
      publishedAt:  snippet?.publishedAt,
      metrics: stats
        ? {
            views:    stats.viewCount    ? parseInt(stats.viewCount, 10)    : undefined,
            likes:    stats.likeCount    ? parseInt(stats.likeCount, 10)    : undefined,
            comments: stats.commentCount ? parseInt(stats.commentCount, 10) : undefined,
          }
        : undefined,
    };
  }

  // --- OG tag fallback ---
  try {
    const html = await fetchHtml(url, ctx);
    const og   = parseOGTags(html);
    return {
      platform:    'youtube',
      url,
      id:          videoId ?? undefined,
      title:       og.title,
      description: og.description,
      thumbnailUrl: og.image,
      author:      og.author ? { name: og.author } : undefined,
    };
  } catch (err) {
    ctx.warn('youtube/og', err);
    return { platform: 'youtube', url, id: videoId ?? undefined };
  }
}
