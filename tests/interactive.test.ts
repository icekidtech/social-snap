/**
 * social-snap — Interactive Terminal Test
 *
 * Prompts you for a social media URL, runs it through the full SDK pipeline,
 * and prints a detailed breakdown of every step.
 *
 * Usage:
 *   npx tsx tests/interactive.ts
 *
 * With API keys:
 *   YOUTUBE_API_KEY=AIza... TWITTER_BEARER=AAAA... npx tsx tests/interactive.ts
 */

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output, env } from 'node:process';
import { SocialSnap } from '../src/index';
import { diffSnapshots, isValidSnapshot } from '../src/snapshot';
import { detectPlatform } from '../src/detectors/platform';
import { UnsupportedPlatformError, FetchError } from '../src/errors';

// ─── Colours ────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

const PLATFORM_ICON: Record<string, string> = {
  youtube: '▶  YouTube',
  twitter: '𝕏  Twitter / X',
  instagram: '📸 Instagram',
  tiktok: '🎵 TikTok',
  linkedin: '💼 LinkedIn',
};

function header(text: string) {
  const line = '─'.repeat(60);
  console.log(`\n${c.cyan}${line}${c.reset}`);
  console.log(`${c.bold}${c.cyan}  ${text}${c.reset}`);
  console.log(`${c.cyan}${line}${c.reset}`);
}

function field(label: string, value: unknown, indent = 2) {
  const pad = ' '.repeat(indent);
  if (value === undefined || value === null) {
    console.log(`${pad}${c.dim}${label.padEnd(18)} —${c.reset}`);
  } else {
    const formatted =
      typeof value === 'number' ? value.toLocaleString() : String(value);
    console.log(`${pad}${c.yellow}${label.padEnd(18)}${c.reset} ${formatted}`);
  }
}

