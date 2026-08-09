/**
 * Seed / fallback entities for fields the public REST Brand Kit API does not
 * return today. Public includes are limited to:
 *   product_lines | competitors | audiences | content_types
 *
 * Regions, structured writing_rules[], custom_variables, and visual guidelines
 * (logos, palettes, fonts, usage_rules) are available via AirOps MCP / UI.
 * When VITE_SEED_MISSING_ENTITIES=true (default), these fill empty collections
 * so the editor UI matches the live AirOps Brand Kit for RiddleDay.
 */
import type {
  CustomVariable,
  Font,
  LogoSize,
  LogoVariant,
  Palette,
  Region,
  TypeSize,
  UsageRule,
  VisualExample,
  WritingRule,
} from '../api/types'

export const SEED_WRITING_RULES: WritingRule[] = [
  {
    id: 91315,
    text: `**No AI sentence constructions**

- No negative parallelism ("it's not X, it's Y")
- Break the rule of three
- No em dashes`,
  },
  {
    id: 91316,
    text: `**No AI word choice**

- Always cut on sight: delve, tapestry, realm, leverage, robust, seamless, elevate, unlock, empower`,
  },
]

export const SEED_REGIONS: Region[] = [
  {
    id: 14392,
    name: 'United Kingdom',
    description:
      'Primary market. Full product offering for families with children aged 6–12.',
    icon_name: 'flag-gb',
    writing_rules: [],
  },
  {
    id: 14393,
    name: 'Russia',
    description:
      'Secondary market with localized language support serving Russian-speaking family users.',
    icon_name: 'flag-ru',
    writing_rules: [],
  },
]

export const SEED_CUSTOM_VARIABLES: CustomVariable[] = []

export const SEED_LOGO_VARIANTS: LogoVariant[] = [
  {
    id: 8478,
    name: 'Primary Logo',
    background_color: '#FFFFFF',
    usage_instructions:
      'Prefer placing the logo on solid light backgrounds. Maintain clear space equal to the height of the mark.',
    file_url: '',
  },
]

export const SEED_LOGO_SIZES: LogoSize[] = [
  {
    id: 1,
    name: 'Minimum digital',
    width: 120,
    height: 40,
    usage_instructions: 'Do not scale the logo smaller than 120px wide on screen.',
  },
]

export const SEED_USAGE_RULES: UsageRule[] = [
  {
    id: 66236,
    applies_to: 'logo',
    name: 'Do not place the logo on coral (#FF6742) or busy illustration areas.',
  },
  {
    id: 66239,
    applies_to: 'color',
    name: 'Use #FF6742 only for the primary action and the most important interactive emphasis.',
  },
  {
    id: 66242,
    applies_to: 'typography',
    name: 'Use Fredoka for headings only; avoid using it for long paragraphs.',
  },
]

export const SEED_PALETTES: Palette[] = [
  {
    id: 9136,
    name: 'Primary (Light UI)',
    colors: [
      {
        id: 34714,
        name: 'Riddle Purple',
        value: '#372A5E',
        usage_instructions:
          'Use as the primary brand color for nav, key UI surfaces, icons, and emphasis text.',
      },
      {
        id: 34718,
        name: 'Coral Orange (CTA Accent)',
        value: '#FF6742',
        usage_instructions:
          'Use for primary call-to-action buttons, key highlights, and important interactive states.',
      },
    ],
  },
]

export const SEED_FONTS: Font[] = [
  {
    id: 10251,
    name: 'Rubik',
    usage_instructions: 'Primary UI/body font.',
    google_font_link: 'https://fonts.google.com/specimen/Rubik',
  },
  {
    id: 10252,
    name: 'Fredoka',
    usage_instructions: 'Display/heading font.',
    google_font_link: 'https://fonts.google.com/specimen/Fredoka',
  },
]

export const SEED_TYPE_SIZES: TypeSize[] = [
  {
    id: 34523,
    font_id: 10252,
    name: 'H1 Hero',
    weight: 700,
    size: 48,
    line_height: 1.1,
    usage_instructions: 'Use for the primary homepage hero headline.',
  },
  {
    id: 34527,
    font_id: 10251,
    name: 'Body',
    weight: 400,
    size: 16,
    line_height: 1.5,
    usage_instructions: 'Default for paragraphs, descriptions, and general UI copy.',
  },
]

export const SEED_VISUAL_EXAMPLES: VisualExample[] = []
