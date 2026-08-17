// Alora Carousel Importer — creates Figma nodes from data fetched in ui.html

// Instagram carousel dimensions and safe zones
const INSTAGRAM_DIMENSIONS = {
  CANVAS_WIDTH: 1080,
  CANVAS_HEIGHT: 1350,
  TEXT_SAFE_X: 72,
  TEXT_SAFE_Y: 96,
  TEXT_MAX_X: 1008,
  TEXT_MAX_Y: 1254,
};

interface BuildMessage {
  type: 'build'
  importCode: string
  job: GenerationData
  images: Record<string, string>
  assets?: Record<string, string>
}

interface QaMessage {
  type: 'apply-qa'
  results: Array<{
    slideIndex: number
    corrections?: Array<{ layerId: string; fontScale: number; color?: string }>
    panel?: { required?: boolean; color?: string; opacity?: number }
  }>
}

const builtFramesBySlide = new Map<number, FrameNode>()
let activeBuildPage: PageNode | null = null
let previousBuildPage: PageNode | null = null

interface GenerationData {
  jobId: string
  generationId: string
  generation: {
    id: string
    post_prompt: string
    post_text: string
    final_caption: string
    image_urls: string[]
    stepOutputs: {
      step6?: { 
        images?: Array<{ 
          slideIndex: number
          assetRef?: string
          status?: string
          recommendedTextColor?: string
          panelRequired?: boolean
          panelRecommendation?: {
            color: string
            opacity: number
            cornerRadius: number
          } | null
          resolvedTextBlock?: {
            plannedBounds: { x: number; y: number; width: number; height: number }
            bounds: { x: number; y: number; width: number; height: number }
            source: string
            confidence: number
            recommendedTextColor: string
          }
          zones?: Array<{
            priority: string
            suggestedFor: string
            bounds: { x: number; y: number; width: number; height: number }
            recommendedTextColor: string
            textZoneTone: string
            contrastCoverage: number
          }>
        }> 
      }
      step7?: {
        slides?: any[]
        format?: {
          width: number
          height: number
          margins: { left: number; right: number; top: number; bottom: number }
        }
        qualityCheck?: { passed?: boolean }
      }
    }
  }
  debugMode?: boolean
}

figma.showUI(typeof __html__ !== 'undefined' ? __html__ : '<p>Plugin UI failed to load.</p>', {
  width: 360,
  height: 360,
})

