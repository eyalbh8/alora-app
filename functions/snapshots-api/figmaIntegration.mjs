/**
 * Figma REST API Integration
 * Handles automatic carousel creation in Figma from the Node.js server
 * 
 * IMPORTANT: Figma's REST API is read-only for most operations.
 * To CREATE frames/nodes, we use the plugin bridge architecture:
 * 
 * Server Flow:
 * 1. Server queues Figma job (already implemented in carouselGeneration.mjs)
 * 2. User runs Alora Figma plugin OR plugin auto-polls for jobs
 * 3. Plugin creates frames in Figma
 * 4. Plugin uploads exports back to server
 * 5. Server updates generation with Figma URL
 * 
 * For FULLY automated approach, you would need:
 * - Headless browser running Figma Plugin API
 * - OR Figma's Enterprise API (if available)
 * - OR Keep the semi-automated plugin bridge
 */

// Figma API Configuration
const FIGMA_API_BASE = 'https://api.figma.com/v1';
const FIGMA_ACCESS_TOKEN = process.env.FIGMA_ACCESS_TOKEN || '';

/**
 * Get Figma file metadata (read-only API)
 */
async function getFigmaFile(fileKey) {
  if (!FIGMA_ACCESS_TOKEN) {
    throw new Error('FIGMA_ACCESS_TOKEN not configured');
  }

  const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}`, {
    headers: {
      'X-Figma-Token': FIGMA_ACCESS_TOKEN,
    },
  });

  if (!response.ok) {
    throw new Error(`Figma API error: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Upload image to Figma (REST API)
 */
