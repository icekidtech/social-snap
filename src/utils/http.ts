import { FetchError } from "../errors";
import type { FetcherContext } from "../types";

export async function fetchJson<T = unknown>(
    url: string,
    ctx: FetcherContext,
    init?: RequestInit,
): Promise<T> {
    const { config, isServer } = ctx;
    const timeout = config.timeout ?? 8000;

    // In browser environments, route through the proxy to avoid CORS
    const targetUrl = 
        !isServer && config.proxyUrl
            ? `${config.proxyUrl}?url=${encodeURIComponent(url)}`
            : url;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(targetUrl, {
            ...init,
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                ...(init?.headers ?? {}),
            },
        });

        if (!res.ok) {
            throw new FetchError(
                `Request to ${url} failed with status ${res.status}`,
                res.status
            );
        }

        return (await res.json()) as T;
    } catch (err) {
        if (err instanceof FetchError) throw err;
        if ((err as Error).name === 'AbortError') {
            throw new FetchError(`Request to ${url} timed out after ${timeout}ms`);
        }
        throw new FetchError(`Network errror fetching ${url}: ${(err as Error).message}`);
    } finally {
        clearTimeout(timer);
    }
}

export async function fetchHtml(url: string, ctx: FetcherContext): Promise<string> {
    const { config, isServer } = ctx;
    const timeout = config.timeout ?? 8000;

    const targetUrl = 
        !isServer && config.proxyUrl
            ? `${config.proxyUrl}?url=${encodeURIComponent(url)}`
            : url;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(targetUrl, {
            signal: controller.signal,
            headers: { Accept: 'text/html' },
        });

        if (!res.ok) {
            throw new FetchError(`HTML fetch failed for ${url}: ${res.status}`, res.status);
        }
     
        return await res.text();
    } catch (err) {
        if (err instanceof FetchError) throw err;
        throw new FetchError(`Network error fetching HTML from ${url}: ${(err as Error).message}`);
    } finally {
        clearTimeout(timer);
    }
}
