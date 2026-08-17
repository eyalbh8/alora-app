import { describe, expect, it } from 'vitest'
// Backend generation modules intentionally remain native ESM JavaScript.
// @ts-expect-error No declaration file is needed for this focused contract test.
import { INSTAGRAM_FORMATS, INSTAGRAM_POST_FORMAT, boundsToPercent, clampBoundsToFormat, resolveInstagramFormat } from '../../functions/snapshots-api/carouselFormat.mjs'
// @ts-expect-error No declaration file is needed for this focused contract test.
import { buildTextAwareBlueprint } from '../../functions/snapshots-api/claudeOrchestrator.mjs'
// @ts-expect-error No declaration file is needed for this focused contract test.
import { resolveGeneratedTextBlock } from '../../functions/snapshots-api/imageGenerator.mjs'
// @ts-expect-error No declaration file is needed for this focused contract test.
import { DEFAULT_CAROUSEL_PROFILE, loadCarouselProfile, validateCarouselProfile } from '../../functions/snapshots-api/carouselProfile.mjs'
// @ts-expect-error pngjs does not publish bundled TypeScript declarations.
import { PNG } from 'pngjs'

describe('Instagram carousel format', () => {
  it('enforces the 1080x1350 portrait format', () => {
    expect(INSTAGRAM_POST_FORMAT).toMatchObject({
      width: 1080,
      height: 1350,
      aspectRatio: '4:5',
    })
  })

  it('clamps protected geometry to design margins', () => {
    const bounds = clampBoundsToFormat({ x: -20, y: 0, width: 2000, height: 2000 })
    expect(bounds).toEqual({ x: 72, y: 96, width: 936, height: 1158 })
    expect(boundsToPercent(bounds)).toEqual({
      x: 6.7,
      y: 7.1,
      width: 86.7,
      height: 85.8,
    })
  })

  it('supports the Berkos square output contract', () => {
    const format = resolveInstagramFormat('instagram-square-1x1')
    expect(format).toMatchObject({
      width: 1080,
      height: 1080,
      aspectRatio: '1:1',
      imageApiSize: '1024x1024',
    })
    expect(
      clampBoundsToFormat({ x: 0, y: 0, width: 2000, height: 2000 }, 0, format),
    ).toEqual({ x: 54, y: 54, width: 972, height: 972 })
  })
})

describe('pre-image typography blueprint', () => {
  it('keeps native text layers ordered in one protected block', () => {
    const result = buildTextAwareBlueprint(
      {
        brand: {
          typography: {
            headlineFont: 'Montserrat',
            bodyFont: 'Inter',
            labelFont: 'Inter',
          },
        },
        slides: [{
          slideIndex: 1,
          microLabel: 'Guide',
          headline: 'Request the complete property documentation',
          body: 'Ask for plans, specifications, materials, and permit status.',
        }],
      },
      {
        perSlideVisuals: [{
          slideIndex: 1,
          negativeSpaceZones: 'left',
          textZoneTone: 'dark',
          textZoneBounds: { x: 72, y: 140, width: 600, height: 760 },
        }],
      },
    )
    const slide = result.slides[0]
    expect(result.format.height).toBe(1350)
    expect(slide.textBlock.protectedBounds).toEqual({
      x: 72,
      y: 140,
      width: 600,
      height: 760,
    })
    expect(slide.textLayers.map((layer: { type: string }) => layer.type)).toEqual([
      'label',
      'headline',
      'body',
    ])
    for (let index = 1; index < slide.textLayers.length; index += 1) {
      const previous = slide.textLayers[index - 1].position
      const current = slide.textLayers[index].position
      expect(current.y).toBeGreaterThanOrEqual(previous.y + previous.height)
    }
  })

  it('fits long final-slide copy without moving boxes outside the protected block', () => {
    const result = buildTextAwareBlueprint(
      {
        brand: { typography: {} },
        slides: [{
          slideIndex: 4,
          microLabel: 'Next step',
          headline: 'A considered investment begins with the complete picture',
          body: 'Request the plans, material specifications, permit status, projected timeline, neighborhood analysis, ownership details, and every supporting document before making your decision. '.repeat(3),
        }],
      },
      {
        perSlideVisuals: [{
          slideIndex: 4,
          textZoneTone: 'light',
          textZoneBounds: { x: 250, y: 700, width: 520, height: 420 },
        }],
      },
    )
    const slide = result.slides[0]
    const block = slide.textBlock.protectedBounds
    for (const layer of slide.textLayers) {
      expect(layer.position.x).toBeGreaterThanOrEqual(block.x)
      expect(layer.position.y).toBeGreaterThanOrEqual(block.y)
      expect(layer.position.x + layer.position.width).toBeLessThanOrEqual(block.x + block.width)
      expect(layer.position.y + layer.position.height).toBeLessThanOrEqual(block.y + block.height)
    }
    expect(block.y + block.height).toBeLessThanOrEqual(1254)
  })

  it('applies square Berkos layout, logo, scrim, and italic headline spans', () => {
    const profile = validateCarouselProfile({
      id: 'berkos-editorial-real-estate',
      format: INSTAGRAM_FORMATS.square,
      palette: { primary: '#061D3A', accent: '#FFFFFF', body: '#E2E5E9' },
      typography: {
        headlineFont: 'Playfair Display',
        headlineWeight: '700',
        headlineItalicStyle: 'Bold Italic',
        bodyFont: 'Inter',
      },
      logo: { enabled: true, anchor: 'top-right' },
      imagePolicy: {
        mode: 'all-slides-photography',
        protectedTextPanel: false,
      },
      readability: {
        mode: 'profile-scrim',
        scrim: { color: '#061D3A', opacity: 0.78, direction: 'left-to-right' },
      },
      layouts: [{
        id: 'editorial-left',
        textZoneBounds: { x: 54, y: 66, width: 570, height: 840 },
        alignment: 'left',
      }],
    })
    const result = buildTextAwareBlueprint(
      {
        brand: { logo: '/api/carousel/assets/id/logo.png' },
        slides: [{
          index: 1,
          headline: 'Cyprus Apartment Prices Continue to Rise',
          headlineEmphasis: ['to Rise'],
          body: 'Apartment prices increased year-on-year.',
          logoAsset: '/api/carousel/assets/id/logo.png',
        }],
      },
      { perSlideVisuals: [{ slideIndex: 1, textZoneTone: 'dark' }] },
      { slideTemplateMap: [{ slideIndex: 1, layoutVariant: 'editorial-left' }] },
      profile,
    )
    const slide = result.slides[0]
    const headline = slide.textLayers.find((layer: { type: string }) => layer.type === 'headline')
    expect(result.format.height).toBe(1080)
    expect(result.profileId).toBe('berkos-editorial-real-estate')
    expect(slide.logoLayer.anchor).toBe('top-right')
    expect(slide.overlay).toMatchObject({ type: 'scrim', color: '#061D3A' })
    expect(headline.typography.segments).toContainEqual({ text: 'to Rise', italic: true })
    expect(profile.imagePolicy.mode).toBe('all-slides-photography')
  })
})

