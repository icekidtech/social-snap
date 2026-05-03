import { FetchError } from '../errors';
import type { FetcherContext } from '../types';

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Known API error hints shown when debug mode is on.
 */
const ERROR_HINTS: Record<string, Record<number, string>> = {
  'api.twitter.com': {
    401: 'Bearer token is invalid or expired. Regenerate it at developer.twitter.com.',
    403: 'App lacks Read permission. Enable it under User Authentication Settings.',
    429: 'Rate limit hit. Twitter free tier allows ~500k tweet reads/month.',
    503: 'Twitter API is temporarily unavailable. Will retry automatically.',
  },
  'www.googleapis.com': {
    400: 'Bad request — check that the video ID is correct.',
    403: 'API key is blocked. In Google Cloud Console → Credentials → your key → remove or relax HTTP referrer restrictions. Or switch to "IP address" restrictions for server-side use.',
    429: 'YouTube quota exceeded (10,000 units/day on free tier).',
  },
  'publish.twitter.com': {
    401: 'Tweet is protected (private account) or has been deleted.',
    403: 'oEmbed access denied — tweet may be from a suspended account.',
  },
  'www.youtube.com': {
    401: 'Video is age-restricted or private — oEmbed requires auth for these.',
    404: 'Video not found or has been deleted.',
  },
  'graph.facebook.com': {
    400: 'Instagram access token may be expired. Regenerate at developers.facebook.com.',
    401: 'Instagram access token is invalid.',
    403: 'App does not have oEmbed read permission.',
  },
};

function getHint(url: string, status: number): string | undefined {
  try {
    const host = new URL(url).hostname;
    return ERROR_HINTS[host]?.[status];
  } catch {
    return undefined;
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T = unknown>(
  url: string,
  ctx: FetcherContext,
  init?: RequestInit,
  retries = 2
): Promise<T> {
  const { config, isServer } = ctx;
  const timeout = config.timeout ?? 15000;

  const targetUrl =
    !isServer && config.proxyUrl
      ? `${config.proxyUrl}?url=${encodeURIComponent(url)}`
      : url;

  let lastError: FetchError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(targetUrl, {
        ...init,
        signal: controller.signal,
        headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
      });

      if (!res.ok) {
        const hint = getHint(url, res.status);
        const err = new FetchError(
          `Request to ${url} failed with status ${res.status}${hint ? ` — ${hint}` : ''}`,
          res.status
        );

        // Retry on transient server errors
        if (RETRYABLE_STATUSES.has(res.status) && attempt < retries) {
          const delay = (attempt + 1) * 1000;
          ctx.warn('http', `Status ${res.status} — retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
          lastError = err;
          await sleep(delay);
          continue;
        }

        throw err;
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof FetchError) {
        if (RETRYABLE_STATUSES.has(err.status ?? 0) && attempt < retries) {
          lastError = err;
          continue;
        }
        throw err;
      }
      if ((err as Error).name === 'AbortError') {
        throw new FetchError(`Request to ${url} timed out after ${timeout}ms`);
      }
      throw new FetchError(`Network error fetching ${url}: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new FetchError(`All retries failed for ${url}`);
}

export async function fetchHtml(url: string, ctx: FetcherContext): Promise<string> {
  const { config, isServer } = ctx;
  const timeout = config.timeout ?? 15000;

  const targetUrl =
    !isServer && config.proxyUrl
      ? `${config.proxyUrl}?url=${encodeURIComponent(url)}`
      : url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/html', 'User-Agent': 'SocialSnapBot/1.0' },
    });

    if (!res.ok) {
      const hint = getHint(url, res.status);
      throw new FetchError(
        `HTML fetch failed for ${url}: ${res.status}${hint ? ` — ${hint}` : ''}`,
        res.status
      );
    }

    return await res.text();
  } catch (err) {
    if (err instanceof FetchError) throw err;
    throw new FetchError(`Network error fetching HTML from ${url}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}