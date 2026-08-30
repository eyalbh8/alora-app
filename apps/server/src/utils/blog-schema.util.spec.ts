import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBlogJsonLd,
  injectJsonLd,
  stripJsonLd,
} from '../api/services/daily-content/blog-schema.util';

describe('stripJsonLd', () => {
  it('removes ld+json script blocks', () => {
    const html =
      '<p>Hi</p><script type="application/ld+json">{"@type":"Article"}</script>';
    assert.equal(stripJsonLd(html), '<p>Hi</p>');
  });
});

describe('buildBlogJsonLd + injectJsonLd', () => {
  it('builds graph from brand and post only', () => {
    const schema = buildBlogJsonLd(
      { title: 'Acme', domains: ['acme.com'], logo: 'https://acme.com/logo.png' },
      {
        title: 'Best CRM',
        slug: 'best-crm',
        metaDescription: 'Guide',
        focusKeyphrase: 'crm',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ) as { '@graph': Array<Record<string, unknown>> };

    assert.ok(Array.isArray(schema['@graph']));
    const article = schema['@graph'].find((n) => n['@type'] === 'Article');
    assert.equal(article?.url, 'https://acme.com/best-crm');
    assert.equal(article?.headline, 'Best CRM');

    const injected = injectJsonLd('<article>Body</article>', schema);
    assert.match(injected, /application\/ld\+json/);
    assert.match(injected, /Best CRM/);
  });
});
