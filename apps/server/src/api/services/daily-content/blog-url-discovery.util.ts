/**
 * Find the live URL of a blog article published on a given account-local day.
 *
 * WordPress REST first (clean JSON, no parsing), then RSS/Atom by regex so we
 * avoid pulling in an XML parser for one nightly job.
 */
import { getLocalClock, localDateDaysAgo } from '../../../utils/account-local-time.util';

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_BODY_CHARS = 500_000;

const FEED_PATHS = ['/feed', '/rss.xml', '/feed.xml', '/atom.xml', '/blog/feed'];

export type BlogArticleCandidate = {
  url: string;
  publishedAt: string | null;
  source: 'wp-rest' | 'feed';
};

/**
 * Candidate roots to probe: the site URL as given, plus its bare origin so a
 * `https://example.com/blog` entry still finds `https://example.com/wp-json`.
 */
export function blogRootCandidates(baseUrl: string): string[] {
  const trimmed = String(baseUrl || '').trim();
  if (!trimmed) return [];

  // A dot-free prefix before ':' is a scheme; `example.com:8080` is a host:port.
  const hasScheme = /^[a-z][a-z0-9+-]*:/i.test(trimmed);
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) return [];
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return [];
  }
  if (!/^https?:$/i.test(parsed.protocol) || !parsed.hostname) return [];

  const full = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  const roots = [full || parsed.origin, parsed.origin];
  return [...new Set(roots.filter(Boolean))];
}

async function fetchBody(url: string, timeoutMs: number): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json, application/rss+xml, application/xml, text/xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;
  try {
    const text = await response.text();
    return text.slice(0, MAX_BODY_CHARS);
  } catch {
    return null;
  }
}

/** WordPress emits naive UTC in date_gmt; mark it so Date parses it as UTC. */
function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const stamped = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed) ? trimmed : `${trimmed}Z`;
  const direct = new Date(stamped);
  if (!Number.isNaN(direct.getTime())) return direct;
  const loose = new Date(trimmed);
  return Number.isNaN(loose.getTime()) ? null : loose;
}

function isOnLocalDate(
  value: string | null,
  localDate: string,
  timeZone: string,
): boolean {
  const parsed = parseDate(value);
  if (!parsed) return false;
  return getLocalClock(parsed, timeZone).localDate === localDate;
}

function stripCdata(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .trim();
}

function firstTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  return match ? stripCdata(match[1]) : null;
}

/** RSS uses <link>text</link>; Atom uses <link rel="alternate" href="…"/>. */
function entryLink(block: string): string | null {
  const inline = firstTag(block, 'link');
  if (inline && /^https?:\/\//i.test(inline)) return inline;

  const hrefs = [...block.matchAll(/<link\b([^>]*)\/?>/gi)];
  for (const [, attrs] of hrefs) {
    if (/rel\s*=\s*["'](?!alternate)/i.test(attrs)) continue;
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (href && /^https?:\/\//i.test(href[1])) return stripCdata(href[1]);
  }
  return null;
}

function entryDate(block: string): string | null {
  return (
    firstTag(block, 'pubDate') ||
    firstTag(block, 'published') ||
    firstTag(block, 'dc:date') ||
    firstTag(block, 'updated')
  );
}

async function findViaWordPress(
  root: string,
  localDate: string,
  timeZone: string,
  timeoutMs: number,
): Promise<BlogArticleCandidate | null> {
  // Widen by a day on each side, then filter in the account's timezone, since
  // the site's own date filter has no idea about the tenant's local calendar.
  const after = `${localDateDaysAgo(localDate, 1)}T00:00:00`;
  const before = `${localDateDaysAgo(localDate, -1)}T23:59:59`;
  const query = new URLSearchParams({
    after,
    before,
    per_page: '20',
    orderby: 'date',
    order: 'desc',
    _fields: 'link,date,date_gmt',
  });

  const body = await fetchBody(`${root}/wp-json/wp/v2/posts?${query.toString()}`, timeoutMs);
  if (!body) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const link = row.link != null ? String(row.link) : null;
    if (!link || !/^https?:\/\//i.test(link)) continue;
    const stamp =
      row.date_gmt != null
        ? String(row.date_gmt)
        : row.date != null
          ? String(row.date)
          : null;
    if (!isOnLocalDate(stamp, localDate, timeZone)) continue;
    return { url: link, publishedAt: stamp, source: 'wp-rest' };
  }
  return null;
}

async function findViaFeed(
  root: string,
  localDate: string,
  timeZone: string,
  timeoutMs: number,
): Promise<BlogArticleCandidate | null> {
  for (const path of FEED_PATHS) {
    const body = await fetchBody(`${root}${path}`, timeoutMs);
    if (!body || !/<(?:item|entry)\b/i.test(body)) continue;

    const blocks = [
      ...body.matchAll(/<item\b[\s\S]*?<\/item>/gi),
      ...body.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
    ].map((m) => m[0]);

    const dated = blocks
      .map((block) => ({
        url: entryLink(block),
        stamp: entryDate(block),
      }))
      .filter((row) => row.url && isOnLocalDate(row.stamp, localDate, timeZone))
      .map((row) => ({
        url: row.url as string,
        stamp: row.stamp,
        time: parseDate(row.stamp)?.getTime() ?? 0,
      }));

    if (!dated.length) continue;
    dated.sort((a, b) => b.time - a.time);
    return { url: dated[0].url, publishedAt: dated[0].stamp, source: 'feed' };
  }
  return null;
}

/**
 * Newest article published on `localDate` in the account's timezone, or null.
 * Never throws: a blog that is unreachable or has no feed is not an error.
 */
export async function findBlogArticleForDay(input: {
  baseUrl: string;
  localDate: string;
  timeZone: string;
  timeoutMs?: number;
}): Promise<BlogArticleCandidate | null> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  for (const root of blogRootCandidates(input.baseUrl)) {
    const viaWp = await findViaWordPress(root, input.localDate, input.timeZone, timeoutMs);
    if (viaWp) return viaWp;
    const viaFeed = await findViaFeed(root, input.localDate, input.timeZone, timeoutMs);
    if (viaFeed) return viaFeed;
  }
  return null;
}