figma.ui.onmessage = async (msg: BuildMessage | QaMessage | { type: string; error?: string }) => {
  if (msg.type === 'apply-qa') {
    try {
      applyQaCorrections((msg as QaMessage).results)
      figma.ui.postMessage({ type: 'qa-applied' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      figma.ui.postMessage({ type: 'import-error', error: message })
    }
    return
  }
  if (msg.type !== 'build') return
  const build = msg as BuildMessage
  try {
    const result = await buildCarousel(build)
    figma.ui.postMessage({ type: 'built', ...result })
  } catch (error) {
    if (activeBuildPage) {
      if (previousBuildPage) await figma.setCurrentPageAsync(previousBuildPage)
      activeBuildPage.remove()
      activeBuildPage = null
      previousBuildPage = null
      builtFramesBySlide.clear()
    }
    const message = error instanceof Error ? error.message : String(error)
    figma.ui.postMessage({ type: 'import-error', error: message })
  }
}

async function buildCarousel(build: BuildMessage) {
  const { importCode, job, images, assets = {} } = build
  const generation = job.generation
  const generationId = job.generationId
  const debugMode = job.debugMode || false

  const pageName = `Alora Carousel - ${new Date().toLocaleDateString()} - ${(generation.post_prompt || 'carousel').substring(0, 30)}`
  previousBuildPage = figma.currentPage
  const page = figma.createPage()
  activeBuildPage = page
  page.name = pageName
  await figma.setCurrentPageAsync(page)

  const slides = generation.stepOutputs.step7?.slides || []
  const step6Images = generation.stepOutputs.step6?.images || []
  const format = generation.stepOutputs.step7?.format
  const dimensions = format
    ? {
        CANVAS_WIDTH: format.width,
        CANVAS_HEIGHT: format.height,
        TEXT_SAFE_X: format.margins.left,
        TEXT_SAFE_Y: format.margins.top,
        TEXT_MAX_X: format.width - format.margins.right,
        TEXT_MAX_Y: format.height - format.margins.bottom,
      }
    : INSTAGRAM_DIMENSIONS
  const frames: FrameNode[] = []
  const fontWarnings: string[] = []
  let xOffset = 0

  const slideCount = Math.max(slides.length, Object.keys(images).length, 1)

  for (let i = 0; i < slideCount; i++) {
    const slide = slides[i] || {}
    const slideIndex = slide.slideIndex || i + 1
    const step6Image = step6Images.find(img => img.slideIndex === slideIndex)
    const resolvedLayout = resolveSlideTextLayout(slide, step6Image, dimensions)
    const frame = figma.createFrame()
    frame.name = `Slide ${slideIndex}`
    frame.resize(dimensions.CANVAS_WIDTH, dimensions.CANVAS_HEIGHT)
    frame.x = xOffset
    frame.y = 0
    xOffset += dimensions.CANVAS_WIDTH + 50
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]

    const imageB64 = images[String(slideIndex)]
    if (imageB64) {
      try {
        const bytes = figma.base64Decode(imageB64)
        const image = figma.createImage(bytes)
        frame.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }]
      } catch {
        // keep solid fill
      }
    }

    if (slide.overlay?.type === 'scrim') {
      addScrimOverlay(frame, slide.overlay, dimensions)
    }

    const textNodes: TextNode[] = []
    if (Array.isArray(resolvedLayout.layers)) {
      for (const textLayer of resolvedLayout.layers) {
        try {
          const result = await addTextLayer(
            frame,
            {
              ...textLayer,
              color: step6Image?.resolvedTextBlock?.source === 'profile-scrim'
                ? textLayer.color
                : (step6Image?.recommendedTextColor || textLayer.color),
            },
            slideIndex,
          )
          textNodes.push(result.textNode)
          if (result.fontSubstituted) {
            fontWarnings.push(result.warning!)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          throw new Error(`Slide ${slideIndex}: failed to create ${textLayer.type || 'text'} layer: ${message}`)
        }
      }
    }
    let fittedBounds = fitTextStack(textNodes, resolvedLayout.layers, resolvedLayout.bounds)
    let panelSpec = step6Image?.panelRequired
      ? step6Image.panelRecommendation
      : slide.textBlock?.panel
    if (!fittedBounds) {
      const plannedBounds = slide.textBlock?.protectedBounds
      const fallbackBounds = plannedBounds || {
        x: dimensions.TEXT_SAFE_X,
        y: dimensions.TEXT_SAFE_Y,
        width: dimensions.TEXT_MAX_X - dimensions.TEXT_SAFE_X,
        height: dimensions.TEXT_MAX_Y - dimensions.TEXT_SAFE_Y,
      }
      fittedBounds = fitTextStack(textNodes, resolvedLayout.layers, fallbackBounds)
      panelSpec = panelSpec || { color: '#FFFFFF', opacity: 0.9, cornerRadius: 32 }
    }
    if (!fittedBounds) {
      fittedBounds = fitTextStack(textNodes, resolvedLayout.layers, {
        x: dimensions.TEXT_SAFE_X,
        y: dimensions.TEXT_SAFE_Y,
        width: dimensions.TEXT_MAX_X - dimensions.TEXT_SAFE_X,
        height: dimensions.TEXT_MAX_Y - dimensions.TEXT_SAFE_Y,
      })
      panelSpec = panelSpec || { color: '#FFFFFF', opacity: 0.9, cornerRadius: 32 }
    }
    if (!fittedBounds) {
      throw new Error(`Slide ${slideIndex}: copy cannot fit after proportional stack auto-fit`)
    }
    if (panelSpec) {
      const panelColor = hexToRgb(panelSpec.color || '#FFFFFF') || { r: 1, g: 1, b: 1 }
      const useDarkText = panelColor.r * 0.2126 + panelColor.g * 0.7152 + panelColor.b * 0.0722 > 0.55
      const textColor = useDarkText ? { r: 0.067, g: 0.067, b: 0.067 } : { r: 1, g: 1, b: 1 }
      for (const node of textNodes) node.fills = [{ type: 'SOLID', color: textColor }]
      addEditableBackingPanel(frame, fittedBounds, panelSpec)
      const panel = frame.findOne((node) => node.name === 'Editable Text Backing Panel')
      if (panel) frame.insertChild(0, panel)
    }
    validateTextNodes(textNodes, resolvedLayout.layers, slideIndex, dimensions)

    if (slide.logoLayer?.assetRef && assets.logo) {
      await addLogoLayer(frame, assets.logo, slide.logoLayer, dimensions)
    }

    // Add debug visualization if enabled
    if (debugMode) {
      if (step6Image?.zones) {
        addDebugZoneVisualization(frame, step6Image.zones, slideIndex)
      }
    }

    frames.push(frame)
    builtFramesBySlide.set(slideIndex, frame)
  }

  figma.currentPage.selection = frames
  figma.viewport.scrollAndZoomIntoView(frames)

  const exportedSlideUrls = frames.map((_, i) => ({
    slideIndex: i + 1,
    url: `/api/carousel/exports/${generationId}/slide_${i + 1}.png`,
  }))
  const previewPngs = []
  for (let i = 0; i < frames.length; i++) {
    const bytes = await frames[i].exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 0.5 },
    })
    previewPngs.push({
      slideIndex: slides[i]?.slideIndex || i + 1,
      pngBase64: figma.base64Encode(bytes),
    })
  }
  activeBuildPage = null
  previousBuildPage = null

  return {
    importCode,
    framesCreated: frames.length,
    previewPngs,
    fontWarnings: fontWarnings.length > 0 ? fontWarnings : undefined,
    completePayload: {
      importCode,
      figmaFileKey: figma.fileKey,
      figmaPageId: page.id,
      figmaPageName: page.name,
      figmaFileUrl: `https://www.figma.com/file/${figma.fileKey}/${encodeURIComponent(figma.root.name)}?node-id=${page.id}`,
      exportedSlideUrls,
    },
  }
}

