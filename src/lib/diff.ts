import type { BrandKit, BrandKitDiff, DiffChange } from '../api/types'

function preview(value: unknown, max = 160): string {
  if (value == null) return '—'
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed || '—'
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    const json = JSON.stringify(value)
    return json.length > max ? `${json.slice(0, max)}…` : json
  } catch {
    return String(value)
  }
}

function pushField(
  changes: DiffChange[],
  entity: string,
  label: string,
  path: string,
  before: unknown,
  after: unknown,
) {
  if (before === after) return
  if (preview(before) === preview(after) && typeof before === typeof after) {
    if (JSON.stringify(before) === JSON.stringify(after)) return
  }
  changes.push({
    path,
    entity,
    label,
    kind: 'updated',
    before: preview(before),
    after: preview(after),
  })
}

function diffByIdList<T extends { id: number; name?: string }>(
  changes: DiffChange[],
  entity: string,
  original: T[],
  current: T[],
  pathPrefix: string,
  fieldKeys: Array<keyof T & string>,
  nameOf: (item: T) => string = (item) => item.name ?? `#${item.id}`,
) {
  const origMap = new Map(original.map((item) => [item.id, item]))
  const currMap = new Map(current.map((item) => [item.id, item]))

  for (const [id, item] of currMap) {
    if (!origMap.has(id)) {
      changes.push({
        path: `${pathPrefix}.${id}`,
        entity,
        label: `+ New: '${nameOf(item)}'`,
        kind: 'added',
        after: preview(item),
      })
    }
  }

  for (const [id, item] of origMap) {
    if (!currMap.has(id)) {
      changes.push({
        path: `${pathPrefix}.${id}`,
        entity,
        label: `− Removed: '${nameOf(item)}'`,
        kind: 'removed',
        before: preview(item),
      })
    }
  }

  for (const [id, curr] of currMap) {
    const orig = origMap.get(id)
    if (!orig) continue
    for (const key of fieldKeys) {
      const before = orig[key]
      const after = curr[key]
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        pushField(
          changes,
          entity,
          `'${nameOf(curr)}' — ${key} updated`,
          `${pathPrefix}.${id}.${key}`,
          before,
          after,
        )
      }
    }
  }
}

