import { SEED_MISSING_ENTITIES } from '../config'
import type {
  Audience,
  BrandKit,
  Competitor,
  ContentType,
  ProductLine,
  WritingRule,
} from '../api/types'
import {
  SEED_CUSTOM_VARIABLES,
  SEED_FONTS,
  SEED_LOGO_SIZES,
  SEED_LOGO_VARIANTS,
  SEED_PALETTES,
  SEED_REGIONS,
  SEED_TYPE_SIZES,
  SEED_USAGE_RULES,
  SEED_VISUAL_EXAMPLES,
  SEED_WRITING_RULES,
} from '../data/seedMissingEntities'

function asString(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  return String(value)
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v))
}

function normalizeWritingRules(value: unknown): WritingRule[] {
  if (Array.isArray(value)) {
    return value.map((rule, i) => {
      if (typeof rule === 'string') return { id: -(i + 1), text: rule }
      const obj = rule as Record<string, unknown>
      return {
        id: asNumber(obj.id, -(i + 1)),
        text: asString(obj.text ?? obj.name ?? obj.rule),
      }
    })
  }
  if (typeof value === 'string' && value.trim()) {
    return [{ id: -1, text: value }]
  }
  return []
}

function normalizeCompetitor(raw: Record<string, unknown>, index: number): Competitor {
  return {
    id: asNumber(raw.id, -(index + 1)),
    name: asString(raw.name, 'Untitled competitor'),
    domain: asString(raw.domain ?? raw.domain_url),
    details: raw.details == null ? null : asString(raw.details),
  }
}

function normalizeProductLine(
  raw: Record<string, unknown>,
  index: number,
  kitCompetitors: Competitor[],
): ProductLine {
  const nested = Array.isArray(raw.competitors)
    ? (raw.competitors as Record<string, unknown>[]).map(normalizeCompetitor)
    : []

  return {
    id: asNumber(raw.id, -(index + 1)),
    name: asString(raw.name, 'Untitled product line'),
    details: asString(raw.details),
    positioning: asString(raw.positioning),
    ideal_customer_profile: asString(
      raw.ideal_customer_profile ?? raw.ideal_customer,
    ),
    url: asString(raw.url),
    generation_status: raw.generation_status ? asString(raw.generation_status) : undefined,
    // Public REST returns competitors at kit level, not nested — attach to first line.
    competitors: nested.length > 0 ? nested : index === 0 ? kitCompetitors : [],
  }
}

function normalizeAudience(raw: Record<string, unknown>, index: number): Audience {
  return {
    id: asNumber(raw.id, -(index + 1)),
    name: asString(raw.name, 'Untitled audience'),
    description: asString(raw.description),
    writing_rules: normalizeWritingRules(raw.writing_rules),
  }
}

function normalizeContentType(raw: Record<string, unknown>, index: number): ContentType {
  return {
    id: asNumber(raw.id, -(index + 1)),
    name: asString(raw.name, 'Untitled content type'),
    template_outline: raw.template_outline ? asString(raw.template_outline) : undefined,
    cta_text: raw.cta_text ? asString(raw.cta_text) : undefined,
    cta_url: raw.cta_url ? asString(raw.cta_url) : undefined,
    header_case: raw.header_case ? asString(raw.header_case) : undefined,
    content_samples: Array.isArray(raw.content_samples)
      ? (raw.content_samples as Record<string, unknown>[]).map((s, i) => ({
          id: asNumber(s.id, -(i + 1)),
          title: s.title ? asString(s.title) : undefined,
          body: s.body ? asString(s.body) : undefined,
          url: s.url ? asString(s.url) : undefined,
        }))
      : [],
    writing_rules: normalizeWritingRules(raw.writing_rules),
  }
}

function emptyOrSeed<T>(live: T[], seed: T[]): T[] {
  if (live.length > 0) return live
  return SEED_MISSING_ENTITIES ? seed : []
}

