const PORTRAIT_FORMAT = Object.freeze({
  id: 'instagram-portrait-4x5',
  width: 1080,
  height: 1350,
  aspectRatio: '4:5',
  imageApiSize: '1024x1536',
  margins: Object.freeze({
    left: 72,
    right: 72,
    top: 96,
    bottom: 96,
  }),
});

const SQUARE_FORMAT = Object.freeze({
  id: 'instagram-square-1x1',
  width: 1080,
  height: 1080,
  aspectRatio: '1:1',
  imageApiSize: '1024x1024',
  margins: Object.freeze({
    left: 54,
    right: 54,
    top: 54,
    bottom: 54,
  }),
});

export const INSTAGRAM_FORMATS = Object.freeze({
  portrait: PORTRAIT_FORMAT,
  square: SQUARE_FORMAT,
  [PORTRAIT_FORMAT.id]: PORTRAIT_FORMAT,
  [SQUARE_FORMAT.id]: SQUARE_FORMAT,
});

export const INSTAGRAM_POST_FORMAT = PORTRAIT_FORMAT;

export function resolveInstagramFormat(format) {
  if (!format) return INSTAGRAM_POST_FORMAT;
  if (typeof format === 'string') {
    const resolved = INSTAGRAM_FORMATS[format];
    if (!resolved) throw new Error(`Unknown Instagram format: ${format}`);
    return resolved;
  }
  if (format.id && INSTAGRAM_FORMATS[format.id]) return INSTAGRAM_FORMATS[format.id];
  if (
    Number.isFinite(format.width) &&
    Number.isFinite(format.height) &&
    format.margins &&
    format.imageApiSize
  ) {
    return Object.freeze({
      ...format,
      margins: Object.freeze({ ...format.margins }),
    });
  }
  throw new Error('Invalid Instagram format configuration');
}

export function clampBoundsToFormat(bounds = {}, padding = 0, requestedFormat = INSTAGRAM_POST_FORMAT) {
  const format = resolveInstagramFormat(requestedFormat);
  const minX = format.margins.left + padding;
  const minY = format.margins.top + padding;
  const maxX = format.width - format.margins.right - padding;
  const maxY = format.height - format.margins.bottom - padding;
  const x = Math.max(minX, Number(bounds.x) || minX);
  const y = Math.max(minY, Number(bounds.y) || minY);
  const width = Math.max(1, Math.min(Number(bounds.width) || maxX - x, maxX - x));
  const height = Math.max(1, Math.min(Number(bounds.height) || maxY - y, maxY - y));
  return { x, y, width, height };
}

export function boundsToPercent(bounds, requestedFormat = INSTAGRAM_POST_FORMAT) {
  const format = resolveInstagramFormat(requestedFormat);
  return {
    x: Number(((bounds.x / format.width) * 100).toFixed(1)),
    y: Number(((bounds.y / format.height) * 100).toFixed(1)),
    width: Number(((bounds.width / format.width) * 100).toFixed(1)),
    height: Number(((bounds.height / format.height) * 100).toFixed(1)),
  };
}
