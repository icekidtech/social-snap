# social-snap

**social-snap** is a universal TypeScript SDK for fetching, snapshotting, and timestamping social media posts. Paste a link from Twitter/X, YouTube, Instagram, TikTok, or LinkedIn — the SDK detects the platform, fetches the post preview and available engagement metrics, wraps it into a structured snapshot, and hands it off to your backend to be stamped and stored.

It is designed to work seamlessly in both **browser** and **Node.js** environments, uses zero runtime dependencies, and degrades gracefully from official APIs → oEmbed → Open Graph tags.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Configuration](#configuration)
- [API Reference](#api-reference)
  - [SocialSnap](#socialsnap-class)
  - [Snapshot Object](#snapshot-object)
  - [Server Helpers](#server-helpers)
  - [Error Types](#error-types)
- [Platform Support](#platform-support)
- [API Keys](#api-keys)
- [Frontend Integration](#frontend-integration)
- [Backend Integration](#backend-integration)
- [Full Stack Example](#full-stack-example)
- [Building & Publishing](#building--publishing)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- 🔗 **Auto-detects platform** from any pasted URL
- 📸 **Structured snapshots** with a consistent schema across all platforms
- ⏱ **Server-side timestamping** — `capturedAt` is always stamped by your backend, not the client
- 📊 **Engagement metrics** — likes, views, comments, shares, reposts where available
- 🔑 **API keys are optional** — degrades gracefully: Official API → oEmbed → Open Graph tags
- 🌐 **Universal** — works in browsers, Node.js, and edge runtimes
- 🔒 **CORS-safe** — built-in proxy routing for browser environments
- 🪶 **Zero runtime dependencies** — uses native `fetch` only
- 🏗 **Dual ESM + CJS output** — works with any bundler or require()

---

## Installation

```bash
npm install social-snap
# or
yarn add social-snap
# or
pnpm add social-snap
```

> **Node.js requirement:** Node 18+ is recommended (native `fetch`). For Node 16, polyfill `fetch` with `node-fetch` or `undici`.

---

## Quick Start

```ts
import { SocialSnap } from 'social-snap';

const snap = new SocialSnap();

// Fetch a preview of any supported social media URL
const post = await snap.preview('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

console.log(post.title);          // "Rick Astley - Never Gonna Give You Up"
console.log(post.author?.name);   // "Rick Astley"
console.log(post.metrics?.views); // 1400000000 (if YouTube API key provided)

// Wrap into a snapshot (ready to POST to your backend)
const snapshot = snap.createSnapshot(post);
console.log(snapshot.snapshotId); // "a3f1c2d4-..."
console.log(snapshot.capturedAt); // undefined — stamped server-side

// On your backend, stamp it
const stamped = snap.stamp(snapshot);
console.log(stamped.capturedAt); // "2024-05-01T12:34:56.789Z"
```

---

## Architecture Overview

```
Browser / Frontend                     Your Backend
─────────────────────────────────      ──────────────────────────────
1. User pastes URL into input
2. snap.preview(url)
   └─ detectPlatform(url)
   └─ fetch via proxyUrl (CORS safe) ──► GET /api/proxy?url=<encoded>
   └─ parse response                 ◄── raw platform response
3. snap.createSnapshot(post)
   └─ generates snapshotId (UUID)
   └─ bundles post data + raw
4. POST /api/snapshots ──────────────► receive snapshot body
                                        snap.stamp(snapshot)
                                        └─ adds capturedAt (ISO 8601)
                                        db.save(stamped)
                                    ◄── return stamped snapshot
```

**Key design decisions:**
- `capturedAt` is **always set server-side** to prevent client clock manipulation
- The `proxyUrl` is only used in browser environments; Node.js fetches directly
- `raw` stores the original API/oEmbed response for auditing and re-parsing

---

## Configuration

Pass a config object when creating a `SocialSnap` instance:

```ts
const snap = new SocialSnap({
  proxyUrl: '/api/proxy',   // Your backend proxy endpoint (required for browser use)
  timeout: 10000,           // Request timeout in ms (default: 8000)
  apiKeys: {
    youtube: 'AIza...',     // YouTube Data API v3 key
    twitter: 'AAAA...',     // Twitter/X Bearer token
    instagram: 'EAAb...',   // Facebook/Instagram Graph API access token
  },
});
```

### Config Options

| Option | Type | Default | Description |
|---|---|---|---|
| `proxyUrl` | `string` | `undefined` | Base URL of your proxy endpoint. Used in browser only. |
| `timeout` | `number` | `8000` | Fetch timeout in milliseconds. |
| `apiKeys.youtube` | `string` | `undefined` | YouTube Data API v3 key — unlocks view/like/comment counts. |
| `apiKeys.twitter` | `string` | `undefined` | Twitter/X Bearer token — unlocks engagement metrics. |
| `apiKeys.instagram` | `string` | `undefined` | Facebook Graph API access token — required for Instagram oEmbed. |

---

## API Reference

### `SocialSnap` Class

#### `new SocialSnap(config?)`

Creates a new SDK instance.

```ts
const snap = new SocialSnap(config?: SocialSnapConfig);
```

---

#### `snap.preview(url)`

Fetches post data for a social media URL. Returns a `PostData` object.

```ts
const post = await snap.preview(url: string): Promise<PostData>
```

Throws `UnsupportedPlatformError` if the URL doesn't match any supported platform.
Throws `FetchError` if the network request fails or times out.

---

#### `snap.createSnapshot(post, raw?)`

Wraps a `PostData` object into a `Snapshot` envelope. Generates a unique `snapshotId`. Does **not** set `capturedAt` — that happens server-side via `stamp()`.

```ts
const snapshot = snap.createSnapshot(post: PostData, raw?: unknown): Snapshot
```

---

#### `snap.snap(url)`

Convenience method — calls `preview()` then `createSnapshot()` in one step.

```ts
const snapshot = await snap.snap(url: string): Promise<Snapshot>
```

---

#### `snap.stamp(snapshot, date?)`

Adds a `capturedAt` ISO 8601 timestamp to a snapshot. Call this **on your backend** when you receive the snapshot from the client.

```ts
const stamped = snap.stamp(snapshot: Snapshot, date?: Date): Snapshot & { capturedAt: string }
```

If `date` is omitted, `new Date()` is used (current server time).

---

#### `snap.detectPlatform(url)`

Detects the platform from a URL without making any network requests. Useful for showing a platform badge or icon immediately on paste.

```ts
const platform = snap.detectPlatform(url: string): Platform
// Returns: 'twitter' | 'youtube' | 'instagram' | 'tiktok' | 'linkedin'
```

---

### Snapshot Object

A `Snapshot` is the core data structure produced by the SDK:

```ts
interface Snapshot {
  snapshotId: string;       // UUID generated at snapshot creation
  url: string;              // Original pasted URL
  platform: Platform;       // Detected platform
  capturedAt?: string;      // ISO 8601 — set server-side by stamp()
  raw?: unknown;            // Raw API/oEmbed response (for auditing)
  post: PostData;
}

interface PostData {
  platform: Platform;
  url: string;
  id?: string;              // Platform-native post/video ID
  title?: string;
  description?: string;
  publishedAt?: string;     // ISO 8601 publish date (if available)
  thumbnailUrl?: string;
  embedHtml?: string;       // oEmbed HTML embed code
  author?: Author;
  metrics?: PostMetrics;
}

interface Author {
  name: string;
  username?: string;
  avatarUrl?: string;
  profileUrl?: string;
}

interface PostMetrics {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  reposts?: number;
  quotes?: number;
}
```

---

### Server Helpers

Import from `social-snap/server`:

```ts
import { createProxyHandler, createSnapshotHandler } from 'social-snap/server';
```

#### `createProxyHandler(options?)`

Returns an Express-compatible middleware that proxies upstream requests from the browser, bypassing CORS.

```ts
app.get('/api/proxy', createProxyHandler({
  maxBytes: 500_000,     // Max upstream response size (default: 500KB)
  allowOrigin: '*',      // CORS header value (default: '*')
}));
```

> **Security note:** In production, set `allowOrigin` to your frontend's actual origin rather than `'*'`.

#### `createSnapshotHandler(options)`

Returns an Express-compatible middleware that stamps and saves incoming snapshots.

```ts
app.post('/api/snapshots', createSnapshotHandler({
  onSave: async (snapshot) => {
    // snapshot.capturedAt is already set here
    return await db.snapshots.create({ data: snapshot });
  },
}));
```

The handler expects a request body shaped as `{ snapshot: Snapshot }` and responds with `{ ok: true, data: <saved result> }`.

---

### Error Types

All errors extend `SocialSnapError` (which extends `Error`), so you can catch them broadly or specifically:

```ts
import {
  SocialSnapError,
  UnsupportedPlatformError,
  FetchError,
  ParseError,
} from 'social-snap';

try {
  await snap.preview(url);
} catch (err) {
  if (err instanceof UnsupportedPlatformError) {
    // URL didn't match any supported platform
  } else if (err instanceof FetchError) {
    console.log(err.status); // HTTP status code, if applicable
  } else if (err instanceof ParseError) {
    // Response couldn't be parsed
  }
}
```

| Error | When thrown |
|---|---|
| `UnsupportedPlatformError` | URL doesn't match any supported platform |
| `FetchError` | Network error, timeout, or non-2xx HTTP response |
| `ParseError` | API response couldn't be parsed into a known shape |

---

## Platform Support

| Platform | URL Pattern | Metrics Available | Data Source |
|---|---|---|---|
| **YouTube** | `youtube.com/watch`, `youtu.be`, `youtube.com/shorts` | Views, Likes, Comments | oEmbed + optional Data API v3 |
| **Twitter / X** | `twitter.com/*/status/*`, `x.com/*/status/*` | Likes, Reposts, Replies, Quotes, Impressions | oEmbed + optional API v2 |
| **TikTok** | `tiktok.com/@*/video/*`, `vm.tiktok.com/*` | Title, Author, Thumbnail | oEmbed only (no public metrics API) |
| **Instagram** | `instagram.com/p/*`, `/reel/*`, `/tv/*` | Title, Author, Thumbnail | oEmbed (requires token) → OG tags |
| **LinkedIn** | `linkedin.com/posts/*`, `/feed/update/*` | Title, Description, Thumbnail | OG tags only (no public API) |

### Data Availability by Tier

| Tier | What you get | Requirement |
|---|---|---|
| **OG Tags** (fallback) | Title, description, thumbnail image | None |
| **oEmbed** | Above + author info, embed HTML | None (public) |
| **Official API** | Above + engagement metrics (likes, views, etc.) | API key / token |

---

## API Keys

API keys are entirely optional. Without them, the SDK still returns title, author, and thumbnail. To unlock metrics, register for the relevant developer programs:

### YouTube Data API v3
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **YouTube Data API v3**
3. Create an API key under **Credentials**

```ts
new SocialSnap({ apiKeys: { youtube: 'YOUR_YOUTUBE_API_KEY' } })
```

### Twitter/X API v2
1. Apply at [developer.twitter.com](https://developer.twitter.com/)
2. Create a project and app
3. Copy your **Bearer Token** from the app's Keys & Tokens page

```ts
new SocialSnap({ apiKeys: { twitter: 'YOUR_BEARER_TOKEN' } })
```

### Instagram (Facebook Graph API)
1. Create a Meta developer app at [developers.facebook.com](https://developers.facebook.com/)
2. Add the **oEmbed** product
3. Generate a user or app access token

```ts
new SocialSnap({ apiKeys: { instagram: 'YOUR_ACCESS_TOKEN' } })
```

> Store API keys in environment variables (`.env`) and **never** expose them in browser bundles. Pass them only in your server-side `SocialSnap` instance.

---

## Frontend Integration

### Vanilla TypeScript / JavaScript

```ts
import { SocialSnap, UnsupportedPlatformError } from 'social-snap';

const snap = new SocialSnap({ proxyUrl: '/api/proxy' });

const input = document.getElementById('url-input') as HTMLInputElement;
const previewEl = document.getElementById('preview');

input.addEventListener('paste', async (e) => {
  const url = (e.clipboardData?.getData('text') ?? '').trim();
  if (!url) return;

  try {
    // Detect platform immediately (no network request)
    const platform = snap.detectPlatform(url);
    previewEl.textContent = `Fetching from ${platform}...`;

    // Fetch the preview
    const post = await snap.preview(url);

    // Show preview
    previewEl.innerHTML = `
      <img src="${post.thumbnailUrl}" />
      <h3>${post.title}</h3>
      <p>${post.author?.name}</p>
      ${post.metrics?.likes != null ? `<span>❤️ ${post.metrics.likes.toLocaleString()}</span>` : ''}
    `;

    // Store snapshot on the element for submit
    input.dataset.snapshot = JSON.stringify(snap.createSnapshot(post));
  } catch (err) {
    if (err instanceof UnsupportedPlatformError) {
      previewEl.textContent = 'Unsupported platform.';
    } else {
      previewEl.textContent = 'Could not load preview.';
    }
  }
});

document.getElementById('submit-btn').addEventListener('click', async () => {
  const snapshot = JSON.parse(input.dataset.snapshot ?? 'null');
  if (!snapshot) return;

  await fetch('/api/snapshots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot }),
  });
});
```

### React Hook

```tsx
import { useState, useCallback } from 'react';
import { SocialSnap, Snapshot, UnsupportedPlatformError } from 'social-snap';

const snap = new SocialSnap({ proxyUrl: '/api/proxy' });

export function useSocialSnap() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await snap.snap(url);
      setSnapshot(result);
    } catch (err) {
      if (err instanceof UnsupportedPlatformError) {
        setError('This URL is not from a supported platform.');
      } else {
        setError('Failed to load preview. Please check the URL and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { snapshot, loading, error, fetchPreview };
}
```

---

## Backend Integration

### Express

```ts
import express from 'express';
import { createProxyHandler, createSnapshotHandler } from 'social-snap/server';
import { SocialSnap } from 'social-snap';

const app = express();
app.use(express.json());

// 1. Proxy — lets the browser SDK fetch social media URLs without CORS errors
app.get('/api/proxy', createProxyHandler({
  allowOrigin: 'https://your-frontend.com',
}));

// 2. Snapshot endpoint — stamps and persists incoming snapshots
app.post('/api/snapshots', createSnapshotHandler({
  onSave: async (snapshot) => {
    // snapshot.capturedAt is set here as an ISO 8601 string
    const saved = await db.snapshot.create({ data: snapshot });
    return saved;
  },
}));

app.listen(3000);
```

### Next.js (App Router)

```ts
// app/api/proxy/route.ts
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url');
  if (!url) return Response.json({ error: 'Missing url' }, { status: 400 });

  const upstream = await fetch(decodeURIComponent(url), {
    headers: { 'User-Agent': 'SocialSnapBot/1.0' },
  });
  const data = await upstream.text();
  return new Response(data, {
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'text/plain' },
  });
}

// app/api/snapshots/route.ts
import { SocialSnap } from 'social-snap';

const snap = new SocialSnap();

export async function POST(request: Request) {
  const { snapshot } = await request.json();
  const stamped = snap.stamp(snapshot);
  await db.snapshot.create({ data: stamped });
  return Response.json({ ok: true, data: stamped });
}
```

---

## Building & Publishing

```bash
# Install dev dependencies
pnpm install

# Type-check without emitting
pnpm run lint

# Build (outputs dist/ with ESM, CJS, and .d.ts files)
pnpm run build

# Run tests
pnpm test

# Publish to npm (runs build first via prepublishOnly)
pnpm publish
```

The `dist/` folder will contain:

```
dist/
├── index.js       # ESM
├── index.cjs      # CommonJS
├── index.d.ts     # TypeScript declarations
├── server.js
├── server.cjs
└── server.d.ts
```

---

## Contributing

Contributions are welcome! To add a new platform:

1. Add the platform name to the `Platform` union type in `src/types.ts`
2. Add URL detection patterns to `src/platform.ts`
3. Create a fetcher at `src/fetchers/<platform>.ts` — implement and export `fetch<Platform>(url, ctx): Promise<PostData>`
4. Register the fetcher in the `switch` statement in `src/client.ts`
5. Add tests in `tests/<platform>.test.ts`
6. Update this README and `CHANGELOG.md`

---

## License

MIT © 2026 — see [LICENSE](LICENSE) for details