function addScrimOverlay(frame: FrameNode, overlay: any, dimensions: typeof INSTAGRAM_DIMENSIONS) {
  const rectangle = figma.createRectangle()
  rectangle.name = 'Profile Readability Scrim'
  rectangle.resize(dimensions.CANVAS_WIDTH, dimensions.CANVAS_HEIGHT)
  const color = hexToRgb(overlay.color || '#061D3A') || { r: 0.024, g: 0.114, b: 0.227 }
  const opacity = Math.max(0, Math.min(1, Number(overlay.opacity) || 0.7))
  const transparent = { ...color, a: 0 }
  const opaque = { ...color, a: opacity }
  const direction = String(overlay.direction || 'left-to-right')
  if (direction === 'solid') {
    rectangle.fills = [{ type: 'SOLID', color, opacity }]
  } else {
    const horizontal = direction === 'left-to-right' || direction === 'right-to-left'
    const reverse = direction === 'right-to-left' || direction === 'bottom-to-top'
    rectangle.fills = [{
      type: 'GRADIENT_LINEAR',
      gradientTransform: horizontal
        ? [[1, 0, 0], [0, 1, 0]]
        : [[0, 1, 0], [-1, 0, 1]],
      gradientStops: reverse
        ? [{ position: 0, color: transparent }, { position: 1, color: opaque }]
        : [{ position: 0, color: opaque }, { position: 0.72, color: transparent }],
    }]
  }
  frame.appendChild(rectangle)
}

