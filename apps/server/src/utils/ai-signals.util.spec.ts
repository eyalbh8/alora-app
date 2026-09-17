import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  crawlerFromUserAgent,
  hostFromReferrer,
  isAiTraffic,
  parseUserAgent,
  providerFromReferrer,
  providerFromUtmSource,
  resolveProvider,
} from './ai-signals.util';

describe('hostFromReferrer', () => {
  it('extracts and normalizes the hostname', () => {
    assert.equal(hostFromReferrer('https://chatgpt.com/c/abc'), 'chatgpt.com');
    assert.equal(hostFromReferrer('https://www.perplexity.ai/'), 'perplexity.ai');
  });

  it('tolerates a missing scheme', () => {
    assert.equal(hostFromReferrer('claude.ai/chat'), 'claude.ai');
  });

  it('returns null for empty or unparseable values', () => {
    assert.equal(hostFromReferrer(null), null);
    assert.equal(hostFromReferrer(''), null);
    assert.equal(hostFromReferrer('   '), null);
  });
});

describe('providerFromReferrer', () => {
  it('maps known AI chat hosts', () => {
    assert.equal(providerFromReferrer('https://chatgpt.com/c/1'), 'OPENAI');
    assert.equal(providerFromReferrer('https://chat.openai.com/'), 'OPENAI');
    assert.equal(providerFromReferrer('https://claude.ai/chat/x'), 'ANTHROPIC');
    assert.equal(providerFromReferrer('https://www.perplexity.ai/search'), 'PERPLEXITY');
    assert.equal(providerFromReferrer('https://gemini.google.com/app'), 'GEMINI');
    assert.equal(providerFromReferrer('https://copilot.microsoft.com/'), 'BD_COPILOT');
  });

  it('matches subdomains of a known host', () => {
    assert.equal(providerFromReferrer('https://foo.chatgpt.com/x'), 'OPENAI');
  });

  it('does not substring-match unrelated domains', () => {
    // The iGEO tracker matched on bare substrings, so these were false positives.
    assert.equal(providerFromReferrer('https://grokkingalgorithms.com/post'), null);
    assert.equal(providerFromReferrer('https://claude-monet-gallery.com'), null);
    assert.equal(providerFromReferrer('https://mygeminijewelry.com'), null);
  });

  it('ignores ordinary search engines', () => {
    assert.equal(providerFromReferrer('https://www.bing.com/search?q=x'), null);
    assert.equal(providerFromReferrer('https://www.google.com/search?q=x'), null);
  });
});

describe('providerFromUtmSource', () => {
  it('maps known tokens', () => {
    assert.equal(providerFromUtmSource('chatgpt'), 'OPENAI');
    assert.equal(providerFromUtmSource('chat-gpt'), 'OPENAI');
    assert.equal(providerFromUtmSource('Claude'), 'ANTHROPIC');
    assert.equal(providerFromUtmSource('perplexity-ai'), 'PERPLEXITY');
    assert.equal(providerFromUtmSource('copilot'), 'BD_COPILOT');
  });

  it('prefers the more specific token', () => {
    assert.equal(providerFromUtmSource('chat-gpt-share'), 'OPENAI');
    assert.equal(providerFromUtmSource('meta-ai'), 'META');
  });

  it('returns null for unrelated sources', () => {
    assert.equal(providerFromUtmSource('newsletter'), null);
    assert.equal(providerFromUtmSource(''), null);
    assert.equal(providerFromUtmSource(null), null);
  });
});

describe('crawlerFromUserAgent', () => {
  it('identifies AI crawlers and attributes a provider', () => {
    assert.deepEqual(
      crawlerFromUserAgent('Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'),
      { botName: 'GPTBot', provider: 'OPENAI' },
    );
    assert.deepEqual(crawlerFromUserAgent('ClaudeBot/1.0'), {
      botName: 'ClaudeBot',
      provider: 'ANTHROPIC',
    });
    assert.deepEqual(crawlerFromUserAgent('PerplexityBot/1.0'), {
      botName: 'PerplexityBot',
      provider: 'PERPLEXITY',
    });
  });

  it('reports the most specific bot name', () => {
    assert.deepEqual(crawlerFromUserAgent('GrokBot/1.0'), {
      botName: 'GrokBot',
      provider: 'GROK',
    });
    assert.deepEqual(crawlerFromUserAgent('Mozilla/5.0 ChatGPT-User/1.0'), {
      botName: 'ChatGPT-User',
      provider: 'OPENAI',
    });
  });

  it('logs generic training crawlers without a provider', () => {
    assert.deepEqual(crawlerFromUserAgent('CCBot/2.0'), {
      botName: 'CCBot',
      provider: null,
    });
  });

  it('returns null for ordinary browsers', () => {
    const chrome =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    assert.equal(crawlerFromUserAgent(chrome), null);
    assert.equal(crawlerFromUserAgent(''), null);
  });
});

describe('resolveProvider', () => {
  it('prefers the referrer over utm_source', () => {
    const provider = resolveProvider({
      referrer: 'https://claude.ai/chat',
      utmSource: 'chatgpt',
    });
    assert.equal(provider, 'ANTHROPIC');
  });

  it('falls back to utm_source when the referrer is stripped', () => {
    assert.equal(resolveProvider({ referrer: null, utmSource: 'perplexity' }), 'PERPLEXITY');
  });

  it('falls back to the crawler user agent last', () => {
    assert.equal(
      resolveProvider({ referrer: null, utmSource: null, userAgent: 'GPTBot/1.0' }),
      'OPENAI',
    );
  });

  it('returns null when nothing matches', () => {
    assert.equal(
      resolveProvider({ referrer: 'https://news.ycombinator.com', utmSource: null }),
      null,
    );
  });
});

describe('isAiTraffic', () => {
  it('accepts any single matching signal', () => {
    assert.equal(isAiTraffic({ referrer: 'https://chatgpt.com/c/1' }), true);
    assert.equal(isAiTraffic({ utmSource: 'claude' }), true);
    assert.equal(isAiTraffic({ userAgent: 'CCBot/2.0' }), true);
  });

  it('rejects ordinary traffic', () => {
    assert.equal(
      isAiTraffic({
        referrer: 'https://news.ycombinator.com',
        utmSource: 'newsletter',
        userAgent: 'Mozilla/5.0 Chrome/120.0',
      }),
      false,
    );
    assert.equal(isAiTraffic({}), false);
  });
});

describe('parseUserAgent', () => {
  it('parses a desktop Chrome user agent', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    );
    assert.deepEqual(result, { browser: 'Chrome', os: 'macOS', device: 'desktop' });
  });

  it('parses an iPhone Safari user agent as mobile', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    assert.deepEqual(result, { browser: 'Safari', os: 'iOS', device: 'mobile' });
  });

  it('prefers Edge over the Chrome token it embeds', () => {
    const result = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0',
    );
    assert.deepEqual(result, { browser: 'Edge', os: 'Windows', device: 'desktop' });
  });

  it('falls back to Other for unknown agents', () => {
    assert.deepEqual(parseUserAgent('GPTBot/1.0'), {
      browser: 'Other',
      os: 'Other',
      device: 'desktop',
    });
    assert.deepEqual(parseUserAgent(null), {
      browser: 'Other',
      os: 'Other',
      device: 'desktop',
    });
  });
});
