/**
 * Claude API Orchestrator
 * Manages Steps 1-5, 7, and 8 of the Instagram carousel generation using Anthropic Claude API
 * Step 6 (image generation) is handled by imageGenerator.mjs
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logClaudeCall } from './carouselLogger.mjs';
import {
  INSTAGRAM_POST_FORMAT,
  clampBoundsToFormat,
  resolveInstagramFormat,
} from './carouselFormat.mjs';

const INSTAGRAM_DIMENSIONS = {
  CANVAS_WIDTH: INSTAGRAM_POST_FORMAT.width,
  CANVAS_HEIGHT: INSTAGRAM_POST_FORMAT.height,
  TEXT_SAFE_X: INSTAGRAM_POST_FORMAT.margins.left,
  TEXT_SAFE_Y: INSTAGRAM_POST_FORMAT.margins.top,
  TEXT_MAX_X: INSTAGRAM_POST_FORMAT.width - INSTAGRAM_POST_FORMAT.margins.right,
  TEXT_MAX_Y: INSTAGRAM_POST_FORMAT.height - INSTAGRAM_POST_FORMAT.margins.bottom,
};

function dimensionsFor(formatInput) {
  const format = resolveInstagramFormat(formatInput);
  return {
    format,
    CANVAS_WIDTH: format.width,
    CANVAS_HEIGHT: format.height,
    TEXT_SAFE_X: format.margins.left,
    TEXT_SAFE_Y: format.margins.top,
    TEXT_MAX_X: format.width - format.margins.right,
    TEXT_MAX_Y: format.height - format.margins.bottom,
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// claude-sonnet-4-20250514 was retired 2026-06-15. Override with CLAUDE_MODEL if needed.
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';
const SKIP_TEMPERATURE = /claude-(sonnet|opus|fable)-5/.test(CLAUDE_MODEL);

/**
 * Load the automation prompt template
 */
async function loadAutomationPrompt() {
  const promptPath = join(__dirname, '../../db/instagram_carousel_automation_prompt.md');
  return await readFile(promptPath, 'utf-8');
}

/**
 * Load visual styles library
 */