function section(title: string) {
  console.log(`\n  ${c.bold}${c.blue}${title}${c.reset}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log(`\n${c.bold}${c.magenta}  social-snap — Interactive Test Runner${c.reset}`);
  console.log(`${c.dim}  Running in Node.js (server mode — fetches directly, no proxy needed)${c.reset}\n`);

  // Pick up optional API keys from environment
  const snap = new SocialSnap({
    apiKeys: {
      youtubeApiKey: env['YOUTUBE_API_KEY'],
      twitterBearerToken: env['TWITTER_BEARER'],
      instagramAccessToken: env['INSTAGRAM_TOKEN'],
    },
  });

  if (env['YOUTUBE_API_KEY']) console.log(`  ${c.green}✔${c.reset} YouTube API key loaded`);
  if (env['TWITTER_BEARER']) console.log(`  ${c.green}✔${c.reset} Twitter Bearer token loaded`);
  if (env['INSTAGRAM_TOKEN']) console.log(`  ${c.green}✔${c.reset} Instagram access token loaded`);
  if (!env['YOUTUBE_API_KEY'] && !env['TWITTER_BEARER'] && !env['INSTAGRAM_TOKEN']) {
    console.log(`  ${c.dim}ℹ  No API keys found. Running on oEmbed / OG tags only.`);
    console.log(`     Set YOUTUBE_API_KEY, TWITTER_BEARER, or INSTAGRAM_TOKEN for full metrics.${c.reset}`);
  }

  const rl = readline.createInterface({ input, output });

  let running = true;
  let previousSnapshot: ReturnType<typeof snap.stamp> | null = null;

  while (running) {
    header('Enter a social media URL to snapshot');

    const raw = await rl.question(
      `  ${c.bold}URL${c.reset} (or ${c.dim}"q" to quit, "diff" to compare with last${c.reset}): `
    );
    const url = raw.trim();

    if (url.toLowerCase() === 'q' || url.toLowerCase() === 'quit') {
      running = false;
      break;
    }

    // ── Platform detection (instant, no network) ──
    console.log();
    process.stdout.write(`  ${c.dim}Detecting platform...${c.reset} `);

    let platform: string;
    try {
      platform = detectPlatform(url);
      console.log(`${c.green}${PLATFORM_ICON[platform] ?? platform}${c.reset}`);
    } catch (err) {
      if (err instanceof UnsupportedPlatformError) {
        console.log(`${c.red}✖  Unsupported platform${c.reset}`);
        console.log(`\n  ${c.red}${err.message}${c.reset}`);
        console.log(`  ${c.dim}Supported: Twitter/X, YouTube, Instagram, TikTok, LinkedIn${c.reset}\n`);
        continue;
      }
      throw err;
    }

    // ── Fetch preview ──
    process.stdout.write(`  ${c.dim}Fetching post data...${c.reset} `);
    const fetchStart = Date.now();

    let snapshot: ReturnType<typeof snap.stamp>;
    try {
      const rawSnapshot = await snap.snap(url);
      // Stamp it (simulating what your backend would do)
      snapshot = snap.stamp(rawSnapshot);
      const elapsed = Date.now() - fetchStart;
      console.log(`${c.green}✔  done in ${elapsed}ms${c.reset}`);
    } catch (err) {
      console.log(`${c.red}✖  failed${c.reset}`);
      if (err instanceof FetchError) {
        console.log(`\n  ${c.red}Fetch error: ${err.message}${c.reset}`);
        if (err.status) console.log(`  ${c.dim}HTTP status: ${err.status}${c.reset}`);
      } else {
        console.log(`\n  ${c.red}${String(err)}${c.reset}`);
      }
      console.log();
      continue;
    }

    // ── Print results ──
    header('Snapshot Result');

    section('Snapshot Envelope');
    field('snapshotId', snapshot.snapshotId);
    field('platform', PLATFORM_ICON[snapshot.platform] ?? snapshot.platform);
    field('capturedAt', snapshot.capturedAt);
    field('url', snapshot.url.length > 55 ? snapshot.url.slice(0, 52) + '...' : snapshot.url);

    section('Post Content');
    field('title', snapshot.post.title);
    field('description',
      snapshot.post.description
        ? snapshot.post.description.slice(0, 80) + (snapshot.post.description.length > 80 ? '…' : '')
        : undefined
    );
    field('publishedAt', snapshot.post.publishedAt);
    field('thumbnailUrl', snapshot.post.thumbnailUrl ? '✔  present' : undefined);
    field('embedHtml', snapshot.post.embedHtml ? '✔  present' : undefined);
    field('postId', snapshot.post.id);

    section('Author');
    field('name', snapshot.post.author?.name);
    field('username',
      snapshot.post.author?.username ? `@${snapshot.post.author.username}` : snapshot.post.author?.username
    );
    field('profileUrl', snapshot.post.author?.profileUrl);
    field('avatarUrl', snapshot.post.author?.avatarUrl ? '✔  present' : undefined);

    section('Engagement Metrics');
    const m = snapshot.post.metrics;
    if (!m || Object.keys(m).length === 0) {
      console.log(`    ${c.dim}No metrics available — provide an API key to unlock.${c.reset}`);
    } else {
      field('views', m.views);
      field('likes', m.likes);
      field('comments', m.comments);
      field('reposts', m.reposts);
      field('quotes', m.quotes);
      field('shares', m.shares);
    }

    // ── Snapshot validation ──
    section('Validation');
    const valid = isValidSnapshot(snapshot);
    console.log(`    isValidSnapshot()  ${valid ? `${c.green}✔  pass${c.reset}` : `${c.red}✖  fail${c.reset}`}`);

    // ── Diff with previous ──
    if (url.toLowerCase() === 'diff' && previousSnapshot) {
      if (previousSnapshot.url === snapshot.url) {
        section('Metrics Diff (vs previous snapshot)');
        try {
          const diff = diffSnapshots(previousSnapshot, snapshot);
          const keys = Object.keys(diff.diff) as Array<keyof typeof diff.diff>;
          if (keys.length === 0) {
            console.log(`    ${c.dim}No comparable metrics between snapshots.${c.reset}`);
          } else {
            for (const key of keys) {
              const val = diff.diff[key]!;
              const sign = val > 0 ? `+${val}` : String(val);
              const colour = val > 0 ? c.green : val < 0 ? c.red : c.dim;
              console.log(`    ${key.padEnd(16)} ${colour}${sign}${c.reset}`);
            }
          }
        } catch (e) {
          console.log(`    ${c.red}${String(e)}${c.reset}`);
        }
      } else {
        console.log(`\n    ${c.dim}Previous snapshot was for a different URL — no diff available.${c.reset}`);
      }
    }

    // ── Raw JSON ──
    console.log();
    const showJson = await rl.question(
      `  ${c.dim}Print full JSON snapshot? (y/N):${c.reset} `
    );
    if (showJson.trim().toLowerCase() === 'y') {
      console.log(`\n${c.dim}${JSON.stringify(snapshot, null, 2)}${c.reset}\n`);
    }

    previousSnapshot = snapshot;
  }

  rl.close();
  console.log(`\n${c.dim}  Goodbye!${c.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${c.red}Unexpected error:${c.reset}`, err);
  process.exit(1);
});