/** Field-by-field + nested add/remove diff between original fetch and local edits. */
export function computeBrandKitDiff(original: BrandKit, current: BrandKit): BrandKitDiff {
  const changes: DiffChange[] = []

  const foundationKeys: Array<keyof BrandKit> = [
    'brand_name',
    'brand_url',
    'brand_about',
    'brand_customer',
    'brand_competitors',
    'brand_point_of_view',
    'writing_persona',
    'writing_tone',
    'writing_cta',
    'writing_cta_url',
    'primary_color',
    'secondary_color',
    'accent_color',
    'header_case',
    'header_case_custom_value',
  ]

  for (const key of foundationKeys) {
    pushField(
      changes,
      'Foundations',
      `${String(key)} — updated`,
      key,
      original[key],
      current[key],
    )
  }

  if (JSON.stringify(original.countries) !== JSON.stringify(current.countries)) {
    pushField(changes, 'Foundations', 'countries — updated', 'countries', original.countries, current.countries)
  }

  diffByIdList(changes, 'Writing Rules', original.writing_rules, current.writing_rules, 'writing_rules', [
    'text',
  ], (r) => r.text.split('\n')[0]?.replace(/\*\*/g, '').slice(0, 40) || `Rule #${r.id}`)

  for (const pl of current.product_lines) {
    const orig = original.product_lines.find((p) => p.id === pl.id)
    if (!orig) continue
    diffByIdList(
      changes,
      'Competitors',
      orig.competitors,
      pl.competitors,
      `product_lines.${pl.id}.competitors`,
      ['name', 'domain', 'details'],
    )
  }

  diffByIdList(
    changes,
    'Product Lines',
    original.product_lines,
    current.product_lines,
    'product_lines',
    ['name', 'details', 'positioning', 'ideal_customer_profile', 'url'],
  )

  diffByIdList(
    changes,
    'Content Types',
    original.content_types,
    current.content_types,
    'content_types',
    ['name', 'template_outline', 'cta_text', 'cta_url', 'header_case'],
  )

  for (const ct of current.content_types) {
    const orig = original.content_types.find((c) => c.id === ct.id)
    if (!orig) continue
    diffByIdList(
      changes,
      'Content Type Rules',
      orig.writing_rules ?? [],
      ct.writing_rules ?? [],
      `content_types.${ct.id}.writing_rules`,
      ['text'],
      (r) => r.text.split('\n')[0]?.slice(0, 40) || `Rule #${r.id}`,
    )
  }

  diffByIdList(
    changes,
    'Audiences',
    original.audiences,
    current.audiences,
    'audiences',
    ['name', 'description'],
  )

  for (const aud of current.audiences) {
    const orig = original.audiences.find((a) => a.id === aud.id)
    if (!orig) continue
    diffByIdList(
      changes,
      'Audience Rules',
      orig.writing_rules,
      aud.writing_rules,
      `audiences.${aud.id}.writing_rules`,
      ['text'],
      (r) => r.text.split('\n')[0]?.slice(0, 40) || `Rule #${r.id}`,
    )
  }

  diffByIdList(
    changes,
    'Regions',
    original.regions,
    current.regions,
    'regions',
    ['name', 'description', 'icon_name'],
  )

  diffByIdList(
    changes,
    'Custom Variables',
    original.custom_variables,
    current.custom_variables,
    'custom_variables',
    ['name', 'value'],
  )

  for (const logo of current.logo_variants) {
    const orig = original.logo_variants.find((l) => l.id === logo.id)
    if (!orig) continue
    pushField(
      changes,
      'Visual Guidelines',
      `Logo '${logo.name}' — usage_instructions updated`,
      `logo_variants.${logo.id}.usage_instructions`,
      orig.usage_instructions,
      logo.usage_instructions,
    )
  }

  for (const palette of current.palettes) {
    const origPalette = original.palettes.find((p) => p.id === palette.id)
    if (!origPalette) continue
    for (const color of palette.colors) {
      const origColor = origPalette.colors.find((c) => c.id === color.id)
      if (!origColor) continue
      pushField(
        changes,
        'Visual Guidelines',
        `Color '${color.name}' — usage_instructions updated`,
        `palettes.${palette.id}.colors.${color.id}.usage_instructions`,
        origColor.usage_instructions,
        color.usage_instructions,
      )
      pushField(
        changes,
        'Visual Guidelines',
        `Color '${color.name}' — value updated`,
        `palettes.${palette.id}.colors.${color.id}.value`,
        origColor.value,
        color.value,
      )
    }
  }

  for (const font of current.fonts) {
    const orig = original.fonts.find((f) => f.id === font.id)
    if (!orig) continue
    pushField(
      changes,
      'Visual Guidelines',
      `Font '${font.name}' — usage_instructions updated`,
      `fonts.${font.id}.usage_instructions`,
      orig.usage_instructions,
      font.usage_instructions,
    )
  }

  diffByIdList(
    changes,
    'Typography Sizes',
    original.type_sizes,
    current.type_sizes,
    'type_sizes',
    ['name', 'weight', 'size', 'line_height', 'usage_instructions', 'font_id'],
  )

  diffByIdList(
    changes,
    'Usage Rules',
    original.usage_rules,
    current.usage_rules,
    'usage_rules',
    ['name', 'applies_to'],
    (r) => r.name.slice(0, 40),
  )

  return {
    brand_kit_id: current.id,
    brand_name: current.brand_name,
    submitted_at: new Date().toISOString(),
    changes,
    current,
    original,
  }
}

export function hasLocalEdits(original: BrandKit | null, current: BrandKit | null): boolean {
  if (!original || !current) return false
  return computeBrandKitDiff(original, current).changes.length > 0
}
