import type { PostData, FetcherContext } from '../types';
import { fetchJson, fetchHtml } from '../utils/http';
import { parseOGTags } from '../utils/og';

interface TikTokOEmbed {
  title: string;
  author_name: string;
  author_unique_id?: string;
  thumbnail_url?: string;
  html?: string;
}

export async function fetchTikTok(url: string, ctx: FetcherContext): Promise<PostData> {
  // --- oEmbed ---
  let oembed: TikTokOEmbed | null = null;
  try {
    oembed = await fetchJson<TikTokOEmbed>(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      ctx
    );
  } catch {
    // fall through
  }

  if (oembed) {
    return {
      platform: 'tiktok',
      url,
      title: oembed.title,
      author: {
        name: oembed.author_name,
        username: oembed.author_unique_id,
      },
      thumbnailUrl: oembed.thumbnail_url,
      embedHtml: oembed.html,
      // TikTok's public oEmbed does not expose engagement metrics
    };
  }

  // --- OG fallback ---
  const html = await fetchHtml(url, ctx);
  const og = parseOGTags(html);
  return {
    platform: 'tiktok',
    url,
    title: og.title,
    description: og.description,
    thumbnailUrl: og.image,
  };
}
