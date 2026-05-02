/**
 * Parses Open Graph and standard meta tags from an HTML string.
 * Used as a last-resort fallback when no API / oEmbed is available.
 */
export interface OGData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url?: string;
  author?: string;
}

export function parseOGTags(html: string): OGData {
  const result: OGData = {};

  const metaPattern = /<meta\s[^>]*>/gi;
  const propertyPattern = /property=["']([^"']+)["']/i;
  const namePattern = /name=["']([^"']+)["']/i;
  const contentPattern = /content=["']([^"']*?)["']/i;

  let match;
  while ((match = metaPattern.exec(html)) !== null) {
    const tag = match[0];
    const prop = (propertyPattern.exec(tag) ?? namePattern.exec(tag))?.[1]?.toLowerCase();
    const content = contentPattern.exec(tag)?.[1];

    if (!prop || !content) continue;

    switch (prop) {
      case 'og:title':
      case 'twitter:title':
        result.title ??= decode(content);
        break;
      case 'og:description':
      case 'twitter:description':
      case 'description':
        result.description ??= decode(content);
        break;
      case 'og:image':
      case 'twitter:image':
        result.image ??= content;
        break;
      case 'og:site_name':
        result.siteName = content;
        break;
      case 'og:url':
        result.url ??= content;
        break;
      case 'author':
        result.author ??= content;
        break;
    }
  }

  // Fallback to <title> tag
  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) result.title = decode(titleMatch[1]);
  }

  return result;
}

function decode(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