async function addLogoLayer(
  frame: FrameNode,
  base64: string,
  logo: any,
  dimensions: typeof INSTAGRAM_DIMENSIONS,
) {
  const image = figma.createImage(figma.base64Decode(base64))
  const size = await image.getSizeAsync()
  const maxWidth = Math.min(Number(logo.width) || 240, dimensions.CANVAS_WIDTH * 0.3)
  const maxHeight = Math.min(Number(logo.maxHeight) || 92, dimensions.CANVAS_HEIGHT * 0.12)
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height)
  const width = Math.max(1, size.width * scale)
  const height = Math.max(1, size.height * scale)
  const node = figma.createRectangle()
  node.name = 'Brand Logo'
  node.resize(width, height)
  const marginX = Number(logo.marginX) || 54
  const marginY = Number(logo.marginY) || 54
  node.x = String(logo.anchor).includes('right')
    ? dimensions.CANVAS_WIDTH - marginX - width
    : marginX
  node.y = String(logo.anchor).includes('bottom')
    ? dimensions.CANVAS_HEIGHT - marginY - height
    : marginY
  node.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FIT' }]
  node.effects = [{
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.28 },
    offset: { x: 0, y: 2 },
    radius: 10,
    spread: 0,
    visible: true,
    blendMode: 'NORMAL',
  }]
  frame.appendChild(node)
}

function resolveSlideTextLayout(slide: any, step6Image: any, dimensions = INSTAGRAM_DIMENSIONS) {
  const planned = slide.textBlock?.protectedBounds || {
    x: dimensions.TEXT_SAFE_X,
    y: dimensions.TEXT_SAFE_Y,
    width: dimensions.TEXT_MAX_X - dimensions.TEXT_SAFE_X,
    height: dimensions.TEXT_MAX_Y - dimensions.TEXT_SAFE_Y,
  }
  const resolved = step6Image?.resolvedTextBlock?.bounds || planned
  const scaleX = resolved.width / planned.width
  const scaleY = resolved.height / planned.height
  const typeScale = Math.min(scaleX, scaleY)
  const layers = (slide.textLayers || []).map((layer: any) => ({
    ...layer,
    color: step6Image?.resolvedTextBlock?.source === 'profile-scrim'
      ? layer.color
      : (step6Image?.recommendedTextColor || layer.color),
    position: {
      ...layer.position,
      x: resolved.x + (layer.position.x - planned.x) * scaleX,
      y: resolved.y + (layer.position.y - planned.y) * scaleY,
      width: layer.position.width * scaleX,
      height: layer.position.height * scaleY,
    },
    typography: {
      ...layer.typography,
      fontSize: Math.max(layer.typography.minFontSize || 12, layer.typography.fontSize * typeScale),
    },
  }))
  return { bounds: resolved, layers }
}

function fitTextStack(nodes: TextNode[], layers: any[], bounds: any): any | null {
  if (!nodes.length) return bounds
  const padding = 40
  const gap = 24
  const width = Math.max(1, bounds.width - padding * 2)
  const availableHeight = Math.max(1, bounds.height - padding * 2)
  const initialSizes = layers.map((layer) => Number(layer.typography?.fontSize) || 16)
  const minimumScale = Math.max(...layers.map((layer, index) => {
    const minimum = Number(layer.typography?.minFontSize) || 12
    return minimum / initialSizes[index]
  }))
  for (let scale = 1; scale >= minimumScale - 0.001; scale -= 0.04) {
    for (let index = 0; index < nodes.length; index++) {
      nodes[index].fontSize = Math.max(
        Number(layers[index].typography?.minFontSize) || 12,
        initialSizes[index] * scale,
      )
      nodes[index].resize(width, 1)
      nodes[index].textAutoResize = 'HEIGHT'
    }
    const totalHeight = nodes.reduce((sum, node) => sum + node.height, 0)
      + gap * Math.max(0, nodes.length - 1)
    if (totalHeight <= availableHeight) {
      let y = bounds.y + padding + Math.max(0, (availableHeight - totalHeight) / 2)
      for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index]
        node.x = bounds.x + padding
        node.y = Math.round(y)
        const alignment = String(layers[index].position?.alignment || 'left').toUpperCase()
        if (alignment === 'LEFT' || alignment === 'CENTER' || alignment === 'RIGHT' || alignment === 'JUSTIFIED') {
          node.textAlignHorizontal = alignment
        }
        layers[index].position = {
          ...layers[index].position,
          x: node.x,
          y: node.y,
          width,
          height: node.height,
        }
        y += node.height + gap
      }
      return bounds
    }
  }
  return null
}

