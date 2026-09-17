/**
 * AI traffic detection signals.
 *
 * Pure functions with no Nest dependencies so they stay unit-testable and can be
 * shared between the public ingest endpoint and the no-JS pixel fallback.
 *
 * Provider codes are the canonical set the client already renders
 * (see AI_TRAFFIC_PROVIDER_ORDER + normalizeTrafficProvider in the client), so
 * aggregates can be emitted without a second translation step.
 */

export const AI_PROVIDERS = [
  'OPENAI',
  'ANTHROPIC',
  'PERPLEXITY',
  'GEMINI',
  'BD_COPILOT',
  'GROK',
  'DEEPSEEK',
  'META',
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Providers rendered as entry cards on the AI Traffic screen, in display order. */
export const DASHBOARD_PROVIDERS: AiProvider[] = [
  'OPENAI',
  'ANTHROPIC',
  'PERPLEXITY',
  'GEMINI',
  'BD_COPILOT',
];

export const EVENT_SOURCE = {
  USER: 'USER',
  AI_CRAWLER: 'AI_CRAWLER',
} as const;

export type EventSource = (typeof EVENT_SOURCE)[keyof typeof EVENT_SOURCE];

/**
 * Referrer hosts, matched as an exact hostname or a subdomain of it.
 *
 * Deliberately excludes bare `bing.com` and `google.com`: those carry ordinary
 * search traffic, and counting them as AI referrals overstates the numbers.
 */
const REFERRER_HOSTS: Array<[string, AiProvider]> = [
  ['chatgpt.com', 'OPENAI'],
  ['chat.openai.com', 'OPENAI'],
  ['openai.com', 'OPENAI'],
  ['claude.ai', 'ANTHROPIC'],
  ['anthropic.com', 'ANTHROPIC'],
  ['perplexity.ai', 'PERPLEXITY'],
  ['pplx.ai', 'PERPLEXITY'],
  ['gemini.google.com', 'GEMINI'],
  ['bard.google.com', 'GEMINI'],
  ['aistudio.google.com', 'GEMINI'],
  ['copilot.microsoft.com', 'BD_COPILOT'],
  ['edgeservices.bing.com', 'BD_COPILOT'],
  ['grok.com', 'GROK'],
  ['grok.x.ai', 'GROK'],
  ['x.ai', 'GROK'],
  ['chat.deepseek.com', 'DEEPSEEK'],
  ['deepseek.com', 'DEEPSEEK'],
  ['meta.ai', 'META'],
];

/**
 * utm_source tokens, matched as substrings of a lowercased utm_source.
 *
 * Ordered longest-first so `chat-gpt` wins before `gpt` and `meta-ai` before `meta`.
 */
const UTM_TOKENS: Array<[string, AiProvider]> = [
  ['chat-gpt', 'OPENAI'],
  ['chatgpt', 'OPENAI'],
  ['openai', 'OPENAI'],
  ['anthropic', 'ANTHROPIC'],
  ['claude', 'ANTHROPIC'],
  ['perplexity', 'PERPLEXITY'],
  ['pplx', 'PERPLEXITY'],
  ['gemini', 'GEMINI'],
  ['bard', 'GEMINI'],
  ['copilot', 'BD_COPILOT'],
  ['bing-chat', 'BD_COPILOT'],
  ['bingchat', 'BD_COPILOT'],
  ['deepseek', 'DEEPSEEK'],
  ['grok', 'GROK'],
  ['meta-ai', 'META'],
  ['metaai', 'META'],
  ['llama', 'META'],
  ['gpt', 'OPENAI'],
];

/**
 * Crawler user agents. The second slot is the provider the bot is attributed to,
 * or null for generic AI-training crawlers that are logged but not charted.
 *
 * Ordered most-specific-first so the reported bot name is the precise one
 * (`GrokBot` rather than `Grok`).
 */
const CRAWLER_AGENTS: Array<[string, AiProvider | null]> = [
  ['ChatGPT-User', 'OPENAI'],
  ['OAI-SearchBot', 'OPENAI'],
  ['GPTBot', 'OPENAI'],
  ['ClaudeBot', 'ANTHROPIC'],
  ['Claude-Web', 'ANTHROPIC'],
  ['Claude-User', 'ANTHROPIC'],
  ['anthropic-ai', 'ANTHROPIC'],
  ['PerplexityBot', 'PERPLEXITY'],
  ['Perplexity-User', 'PERPLEXITY'],
  ['Google-Extended', 'GEMINI'],
  ['GoogleOther', 'GEMINI'],
  ['BingPreview', 'BD_COPILOT'],
  ['bingbot', 'BD_COPILOT'],
  ['GrokBot', 'GROK'],
  ['Grok', 'GROK'],
  ['DeepSeekBot', 'DEEPSEEK'],
  ['DeepSeek', 'DEEPSEEK'],
  ['Meta-ExternalAgent', 'META'],
  ['meta-externalfetcher', 'META'],
  ['facebookexternalhit', 'META'],
  ['Applebot-Extended', null],
  ['Applebot', null],
  ['CCBot', null],
  ['YouBot', null],
  ['cohere-ai', null],
  ['Amazonbot', null],
  ['Twitterbot', null],
  ['ia_archiver', null],
];

/** Extract a normalized hostname from a referrer, tolerating scheme-less values. */
export function hostFromReferrer(referrer: string | null | undefined): string | null {
  const trimmed = referrer?.trim();
  if (!trimmed) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const { hostname } = new URL(withScheme);
    return hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

export function providerFromReferrer(
  referrer: string | null | undefined,
): AiProvider | null {
  const host = hostFromReferrer(referrer);
  if (!host) return null;

  for (const [candidate, provider] of REFERRER_HOSTS) {
    if (host === candidate || host.endsWith(`.${candidate}`)) {
      return provider;
    }
  }
  return null;
}

export function providerFromUtmSource(
  utmSource: string | null | undefined,
): AiProvider | null {
  const value = utmSource?.trim().toLowerCase();
  if (!value) return null;

  for (const [token, provider] of UTM_TOKENS) {
    if (value.includes(token)) return provider;
  }
  return null;
}

export function crawlerFromUserAgent(
  userAgent: string | null | undefined,
): { botName: string; provider: AiProvider | null } | null {
  const value = userAgent?.trim().toLowerCase();
  if (!value) return null;

  for (const [botName, provider] of CRAWLER_AGENTS) {
    if (value.includes(botName.toLowerCase())) {
      return { botName, provider };
    }
  }
  return null;
}

export interface ProviderSignals {
  referrer?: string | null;
  utmSource?: string | null;
  userAgent?: string | null;
}

/**
 * Resolve the provider for an event. Referrer is the strongest signal, then
 * utm_source, then the crawler user agent.
 */
export function resolveProvider(signals: ProviderSignals): AiProvider | null {
  return (
    providerFromReferrer(signals.referrer) ??
    providerFromUtmSource(signals.utmSource) ??
    crawlerFromUserAgent(signals.userAgent)?.provider ??
    null
  );
}

/** True when any signal marks this request as AI traffic worth storing. */
export function isAiTraffic(signals: ProviderSignals): boolean {
  return (
    providerFromReferrer(signals.referrer) !== null ||
    providerFromUtmSource(signals.utmSource) !== null ||
    crawlerFromUserAgent(signals.userAgent) !== null
  );
}

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: 'mobile' | 'desktop';
}

/**
 * Minimal user-agent parse, mirroring what the browser tracker sends so the
 * no-JS pixel path can populate the same columns.
 *
 * Edge and Opera are checked before Chrome, and Chrome before Safari, because
 * those user agents all embed the earlier tokens.
 */
export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = (userAgent ?? '').toLowerCase();

  const browser = /edg/.test(ua)
    ? 'Edge'
    : /opr|opera/.test(ua)
      ? 'Opera'
      : /firefox|fxios/.test(ua)
        ? 'Firefox'
        : /chrome|crios/.test(ua)
          ? 'Chrome'
          : /safari/.test(ua)
            ? 'Safari'
            : 'Other';

  const os = /windows/.test(ua)
    ? 'Windows'
    : /iphone|ipad|ipod/.test(ua)
      ? 'iOS'
      : /android/.test(ua)
        ? 'Android'
        : /mac os|macintosh/.test(ua)
          ? 'macOS'
          : /linux/.test(ua)
            ? 'Linux'
            : 'Other';

  const device: ParsedUserAgent['device'] = /mobile|android|iphone|ipad|ipod/.test(ua)
    ? 'mobile'
    : 'desktop';

  return { browser, os, device };
}

