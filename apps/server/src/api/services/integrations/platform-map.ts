/** Map Menchly daily-content platforms ↔ Zernio platform ids. */

export const MENCHLY_SOCIAL_PLATFORMS = [
  'LINKEDIN',
  'FACEBOOK',
  'INSTAGRAM',
  'X',
] as const;

export type MenchlySocialPlatform = (typeof MENCHLY_SOCIAL_PLATFORMS)[number];

export const MENCHLY_TO_ZERNIO: Record<MenchlySocialPlatform, string> = {
  LINKEDIN: 'linkedin',
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  X: 'twitter',
};

export const ZERNIO_TO_MENCHLY: Record<string, MenchlySocialPlatform> = {
  linkedin: 'LINKEDIN',
  facebook: 'FACEBOOK',
  instagram: 'INSTAGRAM',
  twitter: 'X',
};

export const CONNECTABLE_ZERNIO_PLATFORMS = [
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
] as const;

/** Blog providers shown on the Integrations screen. */
export const BLOG_PROVIDERS = ['wordpress', 'lovable', 'shopify'] as const;
export type BlogProvider = (typeof BLOG_PROVIDERS)[number];

export function isConnectablePlatform(platform: string): boolean {
  return (CONNECTABLE_ZERNIO_PLATFORMS as readonly string[]).includes(
    platform.toLowerCase(),
  );
}

export function isSocialOrBlogZernioPlatform(platform: string): boolean {
  const p = platform.toLowerCase();
  return isConnectablePlatform(p) || p === 'shopify';
}

export function toZernioPlatform(menchly: string): string | null {
  const key = menchly.toUpperCase() as MenchlySocialPlatform;
  return MENCHLY_TO_ZERNIO[key] ?? null;
}

export function toMenchlyPlatform(zernio: string): MenchlySocialPlatform | null {
  return ZERNIO_TO_MENCHLY[zernio.toLowerCase()] ?? null;
}

export type IgeoBlogKind = 'wordpress' | 'lovable';

/**
 * Classify an iGEO blog site as WordPress or Lovable.
 * Prefer upstream cms/provider/type/platform; else URL heuristics.
 */
export function classifyIgeoBlogSite(site: {
  url?: string | null;
  name?: string | null;
  cms?: string | null;
  provider?: string | null;
  type?: string | null;
  platform?: string | null;
}): IgeoBlogKind {
  const hint = [site.cms, site.provider, site.type, site.platform, site.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/lovable/.test(hint)) return 'lovable';
  if (/wordpress|wp-?engine|wpcom|wordpress\.com/.test(hint)) return 'wordpress';

  const url = (site.url || '').toLowerCase();
  if (
    url.includes('lovable.app') ||
    url.includes('lovableproject.com') ||
    url.includes('lovable.dev')
  ) {
    return 'lovable';
  }
  // Default remaining iGEO blog sites to WordPress (iGEO's primary CMS).
  return 'wordpress';
}
