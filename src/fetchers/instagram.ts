import type { PostData, FetcherContext } from '../types';
import { fetchJson, fetchHtml } from '../utils/http';
import { parseOGTags } from '../utils/og';

interface InstagramOEmbed {
  title?: string;
  author_name: string;
  author_url?: string;
  thumbnail_url?: string;
  html: string;
}

export async function fetchInstagram(url: string, ctx: FetcherContext): Promise<PostData> {
  const accessToken = ctx.config.apiKeys?.instagramAccessToken;

  // --- Graph API oEmbed (requires access token) ---
  if (accessToken) {
    try {
      const oembed = await fetchJson<InstagramOEmbed>(
        `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${accessToken}&omitscript=true`,
        ctx
      );
      return {
        platform: 'instagram',
        url,
        title: oembed.title,
        author: {
          name: oembed.author_name,
          username: oembed.author_url?.split('/').filter(Boolean).pop(),
          profileUrl: oembed.author_url,
        },
        thumbnailUrl: oembed.thumbnail_url,
        embedHtml: oembed.html,
        // Instagram oEmbed does not expose like/comment counts
      };
    } catch {
      // fall through to OG
    }
  }

  // --- OG tag fallback (server-side only — Instagram blocks browser requests) ---
  try {
    const html = await fetchHtml(url, ctx);
    const og = parseOGTags(html);
    return {
      platform: 'instagram',
      url,
      title: og.title,
      description: og.description,
      thumbnailUrl: og.image,
      author: og.author ? { name: og.author } : undefined,
    };
  } catch {
    // Return minimal data if everything fails
    return {
      platform: 'instagram',
      url,
    };
  }
}
