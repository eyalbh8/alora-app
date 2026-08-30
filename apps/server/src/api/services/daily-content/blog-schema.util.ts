/**
 * Strip / rebuild JSON-LD for blog posts using only BrandHub + post fields.
 * Never invent URLs, authors, or organization data.
 */

export type BrandHubForSchema = {
  title?: string | null;
  domains?: string[] | null;
  logo?: string | null;
  about?: string | null;
};

export type PostForSchema = {
  title?: string | null;
  slug?: string | null;
  body?: string | null;
  metaDescription?: string | null;
  focusKeyphrase?: string | null;
  createdAt?: string | null;
};

const JSON_LD_SCRIPT_RE =
  /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi;

export function stripJsonLd(html: string | null | undefined): string {
  return String(html ?? '').replace(JSON_LD_SCRIPT_RE, '').trim();
}

function primaryDomain(brand: BrandHubForSchema): string | null {
  const domains = brand.domains ?? [];
  const first = domains.find((d) => typeof d === 'string' && d.trim());
  if (!first) return null;
  const cleaned = first.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  return cleaned || null;
}

function siteOrigin(brand: BrandHubForSchema): string | null {
  const domain = primaryDomain(brand);
  return domain ? `https://${domain}` : null;
}

export function buildBlogJsonLd(brand: BrandHubForSchema, post: PostForSchema): object {
  const origin = siteOrigin(brand);
  const orgName = brand.title || 'Organization';
  const slug = post.slug ? String(post.slug).replace(/^\//, '') : null;
  const pageUrl = origin && slug ? `${origin}/${slug}` : origin;
  const logoUrl = brand.logo || undefined;

  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    name: orgName,
  };
  if (origin) organization.url = origin;
  if (logoUrl) {
    organization.logo = {
      '@type': 'ImageObject',
      url: logoUrl,
    };
  }

  const article: Record<string, unknown> = {
    '@type': 'Article',
    headline: post.title || 'Article',
    author: { '@type': 'Organization', name: orgName },
    publisher: organization,
  };
  if (pageUrl) article.url = pageUrl;
  if (post.metaDescription) article.description = post.metaDescription;
  if (post.createdAt) {
    article.datePublished = post.createdAt;
    article.dateModified = post.createdAt;
  }
  if (post.focusKeyphrase) article.keywords = post.focusKeyphrase;

  const graph: unknown[] = [organization, article];
  if (pageUrl) {
    graph.push({
      '@type': 'WebPage',
      '@id': pageUrl,
      url: pageUrl,
      name: post.title || 'Article',
      isPartOf: origin ? { '@id': origin } : undefined,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

export function injectJsonLd(html: string, schema: object): string {
  const cleaned = stripJsonLd(html);
  const script = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  if (/<\/body>/i.test(cleaned)) {
    return cleaned.replace(/<\/body>/i, `${script}</body>`);
  }
  return `${cleaned}\n${script}`;
}
