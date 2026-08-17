/**
 * OpenAI Image Generator
 * Handles Step 6 of the Instagram carousel generation using OpenAI GPT Image 2 API
 * Generates VISUAL DESIGNS ONLY - NO TEXT
 * ENHANCED: Uses visual styles library and composition principles
 */

import OpenAI from 'openai';
import { logImageGeneration, createPromptHash } from './carouselLogger.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import {
  INSTAGRAM_POST_FORMAT,
  boundsToPercent,
  clampBoundsToFormat,
  resolveInstagramFormat,
} from './carouselFormat.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let openaiClient;
function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// Model for image generation - GPT Image 2
const IMAGE_MODEL = 'gpt-image-2'; // Updated to GPT Image 2
const IMAGE_QUALITY = 'high';

function contrastRatio(luminance, useWhite) {
  return useWhite
    ? 1.05 / (luminance + 0.05)
    : (luminance + 0.05) / 0.05;
}

function relativeLuminance(r, g, b) {
  const linearize = (value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

async function readImageBuffer(assetRef) {
  if (assetRef.startsWith('data:')) {
    return Buffer.from(assetRef.split(',')[1] || '', 'base64');
  }
  const response = await fetch(assetRef);
  if (!response.ok) throw new Error(`Unable to inspect generated image (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function scoreBrandColorContrast(brandColors, luminances) {
  // Test each brand color against the luminances
  const colorScores = [];
  
  for (const brandColor of brandColors) {
    const hex = brandColor.hex || brandColor;
    if (!hex || typeof hex !== 'string') continue;
    
    const rgb = hexToRgb(hex);
    const colorLuminance = relativeLuminance(rgb.r, rgb.g, rgb.b);
    
    // Calculate how many pixels have sufficient contrast with this color
    const coverage = luminances.filter((bgLuminance) => {
      const lighter = Math.max(colorLuminance, bgLuminance);
      const darker = Math.min(colorLuminance, bgLuminance);
      const contrast = (lighter + 0.05) / (darker + 0.05);
      return contrast >= 4.5;
    }).length / luminances.length;
    
    colorScores.push({
      hex: hex.toUpperCase(),
      coverage,
      luminance: colorLuminance,
      name: brandColor.name || null,
    });
  }
  
  // Also score black and white
  colorScores.push({
    hex: '#111111',
    coverage: luminances.filter((value) => contrastRatio(value, false) >= 4.5).length / luminances.length,
    luminance: relativeLuminance(17, 17, 17),
    name: 'black',
  });
  
  colorScores.push({
    hex: '#FFFFFF',
    coverage: luminances.filter((value) => contrastRatio(value, true) >= 4.5).length / luminances.length,
    luminance: relativeLuminance(255, 255, 255),
    name: 'white',
  });
  
  // Sort by coverage (higher is better)
  colorScores.sort((a, b) => b.coverage - a.coverage);
  
  return colorScores;
}

async function normalizeGeneratedImage(assetRef, format = INSTAGRAM_POST_FORMAT) {
  const normalized = await sharp(await readImageBuffer(assetRef))
    .resize(format.width, format.height, {
      fit: 'fill',
    })
    .png()
    .toBuffer();
  return `data:image/png;base64,${normalized.toString('base64')}`;
}

function evaluateTextPanelRegion(png, bounds, brandColors, format = INSTAGRAM_POST_FORMAT) {
  const scaleX = png.width / format.width;
  const scaleY = png.height / format.height;
  const region = {
    x: Math.round(bounds.x * scaleX),
    y: Math.round(bounds.y * scaleY),
    width: Math.round(bounds.width * scaleX),
    height: Math.round(bounds.height * scaleY),
  };
  const luminances = [];
  let edgeEnergy = 0;
  let edgeCount = 0;
  const step = Math.max(3, Math.floor(png.width / 220));
  let previousRow = null;
  for (let y = region.y; y < region.y + region.height; y += step) {
    let previous = null;
    const row = [];
    for (let x = region.x; x < region.x + region.width; x += step) {
      const index = (y * png.width + x) * 4;
      const value = relativeLuminance(
        png.data[index],
        png.data[index + 1],
        png.data[index + 2],
      );
      luminances.push(value);
      row.push(value);
      if (previous !== null) {
        edgeEnergy += Math.abs(value - previous);
        edgeCount += 1;
      }
      previous = value;
    }
    if (previousRow) {
      for (let index = 0; index < Math.min(row.length, previousRow.length); index += 1) {
        edgeEnergy += Math.abs(row[index] - previousRow[index]);
        edgeCount += 1;
      }
    }
    previousRow = row;
  }
  if (!luminances.length) return null;
  const mean = luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
  const variance = luminances.reduce((sum, value) => sum + (value - mean) ** 2, 0) / luminances.length;
  const edgeDensity = edgeCount ? edgeEnergy / edgeCount : 0;
  const colorScores = scoreBrandColorContrast(brandColors || [], luminances);
  const bestColor = colorScores[0];
  const score = bestColor.coverage * 5 - Math.sqrt(variance) * 3.5 - edgeDensity * 8;
  return {
    bounds,
    score,
    meanLuminance: mean,
    variance,
    edgeDensity,
    recommendedTextColor: bestColor.hex,
    contrastCoverage: bestColor.coverage,
    colorOptions: colorScores.slice(0, 3),
  };
}

export function resolveGeneratedTextBlock(png, plannedBounds, brandColors = [], formatInput = INSTAGRAM_POST_FORMAT) {
  const format = resolveInstagramFormat(formatInput);
  const planned = clampBoundsToFormat(plannedBounds, 0, format);
  const candidates = [];
  const scales = [1, 0.9, 0.8];
  for (const scale of scales) {
    const width = Math.max(480, Math.round(planned.width * scale));
    const height = Math.max(400, Math.round(planned.height * scale));
    const maxX = format.width - format.margins.right - width;
    const maxY = format.height - format.margins.bottom - height;
    const xStep = Math.max(36, Math.round((maxX - format.margins.left) / 8));
    const yStep = Math.max(45, Math.round((maxY - format.margins.top) / 10));
    for (let y = format.margins.top; y <= maxY; y += yStep) {
      for (let x = format.margins.left; x <= maxX; x += xStep) {
        candidates.push({ x, y, width, height });
      }
    }
    candidates.push({ x: maxX, y: maxY, width, height });
  }
  candidates.push(planned);
  const scored = candidates
    .map((bounds) => evaluateTextPanelRegion(png, bounds, brandColors, format))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  const plannedResult = evaluateTextPanelRegion(png, planned, brandColors, format);
  const best = scored[0] || plannedResult;
  if (!best) throw new Error('Unable to evaluate generated text panels');
  const suitable = best.contrastCoverage >= 0.82
    && best.edgeDensity <= 0.055
    && best.variance <= 0.075;
  const useDetected = suitable && (
    !plannedResult
    || best.score > plannedResult.score + 0.12
    || plannedResult.contrastCoverage < 0.82
    || plannedResult.edgeDensity > 0.055
  );
  const selected = useDetected ? best : plannedResult || best;
  const confidence = Math.max(0, Math.min(1, (
    selected.contrastCoverage
    - selected.edgeDensity * 2
    - Math.sqrt(selected.variance)
  )));
  return {
    ...selected,
    source: useDetected ? 'detected-generated-panel' : 'planned-region',
    confidence: Number(confidence.toFixed(3)),
    suitable: selected.contrastCoverage >= 0.82
      && selected.edgeDensity <= 0.055
      && selected.variance <= 0.075,
  };
}

/**
 * Inspect only the preplanned protected text block. Pixel QA may choose a
 * color, resolve the whole block to a better generated panel, or request an
 * editable backing panel. Individual text layers are never moved separately.
 */
async function analyzeGeneratedTextZone(assetRef, slideVisual, brandColors, format) {
  const png = PNG.sync.read(await readImageBuffer(assetRef));
  const plannedBounds = clampBoundsToFormat(
    slideVisual.textBlueprint?.protectedBounds || slideVisual.textZoneBounds,
    0,
    format,
  );
  const resolved = resolveGeneratedTextBlock(png, plannedBounds, brandColors, format);
  const panelRequired = !resolved.suitable;
  const isBrandColor = !['#111111', '#FFFFFF'].includes(resolved.recommendedTextColor);
  const zone = {
    priority: 'protected',
    suggestedFor: 'textBlock',
    bounds: resolved.bounds,
    recommendedTextColor: resolved.recommendedTextColor,
    textZoneTone: resolved.recommendedTextColor === '#FFFFFF' ? 'dark' : 'light',
    contrastCoverage: Number(resolved.contrastCoverage.toFixed(3)),
    meanLuminance: Number(resolved.meanLuminance.toFixed(3)),
    edgeDensity: Number(resolved.edgeDensity.toFixed(3)),
    isBrandColor,
    colorOptions: resolved.colorOptions,
  };
  return {
    textZoneTone: zone.textZoneTone,
    recommendedTextColor: zone.recommendedTextColor,
    textZoneBounds: resolved.bounds,
    resolvedTextBlock: {
      plannedBounds,
      bounds: resolved.bounds,
      source: resolved.source,
      confidence: resolved.confidence,
      recommendedTextColor: zone.recommendedTextColor,
    },
    zones: [zone],
    panelRequired,
    panelRecommendation: panelRequired
      ? {
          color: zone.textZoneTone === 'dark' ? '#111111' : '#FFFFFF',
          opacity: 0.88,
          cornerRadius: 32,
        }
      : null,
    visualQualityCheck: {
      source: 'protected-region-analysis',
      passed: !panelRequired,
      contrastCoverage: zone.contrastCoverage,
      meanLuminance: zone.meanLuminance,
      edgeDensity: zone.edgeDensity,
      variance: Number(resolved.variance.toFixed(3)),
      replacedPlannedZone: resolved.source !== 'planned-region',
      plannedZone: plannedBounds,
      selectedColor: zone.recommendedTextColor,
      isBrandColor,
      colorOptions: zone.colorOptions,
      panelRequired,
    },
  };
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
 * Load composition principles
 */
async function loadCompositionPrinciples() {
  const principlesPath = join(__dirname, '../data/composition-principles.json');
  const content = await readFile(principlesPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Create visual prompt from Step 2 visual direction
 * ENHANCED: Uses style-specific prompt templates and composition principles
 */
async function createVisualPrompt(slideVisual, visualStylesLibrary, compositionPrinciples, visualDirection, carouselProfile) {
  // Step 2 has already created a complete, validated, BrandHub-aware prompt
  // We enhance it with style-specific guidance and composition principles
  
  if (!slideVisual.imagePrompt) {
    throw new Error(`Slide ${slideVisual.slideIndex} has no imagePrompt. This should have been validated in Step 2.`);
  }

  const palette = [
    visualDirection?.colorStrategy?.primary,
    visualDirection?.colorStrategy?.secondary,
    visualDirection?.colorStrategy?.accent,
    ...(visualDirection?.colorStrategy?.socialNativePalette || []),
  ].filter(Boolean);

  let prompt = slideVisual.imagePrompt;
  
  // Anchor generation in the selected library template. Claude's creative
  // brief adds content meaning, but cannot silently drift to another style.
  if (slideVisual.selectedStyleId && visualStylesLibrary) {
    const style = visualStylesLibrary.find(s => s.id === slideVisual.selectedStyleId);
    if (!style) {
      throw new Error(`Unknown visual style "${slideVisual.selectedStyleId}" for slide ${slideVisual.slideIndex}`);
    }
    if (style.promptTemplate) {
      const stylePrompt = style.promptTemplate
        .replaceAll('{colors}', palette.join(', ') || 'the supplied brand palette')
        .replaceAll('{color1}', palette[0] || 'the primary brand color')
        .replaceAll('{color2}', palette[1] || 'the secondary brand color')
        .replaceAll('{composition}', slideVisual.composition || 'asymmetric editorial')
        .replaceAll('{textZone}', slideVisual.negativeSpaceZones || 'top-third')
        .replaceAll('{subject}', 'the slide concept described in the creative brief');
      prompt = `${stylePrompt} Creative brief: ${slideVisual.imagePrompt}`;
    }
    if (style?.technicalNotes) {
      const { avoidElements } = style.technicalNotes;
      if (avoidElements && avoidElements.length > 0) {
        prompt += ` Avoid: ${avoidElements.join(', ')}.`;
      }
    }
  }

  if (visualDirection?.continuityKey) {
    prompt += ` Carousel continuity system: ${JSON.stringify(visualDirection.continuityKey)}.`;
  }

  const format = resolveInstagramFormat(carouselProfile?.format);
  const protectedBounds = clampBoundsToFormat(
    slideVisual.textBlueprint?.protectedBounds || slideVisual.textZoneBounds,
    0,
    format,
  );
  const protectedPercent = boundsToPercent(protectedBounds, format);
  if (carouselProfile?.imagePolicy?.protectedTextPanel === false) {
    prompt += ` This artwork will receive editable typography and a brand scrim after generation. Compose the main architectural subject outside ${JSON.stringify(protectedPercent)} percent of the final ${format.width}x${format.height} canvas, but keep the photograph naturally full-bleed. Do not draw a text panel, card, frame, or typography into the image.`;
  } else {
    prompt += ` This artwork will receive editable Figma typography after generation. Reserve one coherent protected text block at exactly ${JSON.stringify(protectedPercent)} percent of the final ${format.width}x${format.height} canvas (x, y, width, height). Inside that entire rectangle use one visually uniform quiet field or designed panel with stable luminance. Keep faces, buildings, devices, focal objects, borders, panel seams, and high-frequency detail completely outside it. Do not split this protected block into separate regions.`;
  }
  
  // Add composition principles emphasis
  if (
    compositionPrinciples?.negativeSpacePhilosophy &&
    carouselProfile?.imagePolicy?.protectedTextPanel !== false
  ) {
    const { minimum, ideal } = compositionPrinciples.negativeSpacePhilosophy.requirements;
    prompt += ` Text-safe area requirement: ${ideal || minimum} of frame must be suitable for text overlay, but it must remain visually designed using a solid colored panel, soft texture, restrained contour detail, or framed negative space. Never leave a blank white page.`;
  }

  if (carouselProfile?.imagePolicy?.mode === 'all-slides-photography') {
    prompt += ` Make the composition feel like premium architectural editorial photography: believable materials and lighting, authentic Cyprus context, refined framing, and a consistent luxury real-estate campaign. Avoid generic abstract art, blobs, floating 3D objects, decorative gradients, cut-paper forms, and stock icons.`;
  } else {
    prompt += ` Make the composition feel art-directed and deliberately assembled: use a coherent grid, 2-4 substantial visual forms, repeated rounded geometry or organic curves, varied scale, controlled overlap, and one recurring motif. Avoid random decoration, generic isolated icons, a plain gradient by itself, or a mostly empty field. The slide must remain visually interesting even before text is added.`;
  }
    prompt += ` Any visible phone, tablet, laptop, paper, sign, or display must contain meaningful non-text visual content connected to the concept—such as a floor-plan preview, image thumbnail, map geometry, message bubbles, or UI cards. Never leave a device screen or document blank, and do not render readable words inside the generated image.`;
  
  // Append technical constraints for OpenAI API
  prompt += ` Technical requirements: ${format.aspectRatio} composition, high resolution, professional Instagram carousel quality, normalized to ${format.width}x${format.height} final output.`;
  
  // CRITICAL: Reinforce NO TEXT instruction as a safety measure (triple emphasis)
  prompt += ` CRITICAL: Absolutely no text, words, letters, numbers, symbols, or any readable characters in the image. NO TEXT ANYWHERE. This is a background visual only.`;

  return prompt;
}

/**
 * Generate a single carousel visual
 * ENHANCED: Uses style-specific settings and composition validation
 */
async function generateSingleVisual(slideVisual, slideIndex, generationId, tenantId, accountId, visualStylesLibrary, compositionPrinciples, visualDirection, brandColors, carouselProfile) {
  const slideStartTime = Date.now();
  try {
    console.log(`[OpenAI GPT Image 2] Generating visual for slide ${slideIndex}...`);

    // Use the pre-validated prompt from Step 2, enhanced with composition principles
    const enhancedPrompt = await createVisualPrompt(
      slideVisual,
      visualStylesLibrary,
      compositionPrinciples,
      visualDirection,
      carouselProfile,
    );
    const format = resolveInstagramFormat(carouselProfile?.format);
    const imageSize = format.imageApiSize;
    const promptHash = createPromptHash(enhancedPrompt);

    let imageData = null;
    let assetRef = null;
    let actualTextZone = null;
    let generationPrompt = enhancedPrompt;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await getOpenAIClient().images.generate({
        model: IMAGE_MODEL,
        prompt: generationPrompt,
        n: 1,
        size: imageSize,
        quality: IMAGE_QUALITY,
      });
      if (!response.data || response.data.length === 0) {
        throw new Error('No image returned from OpenAI');
      }
      imageData = response.data[0];
      const rawAssetRef = imageData.b64_json
        ? `data:image/png;base64,${imageData.b64_json}`
        : imageData.url || null;
      if (!rawAssetRef) throw new Error('OpenAI returned no image url or b64_json');
      assetRef = await normalizeGeneratedImage(rawAssetRef, format);
      if (carouselProfile?.readability?.mode === 'profile-scrim') {
        const plannedBounds = clampBoundsToFormat(
          slideVisual.textBlueprint?.protectedBounds || slideVisual.textZoneBounds,
          0,
          format,
        );
        actualTextZone = {
          textZoneTone: 'dark',
          recommendedTextColor: carouselProfile.palette?.accent || '#FFFFFF',
          textZoneBounds: plannedBounds,
          resolvedTextBlock: {
            plannedBounds,
            bounds: plannedBounds,
            source: 'profile-scrim',
            confidence: 1,
            recommendedTextColor: carouselProfile.palette?.accent || '#FFFFFF',
          },
          zones: [],
          panelRequired: false,
          panelRecommendation: null,
          visualQualityCheck: {
            source: 'profile-scrim',
            passed: true,
            contrastCoverage: 1,
            panelRequired: false,
            isBrandColor: true,
          },
        };
      } else {
        actualTextZone = await analyzeGeneratedTextZone(assetRef, slideVisual, brandColors, format);
      }
      if (!actualTextZone.panelRequired || attempt === 1) break;
      generationPrompt = `${enhancedPrompt} RETRY CORRECTION: The protected text block was too detailed or had unstable contrast. Render that exact rectangle as one uninterrupted, nearly uniform designed panel. No image edges, outlines, objects, or panel seams may enter it.`;
      console.warn(`[Visual QA] Slide ${slideIndex}: retrying background to protect editable text block`);
    }
    const colorLabel = actualTextZone.visualQualityCheck.isBrandColor
      ? 'brand color'
      : actualTextZone.recommendedTextColor;
    console.log(
      `[Visual QA] Slide ${slideIndex}: ${colorLabel}, ` +
      `${Math.round(actualTextZone.visualQualityCheck.contrastCoverage * 100)}% contrast coverage, ` +
      `panel fallback ${actualTextZone.panelRequired ? 'required' : 'not required'}`,
    );
    
    const slideDuration = Date.now() - slideStartTime;
    const bytesGenerated = assetRef.startsWith('data:') 
      ? Buffer.from(assetRef.split(',')[1] || '', 'base64').length 
      : null;

    logImageGeneration({
      generationId,
      tenantId,
      accountId,
      slideIndex,
      promptHash,
      promptSummary: slideVisual.imagePrompt?.substring(0, 150),
      model: IMAGE_MODEL,
      quality: IMAGE_QUALITY,
      size: imageSize,
      durationMs: slideDuration,
      bytesGenerated,
      persistedPath: null, // Will be set by persistStep6Images
      error: null,
    });
    
    return {
      slideIndex,
      selectedStyleId: slideVisual.selectedStyleId,
      visualPrompt: slideVisual.imagePrompt,
      enhancedPrompt,
      assetRef,
      revisedPrompt: imageData.revised_prompt || enhancedPrompt,
      status: 'generated',
      composition: slideVisual.composition,
      negativeSpaceZones: slideVisual.negativeSpaceZones,
      textBlueprint: slideVisual.textBlueprint,
      format,
      ...actualTextZone,
    };
  } catch (error) {
    const slideDuration = Date.now() - slideStartTime;
    logImageGeneration({
      generationId,
      tenantId,
      accountId,
      slideIndex,
      promptHash: null,
      promptSummary: slideVisual.imagePrompt?.substring(0, 150),
      model: IMAGE_MODEL,
      quality: IMAGE_QUALITY,
      size: resolveInstagramFormat(carouselProfile?.format).imageApiSize,
      durationMs: slideDuration,
      bytesGenerated: null,
      persistedPath: null,
      error,
    });
    console.error(`[OpenAI GPT Image 2] Error generating visual for slide ${slideIndex}:`, error);
    return {
      slideIndex,
      selectedStyleId: slideVisual.selectedStyleId,
      visualPrompt: slideVisual.imagePrompt,
      enhancedPrompt: null,
      assetRef: null,
      revisedPrompt: null,
      status: 'failed',
      composition: slideVisual.composition,
      negativeSpaceZones: slideVisual.negativeSpaceZones,
      textZoneTone: slideVisual.textZoneTone,
      textZoneBounds: slideVisual.textZoneBounds,
      error: error.message,
    };
  }
}

/**
 * Generate carousel visuals for Step 6
 * ENHANCED: Uses Step 2's pre-validated imagePrompts with style library support
 */
export async function generateCarouselImages(
  step2VisualDirection,
  step4Output,
  textLayout,
  generationId,
  tenantId,
  accountId,
  carouselProfile,
) {
  const { perSlideVisuals, selectedStyleIds } = step2VisualDirection;
  const { brand } = step4Output;
  const format = resolveInstagramFormat(carouselProfile?.format || textLayout?.format);
  const imageSize = format.imageApiSize;
  
  // Load visual styles library and composition principles
  const visualStylesLibrary = await loadVisualStylesLibrary();
  const compositionPrinciples = await loadCompositionPrinciples();
  
  // Extract brand colors for text contrast analysis
  const brandColors = brand?.brandColors || [];
  
  console.log(`[OpenAI GPT Image 2] Processing ${perSlideVisuals.length} slides with styles:`, selectedStyleIds || 'default');

  // Check if skipPostImages is enabled
  if (brand?.skipPostImages) {
    console.log('[OpenAI GPT Image 2] skipPostImages enabled, skipping all visual generation');
    return {
      imageModel: IMAGE_MODEL,
      apiEndpoint: 'https://api.openai.com/v1/images/generations',
      sourceImageSize: imageSize,
      format,
      quality: IMAGE_QUALITY,
      visualTheme: step2VisualDirection.visualTheme,
      selectedStyles: selectedStyleIds,
      images: perSlideVisuals.map((slideVisual) => ({
        slideIndex: slideVisual.slideIndex,
        selectedStyleId: slideVisual.selectedStyleId,
        visualPrompt: null,
        enhancedPrompt: null,
        assetRef: null,
        revisedPrompt: null,
        status: 'skipped',
        notes: 'skipPostImages enabled in BrandHub',
      })),
    };
  }

  // Every slide receives visual art. Supporting slides use designed abstract
  // backgrounds with reserved text zones instead of empty white canvases.
  const slidesToGenerate = perSlideVisuals.filter((slide) => Boolean(slide.imagePrompt));
  console.log(`[OpenAI GPT Image 2] Generating designed visuals for ${slidesToGenerate.length}/${perSlideVisuals.length} slides`);

  const images = [];

  const blueprintByIndex = new Map(
    (textLayout?.slides || []).map((slide) => [slide.slideIndex, slide]),
  );
  for (const originalSlideVisual of perSlideVisuals) {
    const blueprintSlide = blueprintByIndex.get(originalSlideVisual.slideIndex);
    const slideVisual = {
      ...originalSlideVisual,
      textBlueprint: blueprintSlide?.textBlock || null,
      textZoneBounds: blueprintSlide?.textBlock?.protectedBounds || originalSlideVisual.textZoneBounds,
    };
    if (!slideVisual.imagePrompt) {
      images.push({
        slideIndex: slideVisual.slideIndex,
        selectedStyleId: slideVisual.selectedStyleId,
        visualPrompt: null,
        enhancedPrompt: null,
        assetRef: null,
        revisedPrompt: null,
        status: 'failed',
        layoutArchetype: slideVisual.layoutArchetype,
        error: 'Missing imagePrompt: every slide requires a designed visual background',
      });
      continue;
    }

    // Generate the visual with style library support.
    const result = await generateSingleVisual(
      slideVisual,
      slideVisual.slideIndex,
      generationId,
      tenantId,
      accountId,
      visualStylesLibrary,
      compositionPrinciples,
      step2VisualDirection,
      brandColors,
      carouselProfile,
    );
    
    images.push(result);

    // Add small delay between requests to avoid rate limiting
    if (slideVisual.slideIndex < perSlideVisuals.length) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  const failedImages = images.filter(img => img.status === 'failed');
  if (failedImages.length > 0) {
    console.error(`[OpenAI GPT Image 2] ${failedImages.length} visuals failed to generate`);
  }

  const successCount = images.filter(img => img.status === 'generated').length;
  console.log(`[OpenAI GPT Image 2] Successfully generated ${successCount}/${perSlideVisuals.length} designed visuals (NO TEXT)`);

  // A missing slide image would become a blank Figma frame, so partial output
  // is not acceptable.
  if (successCount !== perSlideVisuals.length) {
    const firstError = failedImages[0]?.error || 'unknown error';
    throw new Error(`GPT Image 2 produced ${successCount}/${perSlideVisuals.length} slide visuals: ${firstError}`);
  }

  return {
    imageModel: IMAGE_MODEL,
    apiEndpoint: 'https://api.openai.com/v1/images/generations',
    sourceImageSize: imageSize,
    format,
    quality: IMAGE_QUALITY,
    visualTheme: step2VisualDirection.visualTheme,
    colorStrategy: step2VisualDirection.colorStrategy,
    continuityKey: step2VisualDirection.continuityKey,
    selectedStyles: selectedStyleIds,
    compositionPrinciplesApplied: true,
    images,
  };
}

/**
 * Download and save image locally (for Figma upload in Step 8)
 */
export async function downloadImage(imageUrl, outputPath) {
  try {
    const { writeFile } = await import('node:fs/promises');

    if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
      const comma = imageUrl.indexOf(',');
      const b64 = comma >= 0 ? imageUrl.slice(comma + 1) : imageUrl;
      await writeFile(outputPath, Buffer.from(b64, 'base64'));
      console.log(`[OpenAI GPT Image 2] Image written to ${outputPath}`);
      return outputPath;
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await writeFile(outputPath, Buffer.from(buffer));
    
    console.log(`[OpenAI GPT Image 2] Image downloaded to ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('[OpenAI GPT Image 2] Error downloading image:', error);
    throw error;
  }
}

/**
 * Batch download all generated visuals
 */
export async function downloadAllImages(images, outputDir) {
  const { mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');

  // Create output directory if it doesn't exist
  await mkdir(outputDir, { recursive: true });

  const downloads = [];
  for (const image of images) {
    if (image.status === 'generated' && image.assetRef) {
      const filename = `slide_${String(image.slideIndex).padStart(2, '0')}.png`;
      const outputPath = join(outputDir, filename);
      
      try {
        await downloadImage(image.assetRef, outputPath);
        downloads.push({ 
          slideIndex: image.slideIndex, 
          path: outputPath,
          negativeSpaceZones: image.negativeSpaceZones,
        });
      } catch (error) {
        console.error(`Failed to download slide ${image.slideIndex}:`, error.message);
      }
    }
  }

  return downloads;
}

/**
 * Validate that generated images have no text
 * Returns a report of any concerns
 */
export function validateNoTextInImages(images) {
  const validation = {
    allValid: true,
    concerns: [],
    totalImages: images.length,
    generatedImages: images.filter(img => img.status === 'generated').length,
  };

  images.forEach(image => {
    if (image.status === 'generated') {
      // Check if revised prompt mentions text (warning sign)
      if (image.revisedPrompt && /text|word|letter|font|typography/i.test(image.revisedPrompt)) {
        validation.allValid = false;
        validation.concerns.push({
          slideIndex: image.slideIndex,
          issue: 'Revised prompt mentions text-related terms',
          revisedPrompt: image.revisedPrompt,
        });
      }
    }
  });

  return validation;
}
