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
  source: 'wp-rest' | 'feed' | 'html' | 'ai-scan';
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
      headers: {
        Accept:
          'text/html,application/xhtml+xml,application/json,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (compatible; MenchlyBlogTracker/1.0; +https://app.menchly.com)',
      },
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
    const viaHtml = await findViaHtmlListing(root, input.localDate, timeoutMs);
    if (viaHtml) return viaHtml;
  }
  return null;
}

const MONTH_INDEX: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

const LISTING_DATE_RE =
  /\b(?:updated\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),\s+(\d{4})\b/gi;

function listingDateToIso(month: string, day: string, year: string): string {
  return `${year}-${MONTH_INDEX[month.toLowerCase()]}-${day.padStart(2, '0')}`;
}

function decodeHref(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function isArticleHref(href: string, listingUrl: string): boolean {
  let parsed: URL;
  let listing: URL;
  try {
    parsed = new URL(href, listingUrl);
    listing = new URL(listingUrl);
  } catch {
    return false;
  }
  if (parsed.origin !== listing.origin) return false;
  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  if (/\/(?:category|tag|author|page|topics?)\b/i.test(path)) return false;
  if (path === '/' || path === '/blog') return false;
  return /\/blog\//i.test(path);
}

function stripTags(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Custom /blog indexes (Growbi-style) put the published date next to the
 * article link. WP REST and RSS miss those entirely.
 */
export async function findViaHtmlListing(
  listingUrl: string,
  localDate: string,
  timeoutMs: number,
): Promise<BlogArticleCandidate | null> {
  const pages = [listingUrl.replace(/\/+$/, ''), `${listingUrl.replace(/\/+$/, '')}/blog`];
  const seenPages = new Set<string>();

  for (const page of pages) {
    if (seenPages.has(page)) continue;
    seenPages.add(page);
    const body = await fetchBody(page, timeoutMs);
    if (!body || !/<a\s/i.test(body)) continue;

    const found = pickHtmlListingArticle(body, page, localDate);
    if (found) return found;
  }
  return null;
}

export function pickHtmlListingArticle(
  html: string,
  listingUrl: string,
  localDate: string,
): BlogArticleCandidate | null {
  const hrefs = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(
    (m) => decodeHref(m[1]),
  );
  const articleUrls = [...new Set(hrefs.map((href) => {
    try {
      return new URL(href, listingUrl).toString();
    } catch {
      return '';
    }
  }).filter((href) => isArticleHref(href, listingUrl)))];

  LISTING_DATE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LISTING_DATE_RE.exec(html))) {
    const iso = listingDateToIso(match[1], match[2], match[3]);
    if (iso !== localDate) continue;
    const before = html.slice(Math.max(0, match.index - 700), match.index);
    const hrefs = [...before.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) =>
      decodeHref(m[1]),
    );
    for (let i = hrefs.length - 1; i >= 0; i--) {
      try {
        const url = new URL(hrefs[i], listingUrl).toString();
        if (isArticleHref(url, listingUrl)) {
          return { url, publishedAt: iso, source: 'html' };
        }
      } catch {
        continue;
      }
    }
  }

  // Fallback: date and title sit in nearby text even if the href window missed.
  const text = stripTags(html);
  LISTING_DATE_RE.lastIndex = 0;
  while ((match = LISTING_DATE_RE.exec(text))) {
    const iso = listingDateToIso(match[1], match[2], match[3]);
    if (iso !== localDate) continue;
    const around = text.slice(Math.max(0, match.index - 180), match.index + 220);
    const hit = articleUrls.find((url) => {
      const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
      return slug.length > 4 && around.toLowerCase().includes(slug.replace(/-/g, ' ').slice(0, 24));
    });
    if (hit) return { url: hit, publishedAt: iso, source: 'html' };
  }
  return null;
}

export async function findBlogArticleViaAiScan(input: {
  listingUrl: string;
  localDate: string;
  completeJson: (system: string, user: string) => Promise<Record<string, unknown>>;
  timeoutMs?: number;
}): Promise<BlogArticleCandidate | null> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pages = [
    input.listingUrl.replace(/\/+$/, ''),
    `${input.listingUrl.replace(/\/+$/, '')}/blog`,
  ];
  for (const page of [...new Set(pages)]) {
    const body = await fetchBody(page, timeoutMs);
    if (!body) continue;
    const text = stripTags(body).slice(0, 12_000);
    if (text.length < 40) continue;
    const hrefs = [...body.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)]
      .map((m) => {
        try {
          return new URL(decodeHref(m[1]), page).toString();
        } catch {
          return '';
        }
      })
      .filter((href) => isArticleHref(href, page));
    const uniqueHrefs = [...new Set(hrefs)].slice(0, 40);
    try {
      const parsed = await input.completeJson(
        'You pick the blog article published on a given local calendar day from a site listing. Return JSON only.',
        [
          `localDate: ${input.localDate}`,
          `listingUrl: ${page}`,
          `candidateUrls:\n${uniqueHrefs.join('\n')}`,
          `listingText:\n${text}`,
          'Return {"url":"https://...","publishedAt":"YYYY-MM-DD","title":"..."} or {"url":null} if none match that day.',
        ].join('\n\n'),
      );
      const url = parsed.url != null ? String(parsed.url).trim() : '';
      if (!url || !/^https?:\/\//i.test(url) || !isArticleHref(url, page)) continue;
      const publishedAt =
        parsed.publishedAt != null && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.publishedAt))
          ? String(parsed.publishedAt)
          : input.localDate;
      if (publishedAt !== input.localDate) continue;
      return { url, publishedAt, source: 'ai-scan' };
    } catch {
      continue;
    }
  }
  return null;
}