async function loadVisualStylesLibrary() {
  const stylesPath = join(__dirname, '../data/visual-styles-library.json');
  const content = await readFile(stylesPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load style selection rules
 */
async function loadStyleSelectionRules() {
  const rulesPath = join(__dirname, '../data/style-selection-rules.json');
  const content = await readFile(rulesPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load composition principles
 */
async function loadCompositionPrinciples() {
  const principlesPath = join(__dirname, '../data/composition-principles.json');
  const content = await readFile(principlesPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Helper to call Claude API with structured system/user messages
 */
async function callClaude(systemPrompt, userPrompt, options = {}) {
  const callStart = Date.now();
  try {
    const model = options.model || CLAUDE_MODEL;
    const isClaude5 = /claude-(sonnet|opus|fable)-5/.test(model);
    const payload = {
      model,
      max_tokens: options.maxTokens || 16384,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    };

    if (isClaude5) {
      // Adaptive thinking is on by default and counts against max_tokens,
      // which was truncating Step 7 JSON mid-string.
      payload.thinking = { type: 'disabled' };
      payload.output_config = { effort: options.effort || 'low' };
    } else if (!SKIP_TEMPERATURE) {
      payload.temperature = options.temperature || 0.3;
    }

    let response;
    let retryAttempt = 0;
    const createWithRetry = async () => {
      const retryDelaysMs = [2000, 5000, 10000];
      const maxTransientRetries = Math.min(
        retryDelaysMs.length,
        options.maxTransientRetries ?? retryDelaysMs.length,
      );
      let transientAttempt = 0;

      while (true) {
        try {
          return await anthropic.messages.create(payload);
        } catch (error) {
          const status = Number(error?.status);
          const retryable =
            status === 429 ||
            status === 529 ||
            (status >= 500 && status <= 504) ||
            (!status && /timeout|ECONNRESET|fetch failed|socket/i.test(error?.message || ''));

          if (!retryable || transientAttempt >= maxTransientRetries) {
            throw error;
          }

          const retryAfterSeconds = Number(error?.headers?.get?.('retry-after'));
          const delayMs = Math.max(
            Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 0,
            retryDelaysMs[transientAttempt],
          );
          transientAttempt += 1;
          retryAttempt += 1;
          console.warn(
            `[Claude] Temporary API error ${status || 'network'}; retry ${transientAttempt}/${maxTransientRetries} in ${delayMs}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    };

    try {
      response = await createWithRetry();
    } catch (error) {
      if (isClaude5 && error.status === 400 && payload.thinking) {
        console.warn('[Claude] thinking.disabled rejected; retrying with effort only');
        delete payload.thinking;
        retryAttempt += 1;
        response = await createWithRetry();
      } else {
        throw error;
      }
    }

    if (response.stop_reason === 'max_tokens') {
      console.warn('[Claude] Output truncated (max_tokens); retrying with a larger budget');
      payload.max_tokens = Math.max(payload.max_tokens, 32768);
      retryAttempt = retryAttempt + 1;
      response = await createWithRetry();
    }

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in Claude response');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Claude JSON was truncated (hit max_tokens).');
    }

    const callDuration = Date.now() - callStart;
    
    // Log Claude API call with token usage
    if (options.generationId && options.tenantId && options.accountId && options.step !== undefined) {
      logClaudeCall({
        generationId: options.generationId,
        tenantId: options.tenantId,
        accountId: options.accountId,
        step: options.step,
        model,
        promptTokens: response.usage?.input_tokens,
        completionTokens: response.usage?.output_tokens,
        durationMs: callDuration,
        retryAttempt,
      });
    }

    return textContent.text;
  } catch (error) {
    console.error('[Claude] API error:', error);
    throw new Error(`Claude API call failed: ${error.message}`);
  }
}

/**
 * Parse JSON from Claude response (handles markdown code fences)
 */
function parseClaudeJSON(response) {
  try {
    let cleaned = response.trim();
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      cleaned = fence[1].trim();
    }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('[Claude] JSON parse error. Response:', response.substring(0, 500));
    throw new Error(`Failed to parse Claude JSON response: ${error.message}`);
  }
}

/**
 * Step 1: Choose carousel content plan
 */
export async function runStep1_CarouselPlan(input) {
  const {
    prompt,
    postBody,
    carouselContentOptions,
    brandHub,
    carouselProfile,
    generationId,
    tenantId,
    accountId,
  } = input;
  const minSlides = carouselProfile?.content?.minSlides || 3;
  const maxSlides = carouselProfile?.content?.maxSlides || 5;

  const systemPrompt = `You are a senior Instagram growth strategist for iGEO Content Studio.
Create the viral carousel plan that best answers the target prompt, informed by the brand's audience, personality, tone, industry context, and editorial guidelines.

Consider the brand's target audience, voice characteristics, and content guidelines when selecting the template and crafting slide structure.

CRITICAL: Return valid JSON only (no markdown fences, no commentary outside the JSON).`;

  const userPrompt = `Target prompt: ${prompt}

Post body (for context):
${postBody}

BrandHub context:
- Brand: ${brandHub.title || 'Unknown'}
- Industry: ${brandHub.industryCategory || 'General'} / ${brandHub.subIndustryCategory || 'N/A'}
- Target audience: ${(brandHub.targetAudience || []).join(', ') || 'General audience'}
- Tone of voice: ${(brandHub.toneOfVoice || []).join(', ') || 'Professional'}
- Personality: ${(brandHub.personality || []).join(', ') || 'Authentic'}
- Post guidelines: ${JSON.stringify(brandHub.postGuidelines || { dos: [], donts: [] })}

Carousel content options:
${JSON.stringify(carouselContentOptions, null, 2)}

Account-specific carousel definition:
${JSON.stringify(carouselProfile, null, 2)}

Pick the single best-fit option and outline every slide: role (hook / insight / proof / tip / CTA), headline (≤8 words), body (≤28 words), visual intent.
Carousels MUST be ${minSlides}–${maxSlides} slides. Never exceed ${maxSlides}. Prefer the account definition's narrativeRoles and adapt the closest content option to that count.
Add visualComplexity (simple/medium/complex) and designTheme (minimalist/bold/editorial/playful/abstract).

IMPORTANT: Consider the brand's industry, audience, and tone when choosing the template and designing slide messaging.

Output shape:
{"selectedCarouselContentId":"","selectedCarouselContentName":"","rationale":"","slideCount":0,"visualComplexity":"simple|medium|complex","designTheme":"minimalist|bold|editorial|playful|abstract","slides":[{"index":1,"role":"hook|insight|proof|tip|cta","headline":"","body":"","visualIntent":""}],"captionHook":"","captionCta":"","hashtags":[]}`;

  const response = await callClaude(systemPrompt, userPrompt, { 
    maxTokens: 4096,
    generationId,
    tenantId,
    accountId,
    step: 1,
  });
  return parseClaudeJSON(response);
}

/**
 * Select appropriate visual styles based on content, brand, and context
 */
function selectVisualStyles(step1Output, brandHub, visualStylesLibrary, styleSelectionRules) {
  const { contentTypeMapping, brandPersonalityMapping, industryCategoryDefaults, slideRoleMapping, visualComplexityMapping } = styleSelectionRules;
  
  // Determine content type from carousel structure and slide roles
  const slideRoles = step1Output.slides?.map(s => s.role) || [];
  let contentType = 'concept'; // default
  if (slideRoles.includes('proof') || step1Output.selectedCarouselContentName?.includes('Proof')) {
    contentType = 'proof';
  } else if (step1Output.designTheme === 'editorial') {
    contentType = 'lifestyle';
  } else if (brandHub.industryCategory === 'Real Estate') {
    contentType = 'real-estate';
  } else if (brandHub.industryCategory === 'Health & Wellness') {
    contentType = 'wellness';
  } else if (brandHub.industryCategory === 'Technology') {
    contentType = 'tech';
  }
  
  // Score styles across every relevant signal. The previous Set-based approach
  // discarded repeated recommendations, so the first industry style always won.
  const scores = new Map();
  const avoidedStyles = new Set();
  const addRanked = (styleIds = [], baseScore = 1) => {
    styleIds.forEach((styleId, index) => {
      scores.set(styleId, (scores.get(styleId) || 0) + Math.max(baseScore - index, 1));
    });
  };
  
  // From industry defaults
  const industryDefaults = industryCategoryDefaults[brandHub.industryCategory];
  if (industryDefaults?.defaultStyles) {
    addRanked(industryDefaults.defaultStyles, 6);
  }
  if (industryDefaults?.avoidStyles) {
    industryDefaults.avoidStyles.forEach(s => avoidedStyles.add(s));
  }
  
  // From brand personality
  const personalities = brandHub.personality || [];
  personalities.forEach(p => {
    const mapping = brandPersonalityMapping[p.toLowerCase()];
    if (mapping?.preferredStyles) {
      addRanked(mapping.preferredStyles, 5);
    }
    if (mapping?.boostStyles) {
      addRanked(mapping.boostStyles, 4);
    }
    if (mapping?.avoidStyles) {
      mapping.avoidStyles.forEach(s => avoidedStyles.add(s));
    }
  });
  
  // From content type
  const contentMapping = contentTypeMapping[contentType];
  if (contentMapping?.preferredStyles) {
    addRanked(contentMapping.preferredStyles, 5);
  }
  if (contentMapping?.avoidStyles) {
    contentMapping.avoidStyles.forEach(s => avoidedStyles.add(s));
  }

  // Slide roles contribute too: a carousel needs both an attention-grabbing
  // lead style and designed supporting-slide styles.
  slideRoles.forEach((role) => {
    const roleMapping = slideRoleMapping[role];
    if (roleMapping?.preferredStyles) {
      addRanked(roleMapping.preferredStyles, role === 'hook' ? 3 : 2);
    }
  });
  
  // Get max styles based on visual complexity
  const complexity = step1Output.visualComplexity || 'medium';
  const configuredMax = visualComplexityMapping[complexity]?.maxStylesPerCarousel || 2;
  const slideCount = step1Output.slideCount || step1Output.slides?.length || 3;
  const targetStyleCount = Math.min(3, Math.max(slideCount >= 3 ? 2 : 1, configuredMax));

  const sortedStyleIds = [...scores.entries()]
    .filter(([styleId]) => !avoidedStyles.has(styleId))
    .sort((a, b) => b[1] - a[1])
    .map(([styleId]) => styleId);

  // Always include a genuinely designed/abstract supporting style. This
  // prevents a carousel from becoming one stock-like photo followed by blanks.
  const abstractSupportIds = [
    'abstract-flows',
    'geometric-minimal',
    'gradient-atmosphere',
    'topographic',
    'textured-minimal',
  ];
  if (!sortedStyleIds.some((styleId) => abstractSupportIds.includes(styleId))) {
    const supportId = abstractSupportIds.find((styleId) => !avoidedStyles.has(styleId));
    if (supportId) sortedStyleIds.push(supportId);
  }

  const selectedStyles = sortedStyleIds
    .slice(0, targetStyleCount)
    .map((styleId) => visualStylesLibrary.find((style) => style.id === styleId))
    .filter(Boolean);
  
  // Fallback to safe defaults if no styles selected
  if (selectedStyles.length === 0) {
    styleSelectionRules.defaultFallbacks.whenNoMatch.forEach(styleId => {
      const style = visualStylesLibrary.find(s => s.id === styleId);
      if (style) {
        selectedStyles.push(style);
      }
    });
  }
  
  return selectedStyles.slice(0, targetStyleCount);
}

/**
 * Step 2: Visual Style Direction (ENHANCED - Creative Direction with Style Library)
 */
export async function runStep2_VisualStyleDirection(input) {
  const { step1Output, brandHub, carouselProfile, generationId, tenantId, accountId } = input;
  const dimensions = dimensionsFor(carouselProfile?.format);
  const photographyOnly = carouselProfile?.imagePolicy?.mode === 'all-slides-photography';

  // Load visual styles library and selection rules
  const visualStylesLibrary = await loadVisualStylesLibrary();
  const styleSelectionRules = await loadStyleSelectionRules();
  const compositionPrinciples = await loadCompositionPrinciples();
  
  // Select appropriate styles based on content and brand
  const forcedStyleIds = carouselProfile?.imagePolicy?.allowedStyles || [];
  const selectedStyles = photographyOnly
    ? forcedStyleIds
        .map((styleId) => visualStylesLibrary.find((style) => style.id === styleId))
        .filter(Boolean)
    : selectVisualStyles(step1Output, brandHub, visualStylesLibrary, styleSelectionRules);
  
  console.log(`[Step 2] Selected ${selectedStyles.length} visual styles:`, selectedStyles.map(s => s.name).join(', '));

  const systemPrompt = `You are a creative director for iGEO, inspired by sophisticated, social-native Instagram editorial aesthetics like @mayven_____.

YOU HAVE ACCESS TO A VISUAL STYLES LIBRARY with pre-designed creative approaches. Use these styles as your creative palette.

MAYVEN EDITORIAL PRINCIPLES:
${JSON.stringify(styleSelectionRules.mayvenPrinciples.principles, null, 2)}

BANNED FAILURE MODES:
${styleSelectionRules.mayvenPrinciples.avoidFailureModes.map(f => `✗ ${f}`).join('\n')}

COMPOSITION PRINCIPLES:
- Negative Space: ${compositionPrinciples.negativeSpacePhilosophy.coreprinciple}
- Text Zone Strategy: ${JSON.stringify(compositionPrinciples.negativeSpacePhilosophy.textZoneStrategy)}
- Visual Narrative: ${JSON.stringify(compositionPrinciples.slideToSlideTransitions.visualNarrative)}

SLIDE TYPE ROUTING (for 3–5 slide carousel):
${photographyOnly
    ? `- Every slide uses premium, location-specific real-estate or architectural photography.
- Generic abstract backgrounds, blobs, floating 3D objects, decorative gradients, and stock icons are forbidden.
- A purposeful editorial graphic is allowed only when the account profile explicitly assigns that narrative role.`
    : `- Exactly one editorial hero slide may use realistic photography.
- Every other slide must use a coordinated abstract/editorial designed background.`}
- NO slide may be an empty solid-color canvas and NO slide may skip visual generation.

For EVERY slide, select ONE style from the provided library and use its promptTemplate to generate a COMPLETE, DETAILED imagePrompt that includes:
1. Style-specific visual elements from the chosen style
2. Brand colors integrated into the composition
3. Negative space zones clearly specified (40-60% open for text)
4. Composition type from the style (centered, asymmetric, split, layered)
5. NO TEXT instruction emphasized
6. Continuity elements shared across carousel slides
7. ${photographyOnly
    ? 'A deliberate premium architectural-photography composition with authentic materials, lighting, location, and subject separation. Do not add decorative abstract forms.'
    : `A deliberate editorial layout: overlapping rounded panels, image windows,
   organic color fields, fine contour lines, cut-paper shapes, or restrained
   botanical/architectural motifs. Never return a nearly empty background.`}
8. If a phone, tablet, laptop, document, sign, or display is visible, its
   surface must contain meaningful non-text visual content related to the
   slide—such as a simplified floor-plan preview, image thumbnail, message
   bubbles, map geometry, or UI cards. Never show a blank white screen.

The generated image is the visual art layer only. Reserve clean areas or
solid-color panels for Figma text overlays, but do not put any text in the image.

CRITICAL: Return valid JSON only (no markdown fences, no commentary outside the JSON).`;

  const userPrompt = `Step 1 plan:
${JSON.stringify(step1Output, null, 2)}

BrandHub context:
- Brand: ${brandHub.title || 'Unknown'}
- Industry: ${brandHub.industryCategory || 'General'} / ${brandHub.subIndustryCategory || 'N/A'}
- Target audience: ${(brandHub.targetAudience || []).join(', ') || 'General audience'}
- Tone of voice: ${(brandHub.toneOfVoice || []).join(', ') || 'Professional'}
- Personality: ${(brandHub.personality || []).join(', ') || 'Authentic'}
- Brand colors: ${JSON.stringify(brandHub.brandColors || [])}

ACCOUNT-SPECIFIC CREATIVE DEFINITION (takes precedence over generic rules):
${JSON.stringify(carouselProfile, null, 2)}

SELECTED VISUAL STYLES (use these as your creative palette):
${JSON.stringify(selectedStyles, null, 2)}

INSTRUCTIONS:
1. Choose the BEST style from the selected styles for every slide based on:
   - Slide role (hook, insight, proof, tip, cta)
   - Content type and brand personality
   - Visual continuity across carousel
2. Use the style's promptTemplate as foundation, customize with:
   - Specific brand colors (insert hex values)
   - Composition requirements (insert composition type)
   - Text zone specification (insert negativeSpaceZones)
   - Content-specific subject matter
3. ${photographyOnly
    ? 'Use premium, coherent Cyprus/property photography on all slides. Do not introduce generic abstract art. Purposeful map/data graphics are allowed only for a matching narrative role.'
    : `Use editorial photography on at most one hero slide. Use abstract/editorial
   styles for all supporting slides so the carousel resembles a designed
   magazine system rather than unrelated AI scenes.`}
4. ${photographyOnly
    ? 'Supporting slides must remain visually rich through premium property subjects, skyline/coastline context, architectural details, and coherent photographic art direction.'
    : `Supporting slides must still be visually rich: include 2-4 large intentional
   forms such as rounded content panels, cropped photo windows, flowing color
   bands, contour-line accents, or botanical/architectural details.`}
5. Never use a blank white field, a plain gradient by itself, tiny isolated
   accents, or generic stock icons.
6. Ensure visual continuity: same palette, repeated corner radius/shape language,
   and one recurring motif across all slides.
7. For each slide define the exact text-safe rectangle on the ${dimensions.CANVAS_WIDTH}x${dimensions.CANVAS_HEIGHT} Instagram ${dimensions.format.aspectRatio} canvas.
   CRITICAL FORMAT REQUIREMENTS:
   - Text zone must have y >= ${dimensions.TEXT_SAFE_Y}
   - Text zone must have y + height <= ${dimensions.TEXT_MAX_Y}
   - Text zone must have x >= ${dimensions.TEXT_SAFE_X} and x + width <= ${dimensions.TEXT_MAX_X}
   - Minimum zone size: width >= 320, height >= 260
   - Specify whether the zone is visually "light" or "dark" for text color selection
   - Keep important visual subjects completely outside this rectangle.

Output shape:
{
  "visualTheme": "editorial|lifestyle|playful|minimalist|bold|contemporary",
  "selectedStyleIds": ["style-id-1", "style-id-2"],
  "editorialDirection": "Description of visual approach adapted to this brand",
  "colorStrategy": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "bright|pastel|clean|gradient",
    "socialNativePalette": ["#hex1", "#hex2"]
  },
  "continuityKey": {
    "palette": "consistent color story",
    "visualMotif": "repeated element or style",
    "compositionRhythm": "pattern of dense and sparse",
    "textZoneConsistency": "text placement strategy"
  },
  "perSlideVisuals": [
    {
      "slideIndex": 1,
      "slideType": "image-led|design-led",
      "selectedStyleId": "style-id-from-library",
      "visualRole": "hero|supporting|minimal",
      "composition": "centered|asymmetric|split|layered|top-heavy|bottom-heavy",
      "negativeSpaceZones": "top-third|bottom-third|middle|left|right|center",
      "textZoneTone": "light|dark",
      "textZoneBounds": {"x":72,"y":96,"width":936,"height":650},
      "imagePrompt": "COMPLETE prompt using style's template, customized with brand colors, composition, designed panels/details, and content",
      "layoutArchetype": "hero|editorial_cards|abstract_flow|photo_collage|designed_cta",
      "designSystemElements": ["brand_color_accent", "oversized_type", "style-specific-element"],
      "rationale": "why this style and visual strategy serves the slide's communication goal"
    }
  ]
}`;

  const response = await callClaude(systemPrompt, userPrompt, { 
    maxTokens: 8192,
    generationId,
    tenantId,
    accountId,
    step: 2,
  });
  const result = parseClaudeJSON(response);
  if (photographyOnly) {
    const allowedGraphicRoles = new Set(carouselProfile.imagePolicy?.purposefulGraphicRoles || []);
    for (const slide of result.perSlideVisuals || []) {
      const plannedSlide = step1Output.slides?.find((item) => item.index === slide.slideIndex);
      const role = plannedSlide?.role || '';
      const purposefulGraphic = allowedGraphicRoles.has(role);
      slide.selectedStyleId = forcedStyleIds[0] || 'editorial-photography';
      slide.slideType = purposefulGraphic ? 'design-led' : 'image-led';
      slide.imagePrompt = `${slide.imagePrompt} Account rule: ${
        purposefulGraphic
          ? 'Create a refined, brand-relevant editorial data/map graphic; do not use generic abstract decoration.'
          : `Use authentic premium Cyprus real-estate, architecture, coastline, or development photography. No generic abstract blobs, 3D objects, floating icons, cut-paper forms, or decorative gradient art.`
      } Banned elements: ${(carouselProfile.imagePolicy?.bannedElements || []).join(', ')}.`;
    }
    result.selectedStyleIds = forcedStyleIds.length ? forcedStyleIds : ['editorial-photography'];
    result.colorStrategy = {
      ...(result.colorStrategy || {}),
      primary: carouselProfile.palette?.primary,
      secondary: carouselProfile.palette?.secondary,
      accent: carouselProfile.palette?.accent,
      socialNativePalette: Object.values(carouselProfile.palette || {}).filter(Boolean),
    };
  }
  
  // VALIDATION: Every slide needs a complete visual prompt. Text is assembled
  // separately in Figma, but the background art must never be skipped.
  for (const slide of result.perSlideVisuals || []) {
    if (!slide.imagePrompt || slide.imagePrompt.length < 100) {
      throw new Error(`Step 2 validation failed: Slide ${slide.slideIndex} has an incomplete imagePrompt (every slide must have a designed visual background)`);
    }
    // Check that the prompt references the slide's purpose
    if (!slide.rationale || slide.rationale.length < 20) {
      throw new Error(`Step 2 validation failed: Slide ${slide.slideIndex} missing rationale explaining how visual serves communication goal`);
    }
    if (!['light', 'dark'].includes(slide.textZoneTone)) {
      throw new Error(`Step 2 validation failed: Slide ${slide.slideIndex} must declare textZoneTone as light or dark`);
    }
    const bounds = slide.textZoneBounds;
    if (
      !bounds ||
      ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
      bounds.x < dimensions.TEXT_SAFE_X ||
      bounds.y < dimensions.TEXT_SAFE_Y ||
      bounds.width < 320 ||
      bounds.height < 260 ||
      bounds.x + bounds.width > dimensions.TEXT_MAX_X ||
      bounds.y + bounds.height > dimensions.TEXT_MAX_Y
    ) {
      console.error(`[Step 2 Validation] Slide ${slide.slideIndex} textZoneBounds:`, JSON.stringify(bounds));
      console.error(`[Step 2 Validation] Validation checks:`, {
        exists: !!bounds,
        allFinite: bounds ? [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) : false,
        xValid: bounds ? bounds.x >= INSTAGRAM_DIMENSIONS.TEXT_SAFE_X : false,
        yValid: bounds ? bounds.y >= INSTAGRAM_DIMENSIONS.TEXT_SAFE_Y : false,
        widthValid: bounds ? bounds.width >= 320 : false,
        heightValid: bounds ? bounds.height >= 260 : false,
        xBoundValid: bounds ? bounds.x + bounds.width <= INSTAGRAM_DIMENSIONS.TEXT_MAX_X : false,
        yBoundValid: bounds ? bounds.y + bounds.height <= INSTAGRAM_DIMENSIONS.TEXT_MAX_Y : false,
        instagramSafeX: dimensions.TEXT_SAFE_X,
        instagramSafeY: dimensions.TEXT_SAFE_Y,
        instagramMaxX: dimensions.TEXT_MAX_X,
        instagramMaxY: dimensions.TEXT_MAX_Y,
      });
      throw new Error(`Step 2 validation failed: Slide ${slide.slideIndex} has invalid textZoneBounds (must fit within Instagram safe zone: x>=${dimensions.TEXT_SAFE_X}, y>=${dimensions.TEXT_SAFE_Y}, maxX<=${dimensions.TEXT_MAX_X}, maxY<=${dimensions.TEXT_MAX_Y})`);
    }
  }
  
  // VALIDATION: Ensure slideCount matches
  const plannedSlideCount = step1Output.slideCount || step1Output.slides?.length;
  if (result.perSlideVisuals.length !== plannedSlideCount) {
    throw new Error(`Step 2 validation failed: perSlideVisuals count (${result.perSlideVisuals.length}) doesn't match Step 1 slideCount (${plannedSlideCount})`);
  }
  
  return result;
}

/**
 * Step 3: Choose the best visual templates (was Step 2)
 */
export async function runStep3_ChooseTemplates(input) {
  const { step1Output, step2Output, templates, carouselProfile, generationId, tenantId, accountId } = input;

  const systemPrompt = `You are an Instagram art director for iGEO.
Using Step 1's plan and Step 2's visual direction, choose the best template(s) from the templates catalog.
Templates define typography and text placement zones - visuals come from Step 2.

CRITICAL: Return valid JSON only (no markdown fences, no commentary outside the JSON).`;

  const userPrompt = `Step 1 plan:
${JSON.stringify(step1Output, null, 2)}

Step 2 visual direction:
${JSON.stringify(step2Output, null, 2)}

Templates catalog:
${JSON.stringify(templates, null, 2)}

Account layout definitions:
${JSON.stringify(carouselProfile?.layouts || [], null, 2)}

Choose templates that complement Step 2 visual style. Map each slide to a template. When an account layout matches a slide role, return its id as layoutVariant; account layout geometry takes precedence during assembly.

Output shape:
{"primaryTemplateId":"","secondaryTemplateId":null,"rationale":"","slideTemplateMap":[{"slideIndex":1,"templateId":"","layoutVariant":"","zones":{"headline":true,"body":true,"image":true,"logo":true,"accent":true},"notes":""}]}`;

  const response = await callClaude(systemPrompt, userPrompt, { 
    maxTokens: 4096,
    generationId,
    tenantId,
    accountId,
    step: 3,
  });
  return parseClaudeJSON(response);
}

/**
 * Step 4: Apply BrandHub + post text (was Step 3)
 */
export async function runStep4_ApplyBrandHub(input) {
  const {
    step1Output,
    step2Output,
    step3Output,
    brandHub,
    postText,
    carouselProfile,
    generationId,
    tenantId,
    accountId,
  } = input;

  const systemPrompt = `You are the brand systems designer for iGEO Brand Hub (Brandbook).
Merge the real Account BrandHub fields with Step 2 visual direction and post text into a production-ready design brief.
Preserve BrandHub facts exactly — same data iGEO agents inject.

CRITICAL: Return valid JSON only (no markdown fences, no commentary outside the JSON).`;

  const userPrompt = `Step 1 plan:
${JSON.stringify(step1Output, null, 2)}

Step 2 visual direction:
${JSON.stringify(step2Output, null, 2)}

Step 3 templates:
${JSON.stringify(step3Output, null, 2)}

BrandHub (iGEO Account):
${JSON.stringify(brandHub, null, 2)}

Post text:
${postText}

Account-specific creative definition:
${JSON.stringify(carouselProfile, null, 2)}

Merge visual direction with BrandHub. Apply brand voice, colors, and guidelines. Produce final per-slide copy and Instagram caption. For editorial profiles, return headlineEmphasis as exact headline substrings that should be italicized; use at most one emphasis phrase per headline.

Output shape:
{"brand":{"title":"","logo":null,"names":[],"domains":[],"about":"","industryCategory":"","subIndustryCategory":"","language":"","targetAudience":[],"toneOfVoice":[],"values":[],"personality":[],"keyFeatures":[],"knowledgeSources":[],"postGuidelines":{"dos":[],"donts":[]},"brandColors":[{"hex":"","r":0,"g":0,"b":0,"name":null}],"socials":{},"skipPostImages":false,"paletteRoles":{"primary":null,"secondary":null,"accent":null},"typographyFromTemplate":true},"caption":{"hook":"","body":"","cta":"","hashtags":[]},"slides":[{"index":1,"templateId":"","headline":"","headlineEmphasis":[],"body":"","microLabel":null,"textColorHex":null,"bodyColorHex":null,"backgroundColorHex":null,"accentColorHex":null,"imageRequired":true,"imageRole":"hero|supporting|icon|none","logoAsset":null,"notes":""}]}`;

  const response = await callClaude(systemPrompt, userPrompt, { 
    maxTokens: 8192,
    generationId,
    tenantId,
    accountId,
    step: 4,
  });
  const result = parseClaudeJSON(response);
  if (carouselProfile?.id !== 'default') {
    result.brand = {
      ...result.brand,
      logo: result.brand?.logo || brandHub.logo || null,
      paletteRoles: {
        primary: carouselProfile.palette?.primary,
        secondary: carouselProfile.palette?.secondary,
        accent: carouselProfile.palette?.accent,
      },
      typography: {
        ...(result.brand?.typography || {}),
        ...carouselProfile.typography,
      },
      carouselProfileId: carouselProfile.id,
    };
    result.slides = (result.slides || []).map((slide) => ({
      ...slide,
      textColorHex: slide.textColorHex || carouselProfile.palette?.accent,
      bodyColorHex: slide.bodyColorHex || carouselProfile.palette?.body,
      logoAsset: carouselProfile.logo?.enabled ? (slide.logoAsset || result.brand.logo) : null,
    }));
  }
  return result;
}

/**
 * Step 5: Format caption for Instagram (was Step 4)
 */
export async function runStep5_FormatCaption(input) {
  const { step4Output, generationId, tenantId, accountId } = input;

  const systemPrompt = `You are an Instagram copywriting expert for iGEO.
Transform the caption into Instagram-optimized text: add strategic emojis, include "link in bio" CTA, mark @mentions and #hashtags.
Preserve all factual content and brand voice from Step 4.

CRITICAL: Return valid JSON only (no markdown fences, no commentary outside the JSON).`;

  const userPrompt = `Step 4 design brief:
${JSON.stringify(step4Output, null, 2)}

Transform the caption: add 5-8 emojis, Instagram-specific CTA, ≤5 hashtags, ≤2200 chars total.

Output shape:
{"instagramCaption":{"fullText":"","hookLine":"","bodyParagraphs":[],"cta":"","mentions":[],"hashtags":[],"emojiCount":0,"characterCount":0},"optimizations":{"addedEmojis":[],"ctaType":"link_in_bio|comment|dm|save|share|tag","preservedFromStep4":""}}`;

  const response = await callClaude(systemPrompt, userPrompt, { 
    maxTokens: 4096,
    generationId,
    tenantId,
    accountId,
    step: 5,
  });
  return parseClaudeJSON(response);
}

/**
 * Step 7: Design text layout (NEW - Text positioning)
 */
function resolveTextZone(visual = {}) {
  const supplied = visual.textZoneBounds;
  if (
    supplied &&
    [supplied.x, supplied.y, supplied.width, supplied.height].every(Number.isFinite) &&
    supplied.x >= INSTAGRAM_DIMENSIONS.TEXT_SAFE_X &&
    supplied.y >= INSTAGRAM_DIMENSIONS.TEXT_SAFE_Y &&
    supplied.x + supplied.width <= INSTAGRAM_DIMENSIONS.TEXT_MAX_X &&
    supplied.y + supplied.height <= INSTAGRAM_DIMENSIONS.TEXT_MAX_Y
  ) {
    return supplied;
  }

  const zone = String(visual.negativeSpaceZones || 'top-third').toLowerCase();
  // Use Instagram-safe fallback positions
  if (zone.includes('bottom')) return { x: INSTAGRAM_DIMENSIONS.TEXT_SAFE_X + 8, y: 570, width: 936, height: 350 };
  if (zone.includes('right')) return { x: 508, y: INSTAGRAM_DIMENSIONS.TEXT_SAFE_Y, width: 500, height: 800 };
  if (zone.includes('left')) return { x: INSTAGRAM_DIMENSIONS.TEXT_SAFE_X + 8, y: INSTAGRAM_DIMENSIONS.TEXT_SAFE_Y, width: 500, height: 800 };
  if (zone.includes('middle') || zone.includes('center')) return { x: 120, y: 220, width: 840, height: 640 };
  return { x: INSTAGRAM_DIMENSIONS.TEXT_SAFE_X + 8, y: INSTAGRAM_DIMENSIONS.TEXT_SAFE_Y, width: 936, height: 700 };
}

function estimateTextHeight(content, width, fontSize, lineHeight) {
  const charsPerLine = Math.max(8, Math.floor(width / (fontSize * 0.56)));
  const explicitLines = String(content).split('\n');
  const lineCount = explicitLines.reduce(
    (count, line) => count + Math.max(1, Math.ceil(line.length / charsPerLine)),
    0,
  );
  return Math.ceil(lineCount * fontSize * lineHeight);
}

function buildHeadlineSegments(content, emphasis = []) {
  const source = String(content || '');
  const phrases = (Array.isArray(emphasis) ? emphasis : [emphasis])
    .map((phrase) => String(phrase || '').trim())
    .filter(Boolean);
  if (!phrases.length) return [{ text: source, italic: false }];

  const phrase = phrases.find((candidate) => source.toLowerCase().includes(candidate.toLowerCase()));
  if (!phrase) return [{ text: source, italic: false }];
  const start = source.toLowerCase().indexOf(phrase.toLowerCase());
  return [
    { text: source.slice(0, start), italic: false },
    { text: source.slice(start, start + phrase.length), italic: true },
    { text: source.slice(start + phrase.length), italic: false },
  ].filter((segment) => segment.text);
}

export function buildTextAwareBlueprint(step4Output, step2Output, step3Output, carouselProfile) {
  const dimensions = dimensionsFor(carouselProfile?.format);
  const format = dimensions.format;
  const visualsByIndex = new Map(
    (step2Output?.perSlideVisuals || []).map((visual) => [visual.slideIndex, visual]),
  );
  const templatesByIndex = new Map(
    (step3Output?.slideTemplateMap || []).map((template) => [template.slideIndex, template]),
  );
  const typography = {
    ...(step4Output?.brand?.typography || {}),
    ...(carouselProfile?.typography || {}),
  };
  const profileLayouts = carouselProfile?.layouts || [];
  const slides = (step4Output?.slides || step4Output?.carouselSlides || []).map((slide) => {
    const slideIndex = slide.slideIndex ?? slide.index;
    const visual = visualsByIndex.get(slideIndex) || {};
    const template = templatesByIndex.get(slideIndex) || {};
    const profileLayout = profileLayouts.find((layout) => layout.id === template.layoutVariant)
      || profileLayouts.find((layout) => (layout.roles || []).includes(slide.role))
      || profileLayouts[(slideIndex - 1) % Math.max(profileLayouts.length, 1)]
      || null;
    const zoneName = String(visual.negativeSpaceZones || '').toLowerCase();
    const alignment = profileLayout?.alignment || (zoneName.includes('center') || zoneName.includes('middle')
      ? 'center'
      : zoneName.includes('right')
        ? 'right'
        : 'left');
    const requested = clampBoundsToFormat(
      profileLayout?.textZoneBounds || visual.textZoneBounds || {
        x: alignment === 'right' ? Math.round(format.width * 0.43) : format.margins.left,
        y: format.margins.top + 54,
        width: alignment === 'center'
          ? format.width - format.margins.left - format.margins.right
          : Math.round(format.width * 0.5),
        height: Math.round(format.height * 0.6),
      },
      0,
      format,
    );
    let protectedBounds = clampBoundsToFormat({
      ...requested,
      width: Math.max(Math.min(520, format.width * 0.48), requested.width),
      height: Math.max(Math.min(480, format.height * 0.44), requested.height),
    }, 0, format);
    const innerWidth = protectedBounds.width - 80;
    const headlineSize = String(slide.headline || '').length > 78
      ? (format.aspectRatio === '1:1' ? 54 : 58)
      : String(slide.headline || '').length > 48
        ? (format.aspectRatio === '1:1' ? 66 : 68)
        : (format.aspectRatio === '1:1' ? 88 : 82);
    const definitions = [
      {
        type: 'label',
        content: slide.microLabel,
        fontFamily: typography.labelFont || 'Inter',
        fontSize: 22,
        minFontSize: 17,
        fontWeight: typography.labelWeight || '600',
        lineHeight: 1.2,
        letterSpacing: 1,
        textTransform: 'uppercase',
      },
      {
        type: 'headline',
        content: slide.headline,
        fontFamily: typography.headlineFont || 'Montserrat',
        fontSize: headlineSize,
        minFontSize: 46,
        fontWeight: typography.headlineWeight || '700',
        fontStyle: 'Regular',
        italicStyle: typography.headlineItalicStyle || 'Italic',
        segments: buildHeadlineSegments(slide.headline, slide.headlineEmphasis),
        lineHeight: 1.06,
        letterSpacing: -1,
        textTransform: 'none',
      },
      {
        type: 'body',
        content: slide.body,
        fontFamily: typography.bodyFont || 'Inter',
        fontSize: 30,
        minFontSize: 23,
        fontWeight: typography.bodyWeight || '500',
        lineHeight: 1.35,
        letterSpacing: 0,
        textTransform: 'none',
      },
    ].filter((item) => String(item.content || '').trim());
    const gap = 24;
    const measureDefinitions = () => definitions.map((item) => ({
      ...item,
      height: estimateTextHeight(item.content, innerWidth, item.fontSize, item.lineHeight),
    }));
    let measured = measureDefinitions();
    const calculateTotalHeight = () => measured.reduce((sum, item) => sum + item.height, 0)
      + gap * Math.max(0, measured.length - 1);
    let totalHeight = calculateTotalHeight();
    if (totalHeight + 80 > protectedBounds.height) {
      const maxHeightAtCurrentY = dimensions.TEXT_MAX_Y - protectedBounds.y;
      if (maxHeightAtCurrentY >= totalHeight + 80) {
        protectedBounds = { ...protectedBounds, height: totalHeight + 80 };
      } else {
        protectedBounds = clampBoundsToFormat({
          ...protectedBounds,
          y: dimensions.TEXT_SAFE_Y,
          height: Math.max(protectedBounds.height, totalHeight + 80),
        }, 0, format);
      }
    }
    let availableHeight = protectedBounds.height - 80;
    while (totalHeight > availableHeight) {
      let reduced = false;
      for (const item of definitions) {
        if (item.fontSize > item.minFontSize) {
          item.fontSize = Math.max(item.minFontSize, item.fontSize - (item.type === 'headline' ? 2 : 1));
          reduced = true;
        }
      }
      if (!reduced) break;
      measured = measureDefinitions();
      totalHeight = calculateTotalHeight();
    }
    if (totalHeight > availableHeight) {
      protectedBounds = clampBoundsToFormat({
        ...protectedBounds,
        y: dimensions.TEXT_SAFE_Y,
        height: dimensions.TEXT_MAX_Y - dimensions.TEXT_SAFE_Y,
      }, 0, format);
      availableHeight = protectedBounds.height - 80;
    }
    if (totalHeight > availableHeight) {
      throw new Error(`Slide ${slideIndex}: copy cannot fit inside Instagram ${format.aspectRatio} bounds`);
    }
    const startY = protectedBounds.y + 40 + Math.max(0, (availableHeight - totalHeight) / 2);
    let cursorY = Math.round(startY);
    const preliminaryColor = carouselProfile?.readability?.mode === 'profile-scrim'
      ? (slide.textColorHex || carouselProfile.palette?.accent || '#FFFFFF')
      : visual.textZoneTone === 'dark'
        ? '#FFFFFF'
        : (slide.textColorHex || '#111111');
    const textLayers = measured.map((item) => {
      const layer = {
        layerId: item.type,
        type: item.type,
        content: item.content,
        position: {
          x: protectedBounds.x + 40,
          y: cursorY,
          width: innerWidth,
          height: item.height,
          alignment,
        },
        typography: {
          fontFamily: item.fontFamily,
          fontSize: item.fontSize,
          minFontSize: item.minFontSize,
          fontWeight: item.fontWeight,
          fontStyle: item.fontStyle || 'Regular',
          italicStyle: item.italicStyle,
          segments: item.segments,
          lineHeight: item.lineHeight,
          letterSpacing: item.letterSpacing,
          textTransform: item.textTransform,
        },
        color: item.type === 'body'
          ? (slide.bodyColorHex || carouselProfile?.palette?.body || preliminaryColor)
          : preliminaryColor,
        effects: {
          shadow: false,
          shadowColor: '#00000040',
          shadowBlur: 20,
          shadowOffset: { x: 0, y: 4 },
        },
      };
      cursorY += item.height + gap;
      return layer;
    });
    return {
      slideIndex,
      textBlock: {
        archetype: alignment === 'center' ? 'centered-stack' : `${alignment}-editorial-stack`,
        protectedBounds,
        alignment,
        panel: null,
      },
      textLayers,
      templateId: template.templateId || slide.templateId || null,
      layoutVariant: profileLayout?.id || template.layoutVariant || null,
      overlay: carouselProfile?.readability?.mode === 'profile-scrim'
        ? {
            type: 'scrim',
            ...carouselProfile.readability.scrim,
            direction: profileLayout?.scrimDirection || carouselProfile.readability.scrim?.direction,
          }
        : null,
      logoLayer: carouselProfile?.logo?.enabled
        ? {
            ...carouselProfile.logo,
            assetRef: slide.logoAsset || step4Output?.brand?.logo || null,
          }
        : null,
    };
  });
  return {
    profileId: carouselProfile?.id || 'default',
    profileVersion: carouselProfile?.version || 1,
    format,
    typographySystem: {
      headlineFontFamily: typography.headlineFont || 'Montserrat',
      bodyFontFamily: typography.bodyFont || 'Inter',
      labelFontFamily: typography.labelFont || 'Inter',
    },
    slides,
    qualityCheck: {
      passed: true,
      source: 'pre-image-deterministic-blueprint',
      rules: ['single-coherent-block', 'copy-preserved', 'inside-format-margins', 'account-profile-applied'],
      repairedIssues: [],
    },
  };
}

function boxesOverlap(a, b) {
  if (!a?.position || !b?.position) return false;
  return (
    a.position.x < b.position.x + b.position.width &&
    a.position.x + a.position.width > b.position.x &&
    a.position.y < b.position.y + b.position.height &&
    a.position.y + a.position.height > b.position.y
  );
}

function validateAndRepairTextLayout(layout, step4Output, step6Output, source) {
  // Helper: Check if a text layer is fully within a zone
  function isWithinZone(layer, zone) {
    if (!layer.position || !zone.bounds) return false;
    const { x, y, width, height } = layer.position;
    const { x: zx, y: zy, width: zw, height: zh } = zone.bounds;
    return x >= zx && y >= zy && (x + width) <= (zx + zw) && (y + height) <= (zy + zh);
  }
  
  // Helper: Find the best zone for a text layer type
  function findZoneForTextType(zones, textType) {
    if (!zones || zones.length === 0) return null;
    
    // Map text types to zone priorities
    const typeToSuggestion = {
      'headline': 'headline',
      'body': 'body',
      'microLabel': 'microLabel',
      'label': 'microLabel',
    };
    
    const suggestion = typeToSuggestion[textType];
    
    // First, try to find a zone with matching suggestion
    const matchingZone = zones.find(z => z.suggestedFor === suggestion);
    if (matchingZone) return matchingZone;
    
    // Fallback: use primary for headline, secondary for body, tertiary for label
    if (textType === 'headline') return zones.find(z => z.priority === 'primary') || zones[0];
    if (textType === 'body') return zones.find(z => z.priority === 'secondary') || zones[1] || zones[0];
    if (textType === 'label' || textType === 'microLabel') {
      return zones.find(z => z.priority === 'tertiary') || zones[2] || zones[1] || zones[0];
    }
    
    return zones[0]; // Ultimate fallback
  }
  
  // Helper: Snap a text layer to fit within a zone
  function snapToZone(layer, zone) {
    if (!layer.position || !zone.bounds) return layer;
    
    const { x, y, width, height } = layer.position;
    const { x: zx, y: zy, width: zw, height: zh } = zone.bounds;
    
    // Ensure width/height fit within zone
    const newWidth = Math.min(width, zw - 32); // Leave 16px padding on each side
    const newHeight = Math.min(height, zh - 32);
    
    // Snap position to be within zone
    let newX = x;
    let newY = y;
    
    if (x < zx) newX = zx + 16;
    if (x + newWidth > zx + zw) newX = zx + zw - newWidth - 16;
    
    if (y < zy) newY = zy + 16;
    if (y + newHeight > zy + zh) newY = zy + zh - newHeight - 16;
    
    return {
      ...layer,
      position: {
        ...layer.position,
        x: Math.max(zx, newX),
        y: Math.max(zy, newY),
        width: newWidth,
        height: newHeight,
      },
    };
  }
  
  const expectedSlides = step4Output?.slides || step4Output?.carouselSlides || [];
  const visualByIndex = new Map(
    (step6Output?.images || []).map((image) => [image.slideIndex, image]),
  );
  const suppliedByIndex = new Map(
    (layout?.slides || []).map((slide) => [slide.slideIndex, slide]),
  );
  const repairedIssues = [];
  
  // Extract BrandHub typography with fallbacks
  const brandTypography = step4Output?.brand?.typography || {};
  const headlineFont = brandTypography.headlineFont || 'Montserrat';
  const bodyFont = brandTypography.bodyFont || 'Inter';
  const labelFont = brandTypography.labelFont || 'Inter';
  const headlineWeight = brandTypography.headlineWeight || '700';
  const bodyWeight = brandTypography.bodyWeight || '500';
  const labelWeight = brandTypography.labelWeight || '600';

  const slides = expectedSlides.map((contentSlide) => {
    const slideIndex = contentSlide.slideIndex ?? contentSlide.index;
    const supplied = suppliedByIndex.get(slideIndex) || { textLayers: [] };
    const suppliedLayers = Array.isArray(supplied.textLayers) ? supplied.textLayers : [];
    const visual = visualByIndex.get(slideIndex) || {};
    const zones = visual.zones || [];
    const zone = resolveTextZone(visual);
    const tone = visual.textZoneTone === 'light' ? 'light' : 'dark';
    const alignment = String(visual.negativeSpaceZones || '').toLowerCase().includes('center')
      ? 'center'
      : String(visual.negativeSpaceZones || '').toLowerCase().includes('right')
        ? 'right'
        : 'left';

    // Validate supplied layers against zones
    for (const layer of suppliedLayers) {
      const layerZone = findZoneForTextType(zones, layer.type);
      if (layerZone && !isWithinZone(layer, layerZone)) {
        repairedIssues.push(`Slide ${slideIndex}: ${layer.type} repositioned to safe zone`);
      }
      
      // Check color match
      if (layerZone && layer.color && layer.color.toUpperCase() !== layerZone.recommendedTextColor.toUpperCase()) {
        repairedIssues.push(`Slide ${slideIndex}: ${layer.type} color corrected to match zone`);
      }
    }

    for (let i = 0; i < suppliedLayers.length; i += 1) {
      for (let j = i + 1; j < suppliedLayers.length; j += 1) {
        if (boxesOverlap(suppliedLayers[i], suppliedLayers[j])) {
          repairedIssues.push(`Slide ${slideIndex}: overlapping text layers repaired`);
          i = suppliedLayers.length;
          break;
        }
      }
    }

    const definitions = [
      { type: 'label', content: contentSlide.microLabel, min: 18, max: 24, fallback: 20, weight: labelWeight, lineHeight: 1.2, font: labelFont },
      { type: 'headline', content: contentSlide.headline, min: 54, max: 96, fallback: 80, weight: headlineWeight, lineHeight: 1.08, font: headlineFont },
      { type: 'body', content: contentSlide.body, min: 24, max: 34, fallback: 30, weight: bodyWeight, lineHeight: 1.38, font: bodyFont },
    ].filter((definition) => String(definition.content || '').trim());

    const layers = definitions.map((definition) => {
      const existing = suppliedLayers.find(
        (layer) => layer.type === definition.type || layer.layerId === definition.type,
      );
      if (!existing) repairedIssues.push(`Slide ${slideIndex}: missing ${definition.type} restored`);
      const requestedSize = Number(existing?.typography?.fontSize);
      const fontSize = Number.isFinite(requestedSize)
        ? Math.min(definition.max, Math.max(definition.min, requestedSize))
        : definition.fallback;
      
      // Use zone-specific color if zones are available
      const targetZone = findZoneForTextType(zones, definition.type);
      const correctColor = targetZone?.recommendedTextColor 
        ? targetZone.recommendedTextColor.toUpperCase()
        : /^#(?:FFFFFF|111111)$/i.test(visual.recommendedTextColor || '')
          ? visual.recommendedTextColor.toUpperCase()
          : tone === 'dark'
            ? '#FFFFFF'
            : '#111111';
      
      if (existing?.color && existing.color.toUpperCase() !== correctColor.toUpperCase()) {
        repairedIssues.push(`Slide ${slideIndex}: ${definition.type} contrast corrected`);
      }

      return {
        ...existing,
        layerId: definition.type,
        type: definition.type,
        content: definition.content,
        typography: {
          ...existing?.typography,
          fontFamily: definition.font,
          fontSize,
          fontWeight: definition.weight,
          lineHeight: definition.lineHeight,
          letterSpacing: definition.type === 'headline' ? -1 : definition.type === 'label' ? 1 : 0,
          textTransform: definition.type === 'label' ? 'uppercase' : 'none',
        },
        color: correctColor,
        effects: {
          shadow: false,
          shadowColor: '#00000040',
          shadowBlur: 20,
          shadowOffset: { x: 0, y: 4 },
        },
      };
    });

    // If we have multi-zone data, position each layer in its appropriate zone
    if (zones.length > 0) {
      for (const layer of layers) {
        const targetZone = findZoneForTextType(zones, layer.type);
        if (targetZone) {
          const height = estimateTextHeight(
            layer.content,
            targetZone.bounds.width,
            layer.typography.fontSize,
            layer.typography.lineHeight,
          );
          
          // Center vertically within the zone
          const yOffset = Math.max(16, Math.floor((targetZone.bounds.height - height) / 2));
          
          layer.position = {
            x: targetZone.bounds.x + 16, // 16px padding from zone edge
            y: targetZone.bounds.y + yOffset,
            width: targetZone.bounds.width - 32, // 32px total horizontal padding
            height,
            alignment: alignment,
          };
          
          // Validate and snap if needed
          if (!isWithinZone(layer, targetZone)) {
            const snapped = snapToZone(layer, targetZone);
            layer.position = snapped.position;
            repairedIssues.push(`Slide ${slideIndex}: ${layer.type} snapped to zone bounds`);
          }
        }
      }
    } else {
      // Fallback to old single-zone layout
      const gap = layers.length === 3 ? 24 : 32;
      const totalHeight = () => layers.reduce(
        (sum, layer) => sum + estimateTextHeight(
          layer.content,
          zone.width,
          layer.typography.fontSize,
          layer.typography.lineHeight,
        ),
        0,
      ) + gap * Math.max(0, layers.length - 1);

      while (totalHeight() > zone.height) {
        const reducible = layers
          .filter((layer) => layer.typography.fontSize > (layer.type === 'headline' ? 54 : layer.type === 'body' ? 24 : 18))
          .sort((a, b) => b.typography.fontSize - a.typography.fontSize)[0];
        if (!reducible) break;
        reducible.typography.fontSize -= 2;
      }

      let y = zone.y + Math.max(0, Math.floor((zone.height - totalHeight()) / 2));
      for (const layer of layers) {
        const height = estimateTextHeight(
          layer.content,
          zone.width,
          layer.typography.fontSize,
          layer.typography.lineHeight,
        );
        layer.position = { x: zone.x, y, width: zone.width, height, alignment };
        y += height + gap;
      }
    }

    return { slideIndex, textLayers: layers };
  });

  return {
    ...layout,
    slides,
    qualityCheck: {
      passed: true,
      checkedAt: new Date().toISOString(),
      source,
      rules: ['content-preserved', 'no-overlap', 'inside-safe-zone', 'minimum-type-size', 'light-dark-contrast'],
      repairedIssues: [...new Set(repairedIssues)],
    },
  };
}

function buildFallbackTextLayout(step4Output, step6Output) {
  const visualByIndex = new Map(
    (step6Output?.images || []).map((image) => [image.slideIndex, image]),
  );
  const sourceSlides = step4Output?.slides || step4Output?.carouselSlides || [];
  
  // Extract BrandHub typography with fallbacks
  const brandTypography = step4Output?.brand?.typography || {};
  const headlineFont = brandTypography.headlineFont || 'Montserrat';
  const bodyFont = brandTypography.bodyFont || 'Inter';
  const labelFont = brandTypography.labelFont || 'Inter';
  const headlineWeight = brandTypography.headlineWeight || '700';
  const bodyWeight = brandTypography.bodyWeight || '500';
  const labelWeight = brandTypography.labelWeight || '600';
  
  // Helper: Find zone for text type (same as in validation)
  function findZoneForTextType(zones, textType) {
    if (!zones || zones.length === 0) return null;
    
    const typeToSuggestion = {
      'headline': 'headline',
      'body': 'body',
      'microLabel': 'microLabel',
      'label': 'microLabel',
    };
    
    const suggestion = typeToSuggestion[textType];
    const matchingZone = zones.find(z => z.suggestedFor === suggestion);
    if (matchingZone) return matchingZone;
    
    if (textType === 'headline') return zones.find(z => z.priority === 'primary') || zones[0];
    if (textType === 'body') return zones.find(z => z.priority === 'secondary') || zones[1] || zones[0];
    if (textType === 'label' || textType === 'microLabel') {
      return zones.find(z => z.priority === 'tertiary') || zones[2] || zones[1] || zones[0];
    }
    
    return zones[0];
  }

  const slides = sourceSlides.map((slide) => {
    const slideIndex = slide.slideIndex ?? slide.index;
    const visual = visualByIndex.get(slideIndex) || {};
    const zones = visual.zones || [];
    const textLayers = [];
    
    // NEW: If we have analyzed zones, use them
    if (zones.length > 0) {
      if (slide.microLabel) {
        const zone = findZoneForTextType(zones, 'label');
        if (zone) {
          textLayers.push({
            layerId: 'label',
            type: 'label',
            content: slide.microLabel,
            position: {
              x: zone.bounds.x + 16,
              y: zone.bounds.y + 16,
              width: zone.bounds.width - 32,
              height: 32,
              alignment: 'left',
            },
            typography: {
              fontFamily: labelFont,
              fontSize: 20,
              fontWeight: labelWeight,
              lineHeight: 1.2,
              letterSpacing: 1,
              textTransform: 'uppercase',
            },
            color: zone.recommendedTextColor,
            effects: {
              shadow: false,
              shadowColor: '#00000040',
              shadowBlur: 20,
              shadowOffset: { x: 0, y: 4 },
            },
          });
        }
      }
      
      if (slide.headline) {
        const zone = findZoneForTextType(zones, 'headline');
        if (zone) {
          const height = Math.min(200, zone.bounds.height - 32);
          const yOffset = Math.floor((zone.bounds.height - height) / 2);
          textLayers.push({
            layerId: 'headline',
            type: 'headline',
            content: slide.headline,
            position: {
              x: zone.bounds.x + 16,
              y: zone.bounds.y + yOffset,
              width: zone.bounds.width - 32,
              height,
              alignment: 'left',
            },
            typography: {
              fontFamily: headlineFont,
              fontSize: 72,
              fontWeight: headlineWeight,
              lineHeight: 1.08,
              letterSpacing: -1,
              textTransform: 'none',
            },
            color: zone.recommendedTextColor,
            effects: {
              shadow: false,
              shadowColor: '#00000040',
              shadowBlur: 20,
              shadowOffset: { x: 0, y: 4 },
            },
          });
        }
      }
      
      if (slide.body) {
        const zone = findZoneForTextType(zones, 'body');
        if (zone) {
          const height = Math.min(160, zone.bounds.height - 32);
          const yOffset = Math.floor((zone.bounds.height - height) / 2);
          textLayers.push({
            layerId: 'body',
            type: 'body',
            content: slide.body,
            position: {
              x: zone.bounds.x + 16,
              y: zone.bounds.y + yOffset,
              width: zone.bounds.width - 32,
              height,
              alignment: 'left',
            },
            typography: {
              fontFamily: bodyFont,
              fontSize: 28,
              fontWeight: bodyWeight,
              lineHeight: 1.38,
              letterSpacing: 0,
              textTransform: 'none',
            },
            color: zone.recommendedTextColor,
            effects: {
              shadow: false,
              shadowColor: '#00000040',
              shadowBlur: 20,
              shadowOffset: { x: 0, y: 4 },
            },
          });
        }
      }
      
      return { slideIndex, textLayers };
    }
    
    // OLD FALLBACK: Use hardcoded positions if no zones available
    const zone = String(visual.negativeSpaceZones || 'top-third').toLowerCase();
    const isBottom = zone.includes('bottom');
    const isRight = zone.includes('right');
    const isLeft = zone.includes('left');
    const isCenter = zone.includes('middle') || zone.includes('center');
    const x = isRight ? 570 : isCenter ? 120 : 80;
    const width = isRight ? 430 : isLeft ? 500 : isCenter ? 840 : 920;
    const startY = isBottom ? 610 : isCenter ? 300 : 100;
    const alignment = isCenter ? 'center' : isRight ? 'right' : 'left';
    const textColor = visual.recommendedTextColor || (visual.textZoneTone === 'light' ? (slide.textColorHex || '#111111') : '#FFFFFF');
    const overPhotography = visual.selectedStyleId === 'editorial-photography';
    const effects = {
      shadow: overPhotography,
      shadowColor: '#00000066',
      shadowBlur: 24,
      shadowOffset: { x: 0, y: 4 },
    };
    let y = startY;

    if (slide.microLabel) {
      textLayers.push({
        layerId: 'label',
        type: 'label',
        content: slide.microLabel,
        position: { x, y, width, height: 44, alignment },
        typography: {
          fontFamily: labelFont,
          fontSize: 20,
          fontWeight: labelWeight,
          lineHeight: 1.2,
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
        color: slide.accentColorHex || textColor,
        effects,
      });
      y += 64;
    }

    if (slide.headline) {
      textLayers.push({
        layerId: 'headline',
        type: 'headline',
        content: slide.headline,
        position: { x, y, width, height: 260, alignment },
        typography: {
          fontFamily: headlineFont,
          fontSize: slide.headline.length > 45 ? 68 : 84,
          fontWeight: headlineWeight,
          lineHeight: 1.12,
          letterSpacing: -1,
          textTransform: 'none',
        },
        color: textColor,
        effects,
      });
      y += slide.headline.length > 45 ? 230 : 210;
    }

    if (slide.body) {
      textLayers.push({
        layerId: 'body',
        type: 'body',
        content: slide.body,
        position: { x, y, width, height: 210, alignment },
        typography: {
          fontFamily: bodyFont,
          fontSize: 30,
          fontWeight: bodyWeight,
          lineHeight: 1.42,
          letterSpacing: 0,
          textTransform: 'none',
        },
        color: textColor,
        effects,
      });
    }

    return { slideIndex, textLayers };
  });

  return {
    typographySystem: {
      headlineFontFamily: headlineFont,
      bodyFontFamily: bodyFont,
      labelFontFamily: labelFont,
    },
    slides,
    fallbackUsed: true,
    fallbackReason: 'Claude API unavailable; used deterministic editorial layout',
  };
}

export async function runStep7_TextLayoutDesign(input) {
  const { step4Output, step6Output, generationId, tenantId, accountId } = input;
  const slides = (step4Output?.slides || step4Output?.carouselSlides || []).map((slide) => ({
    slideIndex: slide.slideIndex ?? slide.index,
    headline: slide.headline,
    body: slide.body,
    microLabel: slide.microLabel,
    role: slide.role,
    textColorHex: slide.textColorHex,
    backgroundColorHex: slide.backgroundColorHex,
    accentColorHex: slide.accentColorHex,
  }));
  const visuals = (step6Output?.images || []).map((image) => ({
    slideIndex: image.slideIndex,
    selectedStyleId: image.selectedStyleId,
    composition: image.composition,
    negativeSpaceZones: image.negativeSpaceZones,
    textZoneTone: image.textZoneTone,
    textZoneBounds: image.textZoneBounds,
    recommendedTextColor: image.recommendedTextColor,
    visualQualityCheck: image.visualQualityCheck,
    // NEW: Include multi-zone data for strict enforcement
    zones: image.zones || null,
  }));
  const brandColors = step4Output?.brand?.brandColors || [];
  
  // Extract BrandHub typography with fallbacks
  const brandTypography = step4Output?.brand?.typography || {};
  const headlineFont = brandTypography.headlineFont || 'Montserrat';
  const bodyFont = brandTypography.bodyFont || 'Inter';
  const labelFont = brandTypography.labelFont || 'Inter';
  const headlineWeight = brandTypography.headlineWeight || '700';
  const bodyWeight = brandTypography.bodyWeight || '500';
  const labelWeight = brandTypography.labelWeight || '600';

  const systemPrompt = `You are an editorial typography designer for premium Instagram carousels.
Create clear hierarchy, deliberate scale contrast, and strong readable color contrast.
CRITICAL: You MUST place ALL text layers within the pixel-analyzed text-safe zones provided.
Never use pale gray or low-opacity text. Never place white text on a light text-safe panel.
Return compact valid JSON only. No markdown. At most 3 textLayers per slide.`;

  // Build per-slide zone constraints
  const slideConstraints = slides.map((slide) => {
    const visual = visuals.find(v => v.slideIndex === slide.slideIndex);
    if (!visual) return null;
    
    const zones = visual.zones || [];
    const zoneDescriptions = zones.map(zone => 
      `  ${zone.priority.toUpperCase()} ZONE (for ${zone.suggestedFor}):
    Bounds: x=${zone.bounds.x}, y=${zone.bounds.y}, width=${zone.bounds.width}, height=${zone.bounds.height}
    Color: ${zone.recommendedTextColor} (${zone.contrastCoverage >= 0.85 ? 'excellent' : zone.contrastCoverage >= 0.7 ? 'good' : 'acceptable'} contrast: ${Math.round(zone.contrastCoverage * 100)}%)
    Tone: ${zone.textZoneTone}`
    ).join('\n');
    
    return `Slide ${slide.slideIndex}:
  Content: "${slide.headline || ''}" / "${slide.body || ''}" / "${slide.microLabel || ''}"
  MANDATORY TEXT-SAFE ZONES (pixel-analyzed, WCAG-compliant):
${zoneDescriptions}
  
  CONSTRAINT: ALL text must fit within these zones. position.x >= zone.x, position.y >= zone.y,
  position.x + position.width <= zone.x + zone.width, position.y + position.height <= zone.y + zone.height`;
  }).filter(Boolean).join('\n\n');

  const userPrompt = `You are laying out text for a ${INSTAGRAM_POST_FORMAT.width}x${INSTAGRAM_POST_FORMAT.height} Instagram carousel.

SLIDES AND ANALYZED ZONES:
${slideConstraints}

BRAND TYPOGRAPHY:
Headline: ${headlineFont} (weight: ${headlineWeight})
Body: ${bodyFont} (weight: ${bodyWeight})
Label: ${labelFont} (weight: ${labelWeight})

BRAND COLORS:
${JSON.stringify(brandColors)}

LAYOUT RULES:
1. Place headline in PRIMARY zone, body in SECONDARY zone, microLabel in TERTIARY zone (if available)
2. Text MUST fit completely within the specified zone bounds
3. Use the recommended color for each zone (already WCAG-tested against the actual image pixels)
4. Headlines: 64-104px, body: 26-36px, microLabel: 18-24px
5. Use position.alignment (left/center/right) for horizontal alignment within the zone
6. Line height: 1.12 for headlines, 1.4 for body, 1.3 for labels
7. Letter spacing: -1 for headlines, 0 for body, 0.5 for labels
8. Add subtle shadow (blur:20, offset:0,4, color:#00000040) ONLY if the zone is over photography (not solid panels)
9. Every text layer must be fully opaque (no transparency)

EXAMPLE OUTPUT:
{"typographySystem":{"headlineFontFamily":"${headlineFont}","bodyFontFamily":"${bodyFont}","labelFontFamily":"${labelFont}"},"slides":[{"slideIndex":1,"textLayers":[{"layerId":"headline","type":"headline","content":"Slide 1 Headline","position":{"x":80,"y":120,"width":920,"height":240,"alignment":"left"},"typography":{"fontFamily":"${headlineFont}","fontSize":80,"fontWeight":"${headlineWeight}","lineHeight":1.12,"letterSpacing":-1,"textTransform":"none"},"color":"#111111","effects":{"shadow":false,"shadowColor":"#00000040","shadowBlur":20,"shadowOffset":{"x":0,"y":4}}}]}]}`;

  try {
    const response = await callClaude(systemPrompt, userPrompt, { 
      maxTokens: 8192, 
      effort: 'low',
      generationId,
      tenantId,
      accountId,
      step: 7,
      maxTransientRetries: 1,
    });
    return validateAndRepairTextLayout(
      parseClaudeJSON(response),
      step4Output,
      step6Output,
      'claude-plus-deterministic-qa',
    );
  } catch (error) {
    console.warn(`[Claude] Step 7 unavailable; using local text layout fallback: ${error.message}`);
    return validateAndRepairTextLayout(
      buildFallbackTextLayout(step4Output, step6Output),
      step4Output,
      step6Output,
      'deterministic-fallback-qa',
    );
  }
}

/**
 * Step 8: Assemble final carousel in Figma (was Step 6)
 */
function buildFallbackFigmaSpec(input, reason) {
  const { step2Output, step4Output, step5Output, step6Output, step7Output, carouselProfile } = input;
  const format = resolveInstagramFormat(carouselProfile?.format || step7Output?.format);
  const imageByIndex = new Map(
    (step6Output?.images || []).map((image) => [image.slideIndex, image]),
  );
  const frames = (step7Output?.slides || []).map((slide) => ({
    slideIndex: slide.slideIndex,
    frameName: String(slide.slideIndex).padStart(2, '0'),
    backgroundAssetRef: imageByIndex.get(slide.slideIndex)?.assetRef || null,
    textLayers: slide.textLayers || [],
    logoLayer: slide.logoLayer || null,
    overlay: slide.overlay || null,
  }));

  return {
    figma: {
      fileName: 'Generated Instagram Carousel',
      pageName: 'Instagram Carousel',
      uploadedAssets: (step6Output?.images || [])
        .filter((image) => image.status === 'generated')
        .map((image) => ({ slideIndex: image.slideIndex, assetRef: image.assetRef })),
      frameSize: { w: format.width, h: format.height },
      frames,
      specsFrame: {
        visualTheme: step2Output?.visualTheme,
        colorStrategy: step2Output?.colorStrategy,
        brandColors: step4Output?.brand?.brandColors || [],
        toneOfVoice: step4Output?.brand?.toneOfVoice || [],
        caption: step5Output?.instagramCaption?.fullText || '',
      },
    },
    status: 'spec_only',
    notes: reason,
    fallbackUsed: true,
  };
}

export async function runStep8_FigmaAssembly(input) {
  const { step2Output, step3Output, step4Output, step5Output, step6Output, step7Output, carouselProfile, generationId, tenantId, accountId } = input;
  const format = resolveInstagramFormat(carouselProfile?.format || step7Output?.format);

  const systemPrompt = `You are a Figma production designer for iGEO.
Build a specification for assembling the carousel: upload visuals, overlay text, apply brand colors.
The spec will be used to call Figma MCP tools.

CRITICAL: Return valid JSON only (no markdown fences, no commentary outside the JSON).`;

  const userPrompt = `Inputs:
Step 2 visual direction: ${JSON.stringify(step2Output, null, 2)}
Step 3 templates: ${JSON.stringify(step3Output, null, 2)}
Step 4 design brief: ${JSON.stringify(step4Output, null, 2)}
Step 5 caption: ${JSON.stringify(step5Output, null, 2)}
Step 6 visuals: ${JSON.stringify(step6Output, null, 2)}
Step 7 text layouts: ${JSON.stringify(step7Output, null, 2)}
Account profile: ${JSON.stringify(carouselProfile, null, 2)}

Create Figma assembly specification: upload images, create frames, add text overlays, add logo.

Output shape:
{"figma":{"fileName":"","pageName":"Instagram Carousel","uploadedAssets":[{"slideIndex":1,"figmaImageHash":""}],"frameSize":{"w":${format.width},"h":${format.height}},"frames":[{"slideIndex":1,"frameName":"01","backgroundImageHash":"","textLayers":[{"layerId":"","content":"","position":{},"typography":{},"color":""}],"logoLayer":null,"overlay":null}],"specsFrame":{"visualTheme":"","colorStrategy":{},"brandColors":[],"toneOfVoice":[],"caption":"","sourcePrompt":""}},"status":"built|spec_only","notes":""}`;

  if (step7Output?.fallbackUsed) {
    return buildFallbackFigmaSpec(input, 'Used deterministic Figma spec because Step 7 used local fallback');
  }

  try {
    const response = await callClaude(systemPrompt, userPrompt, { 
      maxTokens: 16384,
      generationId,
      tenantId,
      accountId,
      step: 8,
      maxTransientRetries: 1,
    });
    return parseClaudeJSON(response);
  } catch (error) {
    console.warn(`[Claude] Step 8 unavailable; using local Figma spec fallback: ${error.message}`);
    return buildFallbackFigmaSpec(input, `Claude API unavailable: ${error.message}`);
  }
}

export async function runRenderedSlideQA({ pngBase64, slideIndex }) {
  if (!pngBase64 || pngBase64.length > 12_000_000) {
    throw new Error('Rendered preview is missing or too large');
  }
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: pngBase64,
          },
        },
        {
          type: 'text',
          text: `Review Instagram carousel slide ${slideIndex} at 1080x1350. Check only typography: clipping, overlap, hierarchy, contrast, and obstruction of the main subject. Return JSON only:
{"passed":true,"issues":[],"corrections":[{"layerId":"headline|body|label","fontScale":0.85,"color":"#RRGGBB"}],"panel":{"required":false,"color":"#FFFFFF","opacity":0.88}}
Corrections are bounded: fontScale must be 0.8-1, color must be black or white, and panel opacity 0.75-0.95. Never move text or change copy.`,
        },
      ],
    }],
  });
  const text = response.content.find((item) => item.type === 'text')?.text || '{}';
  const parsed = parseClaudeJSON(text);
  return {
    passed: Boolean(parsed.passed),
    issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 8) : [],
    corrections: (Array.isArray(parsed.corrections) ? parsed.corrections : [])
      .filter((item) => ['headline', 'body', 'label'].includes(item.layerId))
      .map((item) => ({
        layerId: item.layerId,
        fontScale: Math.min(1, Math.max(0.8, Number(item.fontScale) || 1)),
        color: /^#(?:000000|111111|FFFFFF)$/i.test(item.color || '')
          ? item.color.toUpperCase()
          : undefined,
      })),
    panel: parsed.panel?.required
      ? {
          required: true,
          color: /^#(?:000000|111111|FFFFFF)$/i.test(parsed.panel.color || '')
            ? parsed.panel.color.toUpperCase()
            : '#FFFFFF',
          opacity: Math.min(0.95, Math.max(0.75, Number(parsed.panel.opacity) || 0.88)),
        }
      : { required: false },
  };
}

/**
 * Run all steps sequentially with error handling
 */
export async function runAllSteps(input) {
  const results = {
    step1: null,
    step2: null,
    step3: null,
    step4: null,
    step5: null,
    step6: null, // Handled by imageGenerator.mjs
    step7: null,
    step8: null,
    errors: {},
  };

  try {
    console.log('[Claude] Running Step 1: Carousel Plan...');
    results.step1 = await runStep1_CarouselPlan(input);
  } catch (error) {
    results.errors.step1 = error.message;
    throw error;
  }

  try {
    console.log('[Claude] Running Step 2: Visual Style Direction...');
    results.step2 = await runStep2_VisualStyleDirection({
      step1Output: results.step1,
      brandColors: input.brandHub?.brandColors || [],
    });
  } catch (error) {
    results.errors.step2 = error.message;
    throw error;
  }

  try {
    console.log('[Claude] Running Step 3: Choose Templates...');
    results.step3 = await runStep3_ChooseTemplates({
      step1Output: results.step1,
      step2Output: results.step2,
      templates: input.templates,
    });
  } catch (error) {
    results.errors.step3 = error.message;
    throw error;
  }

  try {
    console.log('[Claude] Running Step 4: Apply BrandHub...');
    results.step4 = await runStep4_ApplyBrandHub({
      step1Output: results.step1,
      step2Output: results.step2,
      step3Output: results.step3,
      brandHub: input.brandHub,
      postText: input.postText,
    });
  } catch (error) {
    results.errors.step4 = error.message;
    throw error;
  }

  try {
    console.log('[Claude] Running Step 5: Format Caption...');
    results.step5 = await runStep5_FormatCaption({
      step4Output: results.step4,
    });
  } catch (error) {
    results.errors.step5 = error.message;
    throw error;
  }

  return results;
}