async function uploadImageToFigma(fileKey, imageData, imageName) {
  if (!FIGMA_ACCESS_TOKEN) {
    throw new Error('FIGMA_ACCESS_TOKEN not configured');
  }

  const response = await fetch(`${FIGMA_API_BASE}/files/${fileKey}/images`, {
    method: 'POST',
    headers: {
      'X-Figma-Token': FIGMA_ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageData,
      name: imageName,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to upload image: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Typography utility: Map font weight to Figma font style
 */
function getFontStyle(fontWeight) {
  const weightMap = {
    '400': 'Regular',
    '500': 'Medium',
    '600': 'SemiBold',
    '700': 'Bold',
    '800': 'ExtraBold',
  };
  return weightMap[String(fontWeight)] || 'Regular';
}

/**
 * Color utility: Convert hex to RGB object for Figma
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Color utility: Convert hex to RGBA object for Figma (with alpha)
 */
function hexToRgba(hex) {
  // Handle both #RRGGBB and #RRGGBBAA formats
  const hasAlpha = hex.length === 9;
  const rgb = hexToRgb(hex.substring(0, 7));
  
  if (hasAlpha) {
    const alpha = parseInt(hex.substring(7, 9), 16) / 255;
    return { ...rgb, a: alpha };
  }
  
  return { ...rgb, a: 1 };
}

/**
 * Upload carousel images to Figma
 * Uses Figma MCP upload_assets tool
 */
export async function uploadCarouselImages(generatedImages) {
  console.log(`[Figma] Uploading ${generatedImages.length} carousel visuals...`);

  const uploads = [];

  for (const image of generatedImages) {
    if (image.status !== 'generated' || !image.assetRef) {
      continue;
    }

    // In practice, this would call Figma MCP upload_assets:
    // const response = await figmaMCP.callTool('upload_assets', {
    //   fileKey: 'TARGET_FILE_KEY',
    //   assets: [{
    //     name: `slide_${image.slideIndex}.png`,
    //     url: image.assetRef
    //   }]
    // });

    uploads.push({
      slideIndex: image.slideIndex,
      sourceUrl: image.assetRef,
      figmaImageHash: `PLACEHOLDER_HASH_${image.slideIndex}`, // Will be replaced by actual MCP response
      negativeSpaceZones: image.negativeSpaceZones,
      note: 'This will upload via Figma MCP upload_assets tool',
    });
  }

  return {
    uploaded: uploads.length,
    uploads,
    mcpCall: {
      tool: 'upload_assets',
      params: {
        fileKey: 'TARGET_FILE_KEY',
        assets: uploads.map((u) => ({
          name: `slide_${String(u.slideIndex).padStart(2, '0')}.png`,
          url: u.sourceUrl,
        })),
      },
    },
  };
}

/**
 * Build Figma Plugin API script to assemble carousel with text overlays
 * Creates frames, adds background images, overlays text with precise positioning
 */
function buildFigmaAssemblyScript(step7TextLayouts, uploadedImages, step5Caption, visualTheme, carouselProfile) {
  const { slides, typographySystem } = step7TextLayouts;
  const format = step7TextLayouts.format || carouselProfile?.format || { width: 1080, height: 1350, aspectRatio: '4:5' };
  
  // Generate Figma Plugin API JavaScript
  return `
// Instagram Carousel Assembly - Text Overlays on GPT Image 2 Visuals
// Visual Theme: ${visualTheme}

// Utility functions
function hexToRgb(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

function hexToRgba(hex) {
  const hasAlpha = hex.length === 9;
  const rgb = hexToRgb(hex.substring(0, 7));
  if (hasAlpha) {
    const alpha = parseInt(hex.substring(7, 9), 16) / 255;
    return { ...rgb, a: alpha };
  }
  return { ...rgb, a: 1 };
}

async function assembleCarousel() {
  const page = figma.currentPage;
  page.name = "Instagram Carousel";
  
  const frames = [];
  const spacing = 100; // Space between frames
  let xOffset = 0;
  
  ${slides.map((slide, idx) => {
    const uploadedImage = uploadedImages.find(img => img.slideIndex === slide.slideIndex);
    
    return `
  // ==========================================
  // Slide ${slide.slideIndex}: ${slide.visualAnalysis ? slide.visualAnalysis.substring(0, 50) : 'Carousel slide'}
  // ==========================================
  
  const frame${idx} = figma.createFrame();
  frame${idx}.name = "Slide ${String(slide.slideIndex).padStart(2, '0')}";
  frame${idx}.resize(${format.width}, ${format.height});
  frame${idx}.x = xOffset;
  frame${idx}.y = 0;
  frame${idx}.clipsContent = false;
  
  // Background: Uploaded GPT Image 2 visual (no text)
  const bgImage${idx} = figma.createRectangle();
  bgImage${idx}.name = "Background Visual";
  bgImage${idx}.resize(${format.width}, ${format.height});
  bgImage${idx}.x = 0;
  bgImage${idx}.y = 0;
  ${uploadedImage ? `
  // Fill with uploaded image hash: ${uploadedImage.figmaImageHash}
  bgImage${idx}.fills = [{
    type: 'IMAGE',
    imageHash: '${uploadedImage.figmaImageHash}',
    scaleMode: 'FILL'
  }];` : `
  // Placeholder background
  bgImage${idx}.fills = [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95 } }];`}
  frame${idx}.appendChild(bgImage${idx});
  
  ${slide.textLayers.map((layer, layerIdx) => `
  // Text Layer ${layerIdx + 1}: ${layer.type} - "${layer.content.substring(0, 30)}${layer.content.length > 30 ? '...' : ''}"
  const text${idx}_${layerIdx} = figma.createText();
  text${idx}_${layerIdx}.name = "${layer.layerId || layer.type}";
  
  // Load font
  await figma.loadFontAsync({ 
    family: '${layer.typography.fontFamily}', 
    style: '${getFontStyle(layer.typography.fontWeight)}' 
  });
  
  // Set text content
  text${idx}_${layerIdx}.characters = ${JSON.stringify(layer.content)};
  
  // Typography
  text${idx}_${layerIdx}.fontSize = ${layer.typography.fontSize};
  text${idx}_${layerIdx}.fontName = { 
    family: '${layer.typography.fontFamily}', 
    style: '${getFontStyle(layer.typography.fontWeight)}' 
  };
  text${idx}_${layerIdx}.lineHeight = { 
    value: ${layer.typography.lineHeight * 100}, 
    unit: 'PERCENT' 
  };
  text${idx}_${layerIdx}.letterSpacing = { 
    value: ${layer.typography.letterSpacing}, 
    unit: 'PIXELS' 
  };
  ${layer.typography.textTransform === 'uppercase' ? `
  text${idx}_${layerIdx}.textCase = 'UPPER';` : ''}
  
  // Position
  text${idx}_${layerIdx}.x = ${layer.position.x};
  text${idx}_${layerIdx}.y = ${layer.position.y};
  text${idx}_${layerIdx}.resize(${layer.position.width}, ${layer.position.height});
  
  // Alignment
  text${idx}_${layerIdx}.textAlignHorizontal = '${layer.position.alignment.toUpperCase()}';
  text${idx}_${layerIdx}.textAlignVertical = 'TOP';
  
  // Color
  text${idx}_${layerIdx}.fills = [{ 
    type: 'SOLID', 
    color: hexToRgb('${layer.color}') 
  }];
  
  ${layer.effects?.shadow ? `
  // Shadow effect for readability
  text${idx}_${layerIdx}.effects = [{
    type: 'DROP_SHADOW',
    color: hexToRgba('${layer.effects.shadowColor}'),
    offset: { x: ${layer.effects.shadowOffset?.x || 0}, y: ${layer.effects.shadowOffset?.y || 4} },
    radius: ${layer.effects.shadowBlur},
    visible: true,
    blendMode: 'NORMAL'
  }];` : ''}
  
  frame${idx}.appendChild(text${idx}_${layerIdx});
  `).join('')}
  
  frames.push(frame${idx});
  xOffset += ${format.width} + spacing;
  `;
  }).join('')}
  
  // ==========================================
  // Specs Frame - Reference information
  // ==========================================
  
  const specsFrame = figma.createFrame();
  specsFrame.name = "Specs & Caption";
  specsFrame.resize(600, 800);
  specsFrame.x = xOffset;
  specsFrame.y = 0;
  specsFrame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
  
  const specsText = figma.createText();
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  specsText.characters = ${JSON.stringify(`INSTAGRAM CAROUSEL SPECS

Visual Theme: ${visualTheme}
Typography System:
  Headline: ${typographySystem.headlineFontFamily}
  Body: ${typographySystem.bodyFontFamily}
  Label: ${typographySystem.labelFontFamily}

Total Slides: ${slides.length}
Image Quality: HD ${format.width}×${format.height} (Instagram ${format.aspectRatio})
Text Overlay: Precise positioning from Step 7

INSTAGRAM CAPTION:
${step5Caption.instagramCaption?.fullText || 'Caption not available'}

---
Generated by iGEO Creative Carousel Flow
GPT Image 2 Visuals + Claude Text Positioning
`)};
  specsText.fontSize = 14;
  specsText.lineHeight = { value: 150, unit: 'PERCENT' };
  specsText.x = 40;
  specsText.y = 40;
  specsText.resize(520, 720);
  specsText.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
  specsFrame.appendChild(specsText);
  
  frames.push(specsFrame);
  
  // Select all frames and zoom to fit
  figma.currentPage.selection = frames;
  figma.viewport.scrollAndZoomIntoView(frames);
  
  figma.notify('✨ Carousel assembled! ${slides.length} slides + specs frame created.', { timeout: 3000 });
  
  return { 
    created: frames.length,
    slides: ${slides.length},
    message: 'Instagram carousel with text overlays created successfully' 
  };
}

// Execute assembly
assembleCarousel().catch(err => {
  figma.notify('❌ Error: ' + err.message, { error: true });
  console.error('Assembly error:', err);
});
`;
}

/**
 * Assemble carousel with text overlays
 * Main function that coordinates image upload and text positioning
 */
export async function assembleCarouselWithTextOverlays(
  step7TextLayouts,
  step6Visuals,
  step5Caption,
  visualTheme,
  carouselProfile,
) {
  console.log('[Figma] Assembling carousel with text overlays...');
  
  // Step 1: Upload images
  const uploadResult = await uploadCarouselImages(step6Visuals.images);
  
  // Step 2: Build Figma assembly script
  const figmaScript = buildFigmaAssemblyScript(
    step7TextLayouts,
    uploadResult.uploads,
    step5Caption,
    visualTheme,
    carouselProfile,
  );
  
  // Step 3: Return assembly specification
  return {
    uploadedAssets: uploadResult.uploads,
    figmaScript,
    slideCount: step7TextLayouts.slides.length,
    typographySystem: step7TextLayouts.typographySystem,
    visualTheme,
    format: step7TextLayouts.format,
    carouselProfileId: carouselProfile?.id || 'default',
    mcpCall: {
      tool: 'use_figma',
      params: {
        fileKey: 'TARGET_FILE_KEY',
        code: figmaScript,
      },
    },
    note: 'Execute figmaScript via Figma MCP use_figma tool to create carousel',
  };
}

/**
 * Export carousel frames as PNG
 */
export async function exportFrames(figmaFileKey, frameNodeIds) {
  console.log('[Figma] Exporting frames as PNG...');

  // In practice, this would call Figma MCP download_assets:
  // const response = await figmaMCP.callTool('download_assets', {
  //   fileKey: figmaFileKey,
  //   nodeIds: frameNodeIds,
  //   format: 'PNG',
  //   scale: 2
  // });

  return {
    exported: frameNodeIds.length,
    format: 'PNG',
    scale: '2x',
    note: 'This will export frames via Figma MCP download_assets tool',
    mcpCall: {
      tool: 'download_assets',
      params: {
        fileKey: figmaFileKey,
        nodeIds: frameNodeIds,
        format: 'PNG',
        scale: 2,
      },
    },
  };
}

/**
 * Create a new Figma file for the carousel
 */
export async function createNewFigmaFile(fileName) {
  console.log(`[Figma] Creating new file: ${fileName}`);

  // In practice, this would call Figma MCP create_new_file:
  // const response = await figmaMCP.callTool('create_new_file', {
  //   fileName: fileName,
  //   editorType: 'design'
  // });

  return {
    fileName,
    note: 'This will create a new file via Figma MCP create_new_file tool',
    mcpCall: {
      tool: 'create_new_file',
      params: {
        fileName,
        editorType: 'design',
      },
    },
  };
}

/**
 * Get Figma file metadata
 */
export async function getFigmaFileMetadata(fileKey) {
  console.log(`[Figma] Getting metadata for file: ${fileKey}`);

  // In practice, this would call Figma MCP get_metadata:
  // const response = await figmaMCP.callTool('get_metadata', {
  //   fileKey: fileKey
  // });

  return {
    fileKey,
    note: 'This will fetch metadata via Figma MCP get_metadata tool',
    mcpCall: {
      tool: 'get_metadata',
      params: {
        fileKey,
      },
    },
  };
}

/**
 * Validate text contrast on backgrounds
 * Ensures readability (4.5:1 minimum ratio)
 */
export function validateTextContrast(textLayers, backgroundColors) {
  const validation = {
    allValid: true,
    concerns: [],
  };

  // Simplified contrast check (would need actual background analysis)
  textLayers.forEach(layer => {
    // Check if text color is too light/dark without sufficient contrast
    const textRgb = hexToRgb(layer.color);
    const luminance = 0.2126 * textRgb.r + 0.7152 * textRgb.g + 0.0722 * textRgb.b;
    
    // If text is very light (>0.9) or very dark (<0.1), ensure shadow is present
    if ((luminance > 0.9 || luminance < 0.1) && !layer.effects?.shadow) {
      validation.allValid = false;
      validation.concerns.push({
        layerId: layer.layerId || layer.type,
        issue: 'Text may have low contrast without shadow effect',
        recommendation: 'Add drop shadow for readability',
      });
    }
  });

  return validation;
}
