import type { PostData, FetcherContext } from '../types';
import { fetchHtml } from '../utils/http';
import { parseOGTags } from '../utils/og';

export async function fetchLinkedIn(url: string, ctx: FetcherContext): Promise<PostData> {
  // LinkedIn has no public post API. OG tags are server-side only
  // (LinkedIn blocks client-side scraping). The SDK always routes
  // LinkedIn fetches through your backend proxy.
  try {
    const html = await fetchHtml(url, ctx);
    const og = parseOGTags(html);
    return {
      platform: 'linkedin',
      url,
      title: og.title,
      description: og.description,
      thumbnailUrl: og.image,
      author: og.author ? { name: og.author } : undefined,
    };
  } catch {
    return {
      platform: 'linkedin',
      url,
    };
  }
}
