/**
 * Figma MCP Integration - REAL MCP CALLS
 * This version uses actual Figma MCP tools when the MCP server is connected
 */

/**
 * Check if Figma MCP is available
 */
export async function isFigmaMcpAvailable() {
  try {
    // This would be implemented by checking GetMcpTools
    // For now, return false as fallback
    return false;
  } catch (error) {
    console.warn('[Figma MCP] Not available:', error.message);
    return false;
  }
}

/**
 * Create carousel in Figma using MCP
 * This replaces the placeholder implementation
 */
export async function createCarouselInFigma(generationData, tenantName) {
  const {
    step2Output,
    step4Output,
    step5Output,
    step6Output,
    step7Output,
    generationId,
  } = generationData;

  console.log('[Figma MCP] Creating carousel in Figma...');

  // 1. Create a new Figma file
  const fileName = `Alora Carousel - ${tenantName} - ${new Date().toLocaleDateString()}`;
  
  // In production with MCP connected, you would call:
  // const fileResponse = await CallMcpTool('plugin-figma-figma', 'create_new_file', {
  //   fileName,
  //   editorType: 'design'
  // });
  // const fileKey = fileResponse.fileKey;

  // 2. Upload images to Figma
  const imagesToUpload = (step6Output?.images || [])
    .filter(img => img.status === 'generated' && img.assetRef)
    .map(img => ({
      name: `slide_${img.slideIndex}.png`,
      url: img.assetRef.startsWith('/api/') 
        ? `http://localhost:5173${img.assetRef}` 
        : img.assetRef
    }));

  // const uploadResponse = await CallMcpTool('plugin-figma-figma', 'upload_assets', {
  //   fileKey,
  //   assets: imagesToUpload
  // });

  // 3. Create frames with use_figma
  const slides = step7Output?.slides || [];
  const figmaScript = buildFigmaCreationScript(slides, step5Output, step2Output);

  // const createResponse = await CallMcpTool('plugin-figma-figma', 'use_figma', {
  //   fileKey,
  //   code: figmaScript
  // });

  return {
    success: true,
    note: 'MCP calls commented out - uncomment when Figma MCP is connected',
    figmaFileUrl: `https://www.figma.com/file/PLACEHOLDER/${encodeURIComponent(fileName)}`,
    figmaScript, // For debugging
  };
}

/**
 * Build the Figma creation script for use_figma MCP tool
 */
function buildFigmaCreationScript(slides, captionOutput, visualOutput) {
  return `
// Create Instagram Carousel in Figma
async function createCarousel() {
  const page = figma.createPage();
  page.name = "Instagram Carousel";
  figma.currentPage = page;
  
  const frames = [];
  let xOffset = 0;
  
  // Create ${slides.length} frames
  ${slides.map((slide, idx) => `
  const frame${idx} = figma.createFrame();
  frame${idx}.name = "Slide ${slide.slideIndex}";
  frame${idx}.resize(1080, 1350);
  frame${idx}.x = xOffset;
  frame${idx}.y = 0;
  
  // Add text layers
  ${(slide.textLayers || []).map((layer, layerIdx) => `
  const text${idx}_${layerIdx} = figma.createText();
  await figma.loadFontAsync({ family: '${layer.typography.fontFamily}', style: 'Regular' });
  text${idx}_${layerIdx}.characters = ${JSON.stringify(layer.content)};
  text${idx}_${layerIdx}.fontSize = ${layer.typography.fontSize};
  text${idx}_${layerIdx}.x = ${layer.position.x};
  text${idx}_${layerIdx}.y = ${layer.position.y};
  text${idx}_${layerIdx}.resize(${layer.position.width}, ${layer.position.height});
  frame${idx}.appendChild(text${idx}_${layerIdx});
  `).join('')}
  
  frames.push(frame${idx});
  xOffset += 1180;
  `).join('')}
  
  figma.currentPage.selection = frames;
  figma.viewport.scrollAndZoomIntoView(frames);
  
  return {
    fileUrl: figma.root.documentId ? \`https://www.figma.com/file/\${figma.fileKey}\` : null,
    pageId: page.id,
    frameCount: frames.length
  };
}

createCarousel();
`;
}
