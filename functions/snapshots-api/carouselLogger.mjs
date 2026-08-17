/**
 * Structured JSON logger for carousel generation pipeline
 * Emits correlation-aware, redacted console logs for observability
 */

import crypto from 'crypto';

/**
 * Redact sensitive fields from an object
 */
function redactSensitive(obj, maxLength = 500) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const redacted = Array.isArray(obj) ? [] : {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Completely redact sensitive keys
    if (lowerKey.includes('key') || 
        lowerKey.includes('token') || 
        lowerKey.includes('secret') || 
        lowerKey.includes('password') || 
        lowerKey.includes('auth') ||
        lowerKey.includes('bearer')) {
      redacted[key] = '[REDACTED]';
      continue;
    }
    
    // Redact base64 image data
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      const commaIdx = value.indexOf(',');
      const prefix = commaIdx > 0 ? value.substring(0, commaIdx + 1) : 'data:image/';
      redacted[key] = `${prefix}[BASE64_DATA_${value.length}_BYTES]`;
      continue;
    }
    
    // Truncate very long strings
    if (typeof value === 'string' && value.length > maxLength) {
      redacted[key] = value.substring(0, maxLength) + `... [TRUNCATED_${value.length}_CHARS]`;
      continue;
    }
    
    // Recursively redact nested objects
    if (value && typeof value === 'object') {
      redacted[key] = redactSensitive(value, maxLength);
      continue;
    }
    
    redacted[key] = value;
  }
  
  return redacted;
}

/**
 * Generate a short hash of a string for logging
 */
function shortHash(str) {
  if (!str) return null;
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 12);
}

/**
 * Base logger function - emits structured JSON to console
 */
function emit(event) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    service: 'carousel-generation',
    ...event,
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Log generation start
 */
export function logGenerationStart({ generationId, tenantId, accountId, postId, postTitle }) {
  emit({
    event: 'generation.start',
    generationId,
    tenantId,
    accountId,
    postId,
    postTitle: postTitle?.substring(0, 100),
  });
}

/**
 * Log generation complete
 */
export function logGenerationComplete({ generationId, tenantId, accountId, durationMs, stepsCompleted }) {
  emit({
    event: 'generation.complete',
    generationId,
    tenantId,
    accountId,
    durationMs,
    stepsCompleted,
  });
}

/**
 * Log generation error
 */
export function logGenerationError({ generationId, tenantId, accountId, error, step, durationMs }) {
  emit({
    event: 'generation.error',
    generationId,
    tenantId,
    accountId,
    step,
    error: error?.message || String(error),
    errorStack: error?.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines only
    durationMs,
  });
}

/**
 * Log step start
 */
export function logStepStart({ generationId, tenantId, accountId, step, stepName, input }) {
  const redactedInput = redactSensitive(input, 200);
  
  emit({
    event: 'step.start',
    generationId,
    tenantId,
    accountId,
    step,
    stepName,
    inputSummary: {
      keys: input ? Object.keys(input) : [],
      ...redactedInput,
    },
  });
}

/**
 * Log step complete
 */
export function logStepComplete({ generationId, tenantId, accountId, step, stepName, output, durationMs, metadata }) {
  const redactedOutput = redactSensitive(output, 200);
  
  emit({
    event: 'step.complete',
    generationId,
    tenantId,
    accountId,
    step,
    stepName,
    durationMs,
    outputSummary: {
      keys: output ? Object.keys(output) : [],
      ...redactedOutput,
    },
    metadata,
  });
}

/**
 * Log step error
 */
export function logStepError({ generationId, tenantId, accountId, step, stepName, error, durationMs }) {
  emit({
    event: 'step.error',
    generationId,
    tenantId,
    accountId,
    step,
    stepName,
    error: error?.message || String(error),
    errorStack: error?.stack?.split('\n').slice(0, 3).join('\n'),
    durationMs,
  });
}

/**
 * Log Claude API call
 */
export function logClaudeCall({ generationId, tenantId, accountId, step, model, promptTokens, completionTokens, durationMs, retryAttempt }) {
  emit({
    event: 'claude.call',
    generationId,
    tenantId,
    accountId,
    step,
    model,
    promptTokens,
    completionTokens,
    totalTokens: (promptTokens || 0) + (completionTokens || 0),
    durationMs,
    retryAttempt: retryAttempt || 0,
  });
}

/**
 * Log image generation for a single slide
 */
export function logImageGeneration({ 
  generationId, 
  tenantId, 
  accountId, 
  slideIndex, 
  promptHash,
  promptSummary,
  model,
  quality,
  size,
  durationMs,
  bytesGenerated,
  persistedPath,
  error 
}) {
  emit({
    event: 'image.generation',
    generationId,
    tenantId,
    accountId,
    slideIndex,
    promptHash,
    promptSummary: promptSummary?.substring(0, 150),
    model,
    quality,
    size,
    durationMs,
    bytesGenerated,
    persistedPath,
    error: error?.message || (error ? String(error) : undefined),
  });
}

/**
 * Log resume attempt
 */
export function logResumeAttempt({ generationId, tenantId, accountId, fromStep, reason }) {
  emit({
    event: 'generation.resume',
    generationId,
    tenantId,
    accountId,
    fromStep,
    reason,
  });
}

/**
 * Log Figma job created
 */
export function logFigmaJobCreated({ generationId, tenantId, accountId, jobId, importCode }) {
  emit({
    event: 'figma.job.created',
    generationId,
    tenantId,
    accountId,
    jobId,
    importCodeHash: shortHash(importCode),
  });
}

/**
 * Log Figma job claimed
 */
export function logFigmaJobClaimed({ jobId, generationId, tenantId, accountId, claimedAt }) {
  emit({
    event: 'figma.job.claimed',
    jobId,
    generationId,
    tenantId,
    accountId,
    claimedAt,
  });
}

/**
 * Log Figma page created
 */
export function logFigmaPageCreated({ jobId, generationId, tenantId, accountId, pageId, pageName }) {
  emit({
    event: 'figma.page.created',
    jobId,
    generationId,
    tenantId,
    accountId,
    pageId,
    pageName,
  });
}

/**
 * Log Figma frame created
 */
export function logFigmaFrameCreated({ jobId, generationId, tenantId, accountId, frameId, slideIndex }) {
  emit({
    event: 'figma.frame.created',
    jobId,
    generationId,
    tenantId,
    accountId,
    frameId,
    slideIndex,
  });
}

/**
 * Log Figma export uploaded
 */
export function logFigmaExportUploaded({ jobId, generationId, tenantId, accountId, slideIndex, exportUrl, bytes }) {
  emit({
    event: 'figma.export.uploaded',
    jobId,
    generationId,
    tenantId,
    accountId,
    slideIndex,
    exportUrl,
    bytes,
  });
}

/**
 * Log Figma job complete
 */
export function logFigmaJobComplete({ jobId, generationId, tenantId, accountId, fileUrl, pageUrl, durationMs, framesCreated }) {
  emit({
    event: 'figma.job.complete',
    jobId,
    generationId,
    tenantId,
    accountId,
    fileUrl,
    pageUrl,
    durationMs,
    framesCreated,
  });
}

/**
 * Log Figma job error
 */
export function logFigmaJobError({ jobId, generationId, tenantId, accountId, error, step }) {
  emit({
    event: 'figma.job.error',
    jobId,
    generationId,
    tenantId,
    accountId,
    step,
    error: error?.message || String(error),
  });
}

/**
 * Export helper for creating prompt hashes
 */
export { shortHash as createPromptHash };