async function addTextLayer(frame: FrameNode, textLayer: any, slideIndex: number): Promise<{ textNode: TextNode; fontSubstituted: boolean; warning?: string }> {
  const weightStyles: Record<string, string> = {
    '400': 'Regular',
    '500': 'Medium',
    '600': 'SemiBold',
    '700': 'Bold',
    '800': 'ExtraBold',
  }
  
  const requestedFamily = textLayer.typography?.fontFamily || 'Inter'
  const requestedWeight = String(textLayer.typography?.fontWeight || '400')
  const requestedStyle = textLayer.typography?.fontStyle || weightStyles[requestedWeight] || 'Regular'
  
  const fontName = {
    family: requestedFamily,
    style: requestedStyle,
  }
  
  let fontSubstituted = false
  let warning: string | undefined
  
  try {
    await figma.loadFontAsync(fontName)
  } catch {
    // Font not available, fallback to Inter
    fontName.family = 'Inter'
    fontName.style = 'Regular'
    await figma.loadFontAsync(fontName)
    fontSubstituted = true
    warning = `Slide ${slideIndex}: Font "${requestedFamily} ${requestedStyle}" unavailable, substituted with "Inter Regular"`
  }

  const text = figma.createText()
  text.name = textLayer.layerId || textLayer.type || 'text'
  text.fontName = fontName
  text.characters = textLayer.content || ''

  const segments = Array.isArray(textLayer.typography?.segments)
    ? textLayer.typography.segments
    : []
  if (!fontSubstituted && segments.some((segment: any) => segment.italic)) {
    const italicName = {
      family: requestedFamily,
      style: textLayer.typography?.italicStyle || 'Italic',
    }
    try {
      await figma.loadFontAsync(italicName)
      let offset = 0
      for (const segment of segments) {
        const length = String(segment.text || '').length
        if (segment.italic && length > 0) {
          text.setRangeFontName(offset, offset + length, italicName)
        }
        offset += length
      }
    } catch {
      warning = `Slide ${slideIndex}: Italic font "${italicName.family} ${italicName.style}" unavailable; headline kept in ${requestedStyle}`
      fontSubstituted = true
    }
  }

  if (textLayer.typography) {
    text.fontSize = textLayer.typography.fontSize || 16
    if (textLayer.typography.lineHeight) {
      text.lineHeight = { value: textLayer.typography.lineHeight * 100, unit: 'PERCENT' }
    }
    if (Number.isFinite(textLayer.typography.letterSpacing)) {
      text.letterSpacing = { value: textLayer.typography.letterSpacing, unit: 'PIXELS' }
    }
    if (textLayer.typography.textTransform === 'uppercase') {
      text.textCase = 'UPPER'
    }
  }

  if (textLayer.position) {
    text.x = textLayer.position.x || 0
    text.y = textLayer.position.y || 0
    if (textLayer.position.width) {
      text.resize(textLayer.position.width, 1)
      text.textAutoResize = 'HEIGHT'
    }
    const align = String(textLayer.position.alignment || '').toUpperCase()
    if (align === 'LEFT' || align === 'CENTER' || align === 'RIGHT' || align === 'JUSTIFIED') {
      text.textAlignHorizontal = align
    }
  }

  if (textLayer.color) {
    const color = hexToRgb(textLayer.color)
    if (color) text.fills = [{ type: 'SOLID', color }]
  }

  if (textLayer.effects?.shadow) {
    const shadowColor = hexToRgba(textLayer.effects.shadowColor || '#00000040')
    text.effects = [{
      type: 'DROP_SHADOW',
      color: shadowColor,
      offset: textLayer.effects.shadowOffset || { x: 0, y: 4 },
      radius: textLayer.effects.shadowBlur || 20,
      spread: 0,
      visible: true,
      blendMode: 'NORMAL',
    }]
  }

  frame.appendChild(text)
  return { textNode: text, fontSubstituted, warning }
}