/** Normalize a raw API / list payload into the editor BrandKit model. */
export function normalizeBrandKit(raw: Record<string, unknown>): BrandKit {
  const kitCompetitors = Array.isArray(raw.competitors)
    ? (raw.competitors as Record<string, unknown>[]).map(normalizeCompetitor)
    : []

  const productLines = Array.isArray(raw.product_lines)
    ? (raw.product_lines as Record<string, unknown>[]).map((pl, i) =>
        normalizeProductLine(pl, i, kitCompetitors),
      )
    : []

  const writingRules = normalizeWritingRules(raw.writing_rules)

  return {
    id: asNumber(raw.id),
    workspace_name: asString(raw.workspace_name, 'Workspace'),
    brand_name: asString(raw.brand_name, 'Brand'),
    brand_url: asString(raw.brand_url),
    brand_about: asString(raw.brand_about),
    brand_customer: asString(raw.brand_customer),
    brand_competitors: asString(raw.brand_competitors),
    brand_point_of_view: asString(raw.brand_point_of_view),
    writing_persona: asString(raw.writing_persona),
    writing_tone: asString(raw.writing_tone),
    writing_cta: asString(raw.writing_cta),
    writing_cta_url: asString(raw.writing_cta_url),
    primary_color: (raw.primary_color as string | null) ?? null,
    secondary_color: (raw.secondary_color as string | null) ?? null,
    accent_color: (raw.accent_color as string | null) ?? null,
    header_case: (raw.header_case as string | null) ?? null,
    header_case_custom_value: (raw.header_case_custom_value as string | null) ?? null,
    countries: asStringArray(raw.countries),
    aeo_enabled: asBool(raw.aeo_enabled),
    prompts_count: asNumber(raw.prompts_count),
    status: asString(raw.status, 'published'),
    unpublished_changes: asBool(raw.unpublished_changes, false),
    created_at: asString(raw.created_at),
    updated_at: asString(raw.updated_at),
    product_lines: productLines,
    audiences: Array.isArray(raw.audiences)
      ? (raw.audiences as Record<string, unknown>[]).map(normalizeAudience)
      : [],
    content_types: Array.isArray(raw.content_types)
      ? (raw.content_types as Record<string, unknown>[]).map(normalizeContentType)
      : [],
    regions: emptyOrSeed(
      Array.isArray(raw.regions) ? (raw.regions as BrandKit['regions']) : [],
      SEED_REGIONS,
    ),
    writing_rules: emptyOrSeed(writingRules, SEED_WRITING_RULES),
    custom_variables: emptyOrSeed(
      Array.isArray(raw.custom_variables)
        ? (raw.custom_variables as BrandKit['custom_variables'])
        : [],
      SEED_CUSTOM_VARIABLES,
    ),
    logo_variants: emptyOrSeed(
      Array.isArray(raw.logo_variants)
        ? (raw.logo_variants as BrandKit['logo_variants'])
        : [],
      SEED_LOGO_VARIANTS,
    ),
    logo_sizes: emptyOrSeed(
      Array.isArray(raw.logo_sizes) ? (raw.logo_sizes as BrandKit['logo_sizes']) : [],
      SEED_LOGO_SIZES,
    ),
    usage_rules: emptyOrSeed(
      Array.isArray(raw.usage_rules) ? (raw.usage_rules as BrandKit['usage_rules']) : [],
      SEED_USAGE_RULES,
    ),
    palettes: emptyOrSeed(
      Array.isArray(raw.palettes) ? (raw.palettes as BrandKit['palettes']) : [],
      SEED_PALETTES,
    ),
    fonts: emptyOrSeed(
      Array.isArray(raw.fonts) ? (raw.fonts as BrandKit['fonts']) : [],
      SEED_FONTS,
    ),
    type_sizes: emptyOrSeed(
      Array.isArray(raw.type_sizes) ? (raw.type_sizes as BrandKit['type_sizes']) : [],
      SEED_TYPE_SIZES,
    ),
    visual_examples: emptyOrSeed(
      Array.isArray(raw.visual_examples)
        ? (raw.visual_examples as BrandKit['visual_examples'])
        : [],
      SEED_VISUAL_EXAMPLES,
    ),
  }
}

export function deepClone<T>(value: T): T {
  return structuredClone(value)
}

let nextTempId = -1
export function nextTempIdValue(): number {
  const id = nextTempId
  nextTempId -= 1
  return id
}