/**
 * Normalize a provider code arriving from a client filter into the canonical set.
 *
 * Mirrors normalizeTrafficProvider on the client so `CLAUDE` and `COPILOT` style
 * aliases resolve to the same codes the aggregates are keyed by.
 */
export function normalizeProviderCode(raw: string): string {
  const key = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (key.includes('OPENAI') || key.includes('CHAT') || key === 'GPT') return 'OPENAI';
  if (key.includes('ANTHROPIC') || key.includes('CLAUDE')) return 'ANTHROPIC';
  if (key.includes('PERPLEXITY')) return 'PERPLEXITY';
  if (key.includes('GEMINI')) return 'GEMINI';
  if (key.includes('COPILOT')) return 'BD_COPILOT';
  if (key.includes('GROK')) return 'GROK';
  if (key.includes('DEEPSEEK')) return 'DEEPSEEK';
  if (key.includes('META') || key.includes('LLAMA')) return 'META';
  return key;
}

/** Display label per provider, used for the `domain` field in dashboard aggregates. */
const PROVIDER_LABELS: Record<AiProvider, string> = {
  OPENAI: 'ChatGPT',
  ANTHROPIC: 'Claude',
  PERPLEXITY: 'Perplexity',
  GEMINI: 'Gemini',
  BD_COPILOT: 'Copilot',
  GROK: 'Grok',
  DEEPSEEK: 'DeepSeek',
  META: 'Meta AI',
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider as AiProvider] ?? provider;
}
