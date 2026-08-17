import { INSTAGRAM_FORMATS, resolveInstagramFormat } from './carouselFormat.mjs';

export const DEFAULT_CAROUSEL_PROFILE = Object.freeze({
  id: 'default',
  version: 1,
  name: 'Default editorial carousel',
  format: INSTAGRAM_FORMATS.portrait,
  content: {
    minSlides: 3,
    maxSlides: 5,
    narrativeRoles: [],
  },
  palette: {
    primary: null,
    secondary: null,
    accent: null,
    body: null,
  },
  typography: {
    headlineFont: null,
    headlineWeight: '700',
    headlineItalicStyle: 'Italic',
    bodyFont: null,
    bodyWeight: '500',
    labelFont: null,
    labelWeight: '600',
  },
  logo: {
    enabled: false,
    source: 'brandHub',
    anchor: 'top-right',
    width: 240,
    maxHeight: 92,
    marginX: 64,
    marginY: 54,
  },
  imagePolicy: {
    mode: 'mixed-editorial',
    allowedStyles: [],
    bannedElements: [],
    allowPurposefulGraphics: true,
    protectedTextPanel: true,
  },
  readability: {
    mode: 'detected-panel',
    scrim: null,
  },
  layouts: [],
  viewerChrome: false,
});

function mergeObjects(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base;
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base?.[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = mergeObjects(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function validateCarouselProfile(rawProfile = {}) {
  const merged = mergeObjects(DEFAULT_CAROUSEL_PROFILE, rawProfile);
  const format = resolveInstagramFormat(merged.format);
  const minSlides = Math.max(3, Math.min(10, Number(merged.content?.minSlides) || 3));
  const maxSlides = Math.max(minSlides, Math.min(10, Number(merged.content?.maxSlides) || 5));

  if (!['mixed-editorial', 'all-slides-photography'].includes(merged.imagePolicy?.mode)) {
    throw new Error(`Unsupported carousel image policy: ${merged.imagePolicy?.mode}`);
  }
  if (!['detected-panel', 'profile-scrim'].includes(merged.readability?.mode)) {
    throw new Error(`Unsupported carousel readability mode: ${merged.readability?.mode}`);
  }

  return {
    ...merged,
    version: Math.max(1, Number(merged.version) || 1),
    format,
    content: {
      ...merged.content,
      minSlides,
      maxSlides,
    },
    layouts: Array.isArray(merged.layouts) ? merged.layouts : [],
    viewerChrome: false,
  };
}

export async function loadCarouselProfile(db, tenantId, accountId, generationId) {
  if (generationId) {
    const saved = await db.query(
      `SELECT profile_config FROM carousel_generations WHERE id = $1 AND tenant_id = $2`,
      [generationId, tenantId],
    );
    if (saved.rows[0]?.profile_config) {
      return validateCarouselProfile(saved.rows[0].profile_config);
    }
  }

  const result = await db.query(
    `SELECT profile_key, version, config
       FROM carousel_account_profiles
      WHERE tenant_id = $1
        AND account_id = $2
        AND enabled = true
      LIMIT 1`,
    [tenantId, accountId],
  );
  const row = result.rows[0];
  const profile = validateCarouselProfile(
    row
      ? { ...row.config, id: row.profile_key, version: row.version }
      : DEFAULT_CAROUSEL_PROFILE,
  );

  if (generationId) {
    await db.query(
      `UPDATE carousel_generations SET profile_config = $2::jsonb WHERE id = $1`,
      [generationId, JSON.stringify(profile)],
    );
  }
  return profile;
}