function applyQaCorrections(results: QaMessage['results']) {
  for (const result of results) {
    const frame = builtFramesBySlide.get(result.slideIndex)
    if (!frame) continue
    for (const correction of result.corrections || []) {
      const node = frame.findOne(
        (candidate) => candidate.type === 'TEXT' && candidate.name === correction.layerId,
      ) as TextNode | null
      if (!node) continue
      node.fontSize = Math.max(12, Number(node.fontSize) * correction.fontScale)
      if (correction.color) {
        const color = hexToRgb(correction.color)
        if (color) node.fills = [{ type: 'SOLID', color }]
      }
    }
    if (
      result.panel?.required &&
      !frame.findOne((node) => node.name === 'Editable Text Backing Panel') &&
      !frame.findOne((node) => node.name === 'Profile Readability Scrim')
    ) {
      const textNodes = frame.findAll((node) => node.type === 'TEXT') as TextNode[]
      if (textNodes.length) {
        const margin = frame.height === frame.width ? 54 : 72
        const verticalMargin = frame.height === frame.width ? 54 : 96
        const left = Math.max(margin, Math.min(...textNodes.map((node) => node.x)) - 32)
        const top = Math.max(verticalMargin, Math.min(...textNodes.map((node) => node.y)) - 32)
        const right = Math.min(frame.width - margin, Math.max(...textNodes.map((node) => node.x + node.width)) + 32)
        const bottom = Math.min(frame.height - verticalMargin, Math.max(...textNodes.map((node) => node.y + node.height)) + 32)
        addEditableBackingPanel(
          frame,
          { x: left, y: top, width: right - left, height: bottom - top },
          {
            color: result.panel.color || '#FFFFFF',
            opacity: result.panel.opacity || 0.88,
            cornerRadius: 32,
          },
        )
        const panel = frame.findOne((node) => node.name === 'Editable Text Backing Panel')
        if (panel) frame.insertChild(0, panel)
      }
    }
  }
}

function addEditableBackingPanel(frame: FrameNode, bounds: any, panelSpec: any) {
  const panel = figma.createRectangle()
  panel.name = 'Editable Text Backing Panel'
  panel.resize(bounds.width, bounds.height)
  panel.x = bounds.x
  panel.y = bounds.y
  panel.cornerRadius = Number(panelSpec.cornerRadius) || 32
  const color = hexToRgb(panelSpec.color || '#FFFFFF') || { r: 1, g: 1, b: 1 }
  panel.fills = [{
    type: 'SOLID',
    color,
    opacity: Math.min(1, Math.max(0.6, Number(panelSpec.opacity) || 0.88)),
  }]
  frame.appendChild(panel)
}