describe('account carousel profiles', () => {
  it('preserves the existing portrait profile as the fallback', () => {
    expect(validateCarouselProfile({})).toMatchObject({
      id: DEFAULT_CAROUSEL_PROFILE.id,
      format: { id: 'instagram-portrait-4x5' },
      viewerChrome: false,
    })
  })

  it('snapshots the effective database profile for deterministic resumes', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = []
    const db = {
      query: async (sql: string, params: unknown[]) => {
        calls.push({ sql, params })
        if (sql.includes('SELECT profile_config')) return { rows: [{ profile_config: null }] }
        if (sql.includes('FROM carousel_account_profiles')) {
          return {
            rows: [{
              profile_key: 'berkos-editorial-real-estate',
              version: 2,
              config: {
                format: 'instagram-square-1x1',
                imagePolicy: { mode: 'all-slides-photography' },
              },
            }],
          }
        }
        return { rows: [] }
      },
    }
    const profile = await loadCarouselProfile(db, 'tenant', 'account', 'generation')
    expect(profile).toMatchObject({
      id: 'berkos-editorial-real-estate',
      version: 2,
      format: { id: 'instagram-square-1x1' },
    })
    const snapshot = calls.find((call) => call.sql.includes('UPDATE carousel_generations'))
    expect(snapshot).toBeTruthy()
    expect(JSON.parse(String(snapshot?.params[1]))).toMatchObject({
      id: 'berkos-editorial-real-estate',
      version: 2,
    })
  })
})

describe('generated text panel resolution', () => {
  it('moves the complete block to a uniform white lower panel and selects dark text', () => {
    const png = new PNG({ width: 1080, height: 1350 })
    for (let y = 0; y < png.height; y += 1) {
      for (let x = 0; x < png.width; x += 1) {
        const index = (y * png.width + x) * 4
        const whitePanel = x >= 190 && x <= 890 && y >= 680 && y <= 1210
        const value = whitePanel ? 250 : ((x + y) % 18 < 9 ? 28 : 178)
        png.data[index] = value
        png.data[index + 1] = value
        png.data[index + 2] = value
        png.data[index + 3] = 255
      }
    }
    const resolved = resolveGeneratedTextBlock(
      png,
      { x: 72, y: 120, width: 600, height: 450 },
      ['#F4C542'],
    )
    expect(resolved.source).toBe('detected-generated-panel')
    expect(resolved.bounds.y).toBeGreaterThan(600)
    expect(resolved.recommendedTextColor).toBe('#111111')
    expect(resolved.suitable).toBe(true)
  })
})