function validateTextNodes(
  nodes: TextNode[],
  blueprints: any[],
  slideIndex: number,
  dimensions = INSTAGRAM_DIMENSIONS,
) {
  if (!nodes.length) return
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const box = blueprints[i]?.position
    if (box && (
      node.x < box.x ||
      node.y < box.y ||
      node.x + node.width > box.x + box.width + 1 ||
      node.y + node.height > box.y + box.height + 1
    )) {
      throw new Error(`Slide ${slideIndex}: text "${node.characters.slice(0, 32)}" does not fit its blueprint box`)
    }
    if (node.x < dimensions.TEXT_SAFE_X || 
        node.y < dimensions.TEXT_SAFE_Y || 
        node.x + node.width > dimensions.TEXT_MAX_X || 
        node.y + node.height > dimensions.TEXT_MAX_Y) {
      throw new Error(`Slide ${slideIndex}: text "${node.characters.slice(0, 32)}" falls outside Instagram safe area`)
    }
    for (let j = i + 1; j < nodes.length; j++) {
      const other = nodes[j]
      if (
        node.x < other.x + other.width &&
        node.x + node.width > other.x &&
        node.y < other.y + other.height &&
        node.y + node.height > other.y
      ) {
        throw new Error(`Slide ${slideIndex}: native text layers overlap`)
      }
    }
  }
}

function addDebugZoneVisualization(frame: FrameNode, zones: any[], _slideIndex: number) {
  const priorityColors: Record<string, { r: number; g: number; b: number }> = {
    'primary': { r: 0, g: 0.8, b: 0 },      // Green
    'secondary': { r: 0, g: 0.5, b: 1 },    // Blue
    'tertiary': { r: 1, g: 0.6, b: 0 },     // Orange
  }

  for (const zone of zones) {
    // Draw zone rectangle
    const rect = figma.createRectangle()
    rect.name = `[DEBUG] ${zone.priority} zone - ${zone.suggestedFor}`
    rect.resize(zone.bounds.width, zone.bounds.height)
    rect.x = zone.bounds.x
    rect.y = zone.bounds.y
    
    // Semi-transparent fill with priority color
    const color = priorityColors[zone.priority] || { r: 0.5, g: 0.5, b: 0.5 }
    rect.fills = [{ type: 'SOLID', color, opacity: 0.15 }]
    
    // Colored stroke
    rect.strokes = [{ type: 'SOLID', color }]
    rect.strokeWeight = 3
    rect.strokeAlign = 'INSIDE'
    
    frame.appendChild(rect)
    
    // Add label with zone info
    const label = figma.createText()
    label.name = `[DEBUG] ${zone.priority} label`
    
    // Load font for label
    figma.loadFontAsync({ family: 'Inter', style: 'Bold' }).then(() => {
      label.fontName = { family: 'Inter', style: 'Bold' }
      label.fontSize = 14
      label.characters = `${zone.priority.toUpperCase()}\n${zone.suggestedFor}\n${Math.round(zone.contrastCoverage * 100)}% contrast\n${zone.recommendedTextColor}`
      label.fills = [{ type: 'SOLID', color }]
      
      // Position label at top-left of zone with padding
      label.x = zone.bounds.x + 8
      label.y = zone.bounds.y + 8
      
      // Add background for readability
      const labelBg = figma.createRectangle()
      labelBg.name = `[DEBUG] ${zone.priority} label bg`
      labelBg.resize(label.width + 16, label.height + 16)
      labelBg.x = zone.bounds.x + 4
      labelBg.y = zone.bounds.y + 4
      labelBg.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.9 }]
      labelBg.strokes = [{ type: 'SOLID', color }]
      labelBg.strokeWeight = 2
      
      frame.appendChild(labelBg)
      frame.appendChild(label)
    }).catch(() => {
      // If Inter Bold fails, skip the label
    })
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : null
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const normalized = hex.replace('#', '')
  const rgbHex = normalized.slice(0, 6).padEnd(6, '0')
  const alphaHex = normalized.length >= 8 ? normalized.slice(6, 8) : 'FF'
  return {
    r: parseInt(rgbHex.slice(0, 2), 16) / 255,
    g: parseInt(rgbHex.slice(2, 4), 16) / 255,
    b: parseInt(rgbHex.slice(4, 6), 16) / 255,
    a: parseInt(alphaHex, 16) / 255,
  }
}
