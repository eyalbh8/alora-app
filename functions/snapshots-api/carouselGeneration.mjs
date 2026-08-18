/**
 * Instagram Carousel Generation - Main Handler
 * Orchestrates the full 8-step generation process
 * 
 * Steps:
 * 1. Content Plan (Claude)
 * 2. Visual Style Direction (Claude) - NEW
 * 3. Choose Templates (Claude)
 * 4. Apply BrandHub (Claude)
 * 5. Format Caption (Claude)
 * 6. Generate Visuals (GPT Image 2) - NO TEXT
 * 7. Text Layout Design (Claude) - NEW
 * 8. Figma Assembly (Figma MCP) - Text overlays
 */

import { fetchTodayPosts, fetchBrandHub, fetchBrandHubFromPostgres, resolveMcpApiKey } from './mcpClient.mjs';
import { getTenantMcpKey } from './db.mjs';
import {
  runStep1_CarouselPlan,
  runStep2_VisualStyleDirection,
  runStep3_ChooseTemplates,
  runStep4_ApplyBrandHub,
  runStep5_FormatCaption,
  buildTextAwareBlueprint,
  runStep8_FigmaAssembly,
} from './claudeOrchestrator.mjs';
import { generateCarouselImages } from './imageGenerator.mjs';
import { assembleCarouselWithTextOverlays, exportFrames } from './figmaIntegration.mjs';
import { loadCarouselProfile } from './carouselProfile.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import {
  logGenerationStart,
  logGenerationComplete,
  logGenerationError,
  logStepStart,
  logStepComplete,
  logStepError,
  logResumeAttempt,
  logFigmaJobCreated,
  logFigmaJobClaimed,
  logFigmaJobComplete,
} from './carouselLogger.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Crypto for token generation
import crypto from 'crypto';

/**
 * Load carousel content options from JSON file
 */
async function loadCarouselContentOptions() {
  const optionsPath = join(__dirname, '../data/carousel-content-options.json');
  const content = await readFile(optionsPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load Figma templates metadata from JSON file
 */
async function loadFigmaTemplatesMetadata() {
  const templatesPath = join(__dirname, '../data/figma-templates.json');
  const content = await readFile(templatesPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Insert generation record immediately so the UI can poll before MCP fetch finishes.
 */
async function createGenerationRecord(db, tenantId, accountId, postId) {
  const query = `
    INSERT INTO carousel_generations (
      tenant_id,
      account_id,
      selected_post_id,
      post_prompt,
      post_text,
      status,
      steps_completed,
      current_step,
      started_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
    RETURNING id
  `;

  const result = await db.query(query, [
    tenantId,
    accountId,
    postId,
    '',
    '',
    'running',
    0,
    'fetching_input',
  ]);

  return result.rows[0].id;
}

async function updateGenerationPost(db, generationId, prompt, body) {
  await db.query(
    `UPDATE carousel_generations SET post_prompt = $2, post_text = $3 WHERE id = $1`,
    [generationId, prompt, body],
  );
}

function sanitizeStep6ForJson(step6) {
  if (!step6 || !Array.isArray(step6.images)) return step6;
  return {
    ...step6,
    images: step6.images.map((img) => ({
      ...img,
      assetRef: img.assetRef ? `[image slide_${img.slideIndex}]` : null,
    })),
  };
}

function isUsableAssetRef(ref) {
  return (
    typeof ref === 'string' &&
    (ref.startsWith('data:image/') ||
      ref.startsWith('https://') ||
      ref.startsWith('http://') ||
      ref.startsWith('/api/carousel/assets/'))
  );
}

function step6HasUsableImages(step6) {
  return (step6?.images || []).some((img) => isUsableAssetRef(img.assetRef));
}

function carouselAssetDir(generationId) {
  return join(__dirname, '../data/carousel-assets', generationId);
}

async function persistStep6Images(generationId, step6) {
  if (!step6?.images?.length) return step6;

  const dir = carouselAssetDir(generationId);
  await mkdir(dir, { recursive: true });

  for (const image of step6.images) {
    if (!image.assetRef || image.status !== 'generated') continue;

    const filename = `slide_${image.slideIndex}.png`;
    const filePath = join(dir, filename);

    if (image.assetRef.startsWith('data:')) {
      const comma = image.assetRef.indexOf(',');
      const b64 = comma >= 0 ? image.assetRef.slice(comma + 1) : image.assetRef;
      await writeFile(filePath, Buffer.from(b64, 'base64'));
    } else if (image.assetRef.startsWith('http://') || image.assetRef.startsWith('https://')) {
      const response = await fetch(image.assetRef);
      if (!response.ok) {
        throw new Error(`Failed to download slide ${image.slideIndex}: ${response.statusText}`);
      }
      await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    } else {
      continue;
    }

    image.assetRef = `/api/carousel/assets/${generationId}/${filename}`;
  }

  return step6;
}

export function resolveCarouselAssetPath(generationId, filename) {
  if (!/^[0-9a-f-]{36}$/i.test(generationId) || !/^(?:slide_\d+|logo)\.png$/.test(filename)) {
    return null;
  }
  return join(carouselAssetDir(generationId), filename);
}

async function persistProfileLogo(generationId, logoValue) {
  const logoUrl = typeof logoValue === 'string' ? logoValue : logoValue?.url;
  if (!logoUrl || !/^https?:\/\//i.test(logoUrl)) return logoValue || null;
  const response = await fetch(logoUrl);
  if (!response.ok) {
    console.warn(`[Carousel] Unable to download profile logo: ${response.status}`);
    return logoValue;
  }
  const dir = carouselAssetDir(generationId);
  await mkdir(dir, { recursive: true });
  const png = await sharp(Buffer.from(await response.arrayBuffer())).png().toBuffer();
  await writeFile(join(dir, 'logo.png'), png);
  return `/api/carousel/assets/${generationId}/logo.png`;
}

/**
 * Update generation status
 */
async function updateGenerationStatus(
  db,
  generationId,
  status,
  stepsCompleted,
  currentStep = null,
  error = null
) {
  const query = `
    UPDATE carousel_generations
    SET 
      status = $2,
      steps_completed = $3,
      current_step = $4,
      error = $5,
      finished_at = CASE WHEN $2 IN ('completed', 'failed') THEN now() ELSE NULL END
    WHERE id = $1
  `;

  await db.query(query, [generationId, status, stepsCompleted, currentStep, error]);
}

/**
 * Store step output in carousel_generation_outputs table
 */
async function storeStepOutput(
  db,
  generationId,
  stepNumber,
  stepName,
  inputJson,
  outputJson,
  durationMs,
  error = null
) {
  const query = `
    INSERT INTO carousel_generation_outputs (
      generation_id,
      step_number,
      step_name,
      input_json,
      output_json,
      duration_ms,
      error,
      completed_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, now())
  `;

  await db.query(query, [
    generationId,
    stepNumber,
    stepName,
    inputJson,
    outputJson,
    durationMs,
    error,
  ]);
}

/**
 * Store final results in generation record
 */
async function storeFinalResults(db, generationId, caption, figmaFileUrl, imageUrls) {
  const query = `
    UPDATE carousel_generations
    SET 
      final_caption = $2,
      figma_file_url = $3,
      image_urls = $4
    WHERE id = $1
  `;

  await db.query(query, [generationId, caption, figmaFileUrl, imageUrls]);
}

function completedStepCount(stepOutputs) {
  let n = 0;
  for (let i = 1; i <= 8; i++) {
    if (!stepOutputs[`step${i}`]) break;
    n = i;
  }
  return n;
}

const STEP_KEYS = [
  'fetching_input',
  'step_1_carousel_plan',
  'step_2_visual_direction',
  'step_3_templates',
  'step_4_brandhub',
  'step_5_caption',
  'step_6_visuals',
  'step_7_text_layout',
  'step_8_figma_assembly',
];

/**
 * Reload a failed generation and continue from the first missing step.
 */
export async function resumeInstagramCarousel(db, tenantId, generationId) {
  const result = await db.query(
    `SELECT id, account_id, selected_post_id, status, steps_completed
     FROM carousel_generations
     WHERE id = $1 AND tenant_id = $2`,
    [generationId, tenantId],
  );

  if (result.rows.length === 0) {
    throw new Error('Generation not found for this account');
  }

  const row = result.rows[0];

  const outputsResult = await db.query(
    `SELECT step_number, output_json
     FROM carousel_generation_outputs
     WHERE generation_id = $1
     ORDER BY step_number ASC`,
    [generationId],
  );

  const existingOutputs = {};
  for (const outputRow of outputsResult.rows) {
    existingOutputs[`step${outputRow.step_number}`] = outputRow.output_json;
  }

  if (existingOutputs.step6 && !step6HasUsableImages(existingOutputs.step6)) {
    console.log(`[Carousel] Step 6 images were not persisted — will regenerate visuals`);
    delete existingOutputs.step6;
    delete existingOutputs.step8;
    await db.query(
      `DELETE FROM carousel_generation_outputs
       WHERE generation_id = $1 AND step_number = ANY($2::int[])`,
      [generationId, [6, 8]],
    );
  }

  const completed = completedStepCount(existingOutputs);
  if (completed < 1) {
    throw new Error('Nothing to resume — no completed steps were saved');
  }

  if (row.status === 'completed' && step6HasUsableImages(existingOutputs.step6) && existingOutputs.step8) {
    throw new Error('Generation already completed');
  }

  const nextStep = Math.min(completed + 1, 8);
  await updateGenerationStatus(
    db,
    generationId,
    'running',
    completed,
    STEP_KEYS[nextStep],
    null,
  );

  logResumeAttempt({
    generationId,
    tenantId,
    accountId: row.account_id,
    fromStep: nextStep,
    reason: `Resuming from step ${completed}, ${completed} steps already saved`,
  });
  console.log(`[Carousel] Resuming ${generationId} from step ${nextStep} (${completed} steps saved)`);

  return {
    generationId,
    status: 'running',
    resumedFromStep: nextStep,
    postId: row.selected_post_id,
    accountId: row.account_id,
    existingOutputs,
  };
}

/**
 * Create a running generation row and return its id. The pipeline runs separately.
 */
export async function startInstagramCarousel(db, tenantId, postId, accountId) {
  const generationId = await createGenerationRecord(db, tenantId, accountId, postId);
  console.log(`[Carousel] Created generation record: ${generationId}`);
  return { generationId, status: 'running' };
}

/**
 * Main generation handler - orchestrates all 8 steps.
 * `generationId` must already exist (from startInstagramCarousel).
 */
export async function generateInstagramCarousel(
  db,
  tenantId,
  postId,
  accountId,
  generationId,
  existingOutputs = {},
) {
  const stepOutputs = { ...existingOutputs };
  const pipelineStart = Date.now();

  if (!generationId) {
    throw new Error('generationId is required; call startInstagramCarousel first');
  }

  try {
    const resumeFrom = completedStepCount(stepOutputs) + 1;
    const carouselProfile = await loadCarouselProfile(db, tenantId, accountId, generationId);
    if (resumeFrom > 1) {
      console.log(`[Carousel] Continuing ${generationId} from step ${resumeFrom} for post ${postId}...`);
    } else {
      console.log(`[Carousel] Starting generation for post ${postId}...`);
      logGenerationStart({ 
        generationId, 
        tenantId, 
        accountId, 
        postId, 
        postTitle: 'Post title pending fetch' 
      });
    }

    let brandHub;
    let normalizedPost = { id: postId, prompt: '', body: '' };
    let carouselContentOptions;
    let figmaTemplatesMetadata;
    const needsInputs = !stepOutputs.step1 || !stepOutputs.step2 || !stepOutputs.step3 || !stepOutputs.step4;

    if (needsInputs) {
    // Step 0: Fetch input data
    const step0Start = Date.now();
    logStepStart({ 
      generationId, 
      tenantId, 
      accountId, 
      step: 0, 
      stepName: 'fetching_input',
      input: { postId, accountId } 
    });
    console.log('[Carousel] Step 0: Fetching input data...');
    await updateGenerationStatus(db, generationId, 'running', completedStepCount(stepOutputs), 'fetching_input');

    const tenantKey = await getTenantMcpKey(db, tenantId);
    const apiKey = resolveMcpApiKey(tenantKey);
    if (!apiKey) {
      throw new Error('This account is not connected. Paste the full MCP URL to continue.');
    }

    // Fetch posts from upstream MCP to find the selected one
    const postsResponse = await fetchTodayPosts(accountId, apiKey);
    console.log(`[Carousel] Fetched ${postsResponse.totalCount} posts from MCP`);
    
    // Find the selected post by ID
    const selectedPost = postsResponse.posts.find(p => p.id === postId);
    
    if (!selectedPost) {
      throw new Error(`Post ${postId} was not found. Make sure it exists and was generated in the last 14 days.`);
    }

    console.log(`[Carousel] Selected post: "${selectedPost.prompt || selectedPost.title || 'Untitled'}"`);

    // Normalize post fields (ensure prompt and body exist)
    normalizedPost = {
      id: selectedPost.id,
      prompt: selectedPost.prompt || selectedPost.title || 'Untitled Post',
      body: selectedPost.body || '',
      topic: selectedPost.topic || 'General',
      createdAt: selectedPost.createdAt || new Date().toISOString(),
    };

    // Fetch BrandHub data from MCP (with Postgres fallback)
    try {
      brandHub = await fetchBrandHub(accountId, apiKey);
      console.log(`[Carousel] Fetched BrandHub from MCP for account: ${brandHub.title}`);
    } catch (mcpError) {
      console.warn('[Carousel] MCP BrandHub fetch failed, trying Postgres fallback:', mcpError.message);
      try {
        brandHub = await fetchBrandHubFromPostgres(db, accountId);
        console.log(`[Carousel] Fetched BrandHub from Postgres for account: ${brandHub.title}`);
      } catch (pgError) {
        console.error('[Carousel] Both MCP and Postgres BrandHub fetch failed:', pgError.message);
        throw new Error(`Failed to fetch BrandHub: ${mcpError.message} (MCP), ${pgError.message} (Postgres)`);
      }
    }

    // Load carousel content options
    carouselContentOptions = await loadCarouselContentOptions();
    console.log(`[Carousel] Loaded ${carouselContentOptions.length} content options`);

    // Load Figma templates metadata
    figmaTemplatesMetadata = await loadFigmaTemplatesMetadata();
    console.log(`[Carousel] Loaded ${figmaTemplatesMetadata.length} Figma templates`);

    await updateGenerationPost(db, generationId, normalizedPost.prompt, normalizedPost.body);
    
    const step0Duration = Date.now() - step0Start;
    logStepComplete({
      generationId,
      tenantId,
      accountId,
      step: 0,
      stepName: 'fetching_input',
      output: { 
        postPrompt: normalizedPost.prompt?.substring(0, 100),
        brandHubTitle: brandHub?.title,
        contentOptionsCount: carouselContentOptions?.length,
        templatesCount: figmaTemplatesMetadata?.length,
      },
      durationMs: step0Duration,
    });
    } else {
      console.log('[Carousel] Skipping input fetch — earlier steps already saved');
    }

    // Step 1: Choose carousel content plan
    if (!stepOutputs.step1) {
    const step1Start = Date.now();
    logStepStart({
      generationId,
      tenantId,
      accountId,
      step: 1,
      stepName: 'carousel_plan',
      input: { promptLength: normalizedPost.prompt?.length, optionsCount: carouselContentOptions?.length },
    });
    console.log('[Carousel] Step 1: Choosing carousel content plan...');
    await updateGenerationStatus(db, generationId, 'running', 0, 'step_1_carousel_plan');

    stepOutputs.step1 = await runStep1_CarouselPlan({
      prompt: normalizedPost.prompt,
      postBody: normalizedPost.body,
      carouselContentOptions,
      brandHub,
      carouselProfile,
      generationId,
      tenantId,
      accountId,
    });
    if (Array.isArray(stepOutputs.step1.slides) && stepOutputs.step1.slides.length > 5) {
      stepOutputs.step1.slides = stepOutputs.step1.slides.slice(0, 5);
    }
    stepOutputs.step1.slideCount = stepOutputs.step1.slides?.length || stepOutputs.step1.slideCount;

    const step1Duration = Date.now() - step1Start;
    await storeStepOutput(
      db,
      generationId,
      1,
      'step_1_carousel_plan',
      { prompt: normalizedPost.prompt },
      stepOutputs.step1,
      step1Duration
    );
    await updateGenerationStatus(db, generationId, 'running', 1);
    logStepComplete({
      generationId,
      tenantId,
      accountId,
      step: 1,
      stepName: 'carousel_plan',
      output: { slideCount: stepOutputs.step1.slideCount, template: stepOutputs.step1.template },
      durationMs: step1Duration,
    });
    console.log(`[Carousel] Step 1 completed in ${step1Duration}ms`);
    } else {
      console.log('[Carousel] Skipping Step 1 (already saved)');
    }

    // Step 2: Visual Style Direction (NEW)
    if (!stepOutputs.step2) {
    const step2Start = Date.now();
    logStepStart({
      generationId,
      tenantId,
      accountId,
      step: 2,
      stepName: 'visual_direction',
      input: { slideCount: stepOutputs.step1?.slideCount, colorsCount: brandHub.brandColors?.length },
    });
    console.log('[Carousel] Step 2: Defining visual style direction...');
    await updateGenerationStatus(db, generationId, 'running', 1, 'step_2_visual_direction');

    stepOutputs.step2 = await runStep2_VisualStyleDirection({
      step1Output: stepOutputs.step1,
      brandHub,
      carouselProfile,
      generationId,
      tenantId,
      accountId,
    });
    if (Array.isArray(stepOutputs.step2.perSlideVisuals) && stepOutputs.step2.perSlideVisuals.length > 5) {
      stepOutputs.step2.perSlideVisuals = stepOutputs.step2.perSlideVisuals.slice(0, 5);
    }

    const step2Duration = Date.now() - step2Start;
    await storeStepOutput(
      db,
      generationId,
      2,
      'step_2_visual_direction',
      { step1Output: stepOutputs.step1 },
      stepOutputs.step2,
      step2Duration
    );
    await updateGenerationStatus(db, generationId, 'running', 2);
    logStepComplete({
      generationId,
      tenantId,
      accountId,
      step: 2,
      stepName: 'visual_direction',
      output: { 
        visualsCount: stepOutputs.step2.perSlideVisuals?.length, 
        theme: stepOutputs.step2.visualTheme?.name 
      },
      durationMs: step2Duration,
    });
    console.log(`[Carousel] Step 2 completed in ${step2Duration}ms`);
    } else {
      console.log('[Carousel] Skipping Step 2 (already saved)');
    }

    // Step 3: Choose visual templates
    if (!stepOutputs.step3) {
    const step3Start = Date.now();
    logStepStart({
      generationId,
      tenantId,
      accountId,
      step: 3,
      stepName: 'templates',
      input: { templatesCount: figmaTemplatesMetadata?.length },
    });
    console.log('[Carousel] Step 3: Choosing visual templates...');
    await updateGenerationStatus(db, generationId, 'running', 2, 'step_3_templates');

    stepOutputs.step3 = await runStep3_ChooseTemplates({
      step1Output: stepOutputs.step1,
      step2Output: stepOutputs.step2,
      templates: figmaTemplatesMetadata,
      carouselProfile,
      generationId,
      tenantId,
      accountId,
    });

    const step3Duration = Date.now() - step3Start;
    await storeStepOutput(
      db,
      generationId,
      3,
      'step_3_templates',
      { step1Output: stepOutputs.step1, step2Output: stepOutputs.step2 },
      stepOutputs.step3,
      step3Duration
    );
    await updateGenerationStatus(db, generationId, 'running', 3);
    logStepComplete({
      generationId,
      tenantId,
      accountId,
      step: 3,
      stepName: 'templates',
      output: { selectedTemplatesCount: stepOutputs.step3.selectedTemplates?.length },
      durationMs: step3Duration,
    });
    console.log(`[Carousel] Step 3 completed in ${step3Duration}ms`);
    } else {
      console.log('[Carousel] Skipping Step 3 (already saved)');
    }

    // Step 4: Apply BrandHub
    if (!stepOutputs.step4) {
    const step4Start = Date.now();
    logStepStart({
      generationId,
      tenantId,
      accountId,
      step: 4,
      stepName: 'brandhub',
      input: { brandHubTitle: brandHub?.title, postTextLength: normalizedPost.body?.length },
    });
    console.log('[Carousel] Step 4: Applying BrandHub...');
    await updateGenerationStatus(db, generationId, 'running', 3, 'step_4_brandhub');

    stepOutputs.step4 = await runStep4_ApplyBrandHub({
      step1Output: stepOutputs.step1,
      step2Output: stepOutputs.step2,
      step3Output: stepOutputs.step3,
      brandHub,
      postText: normalizedPost.body,
      carouselProfile,
      generationId,
      tenantId,
      accountId,
    });
    if (carouselProfile.logo?.enabled) {
      const logoAsset = await persistProfileLogo(
        generationId,
        stepOutputs.step4?.brand?.logo || brandHub?.logo,
      );
      stepOutputs.step4.brand.logo = logoAsset;
      stepOutputs.step4.slides = (stepOutputs.step4.slides || []).map((slide) => ({
        ...slide,
        logoAsset,
      }));
    }

    const step4Duration = Date.now() - step4Start;
    await storeStepOutput(
      db,
      generationId,
      4,
      'step_4_brandhub',
      { brandHub, postText: normalizedPost.body },
      stepOutputs.step4,
      step4Duration
    );
    await updateGenerationStatus(db, generationId, 'running', 4);
    logStepComplete({
      generationId,
      tenantId,
      accountId,
      step: 4,
      stepName: 'brandhub',
      output: { slidesCount: stepOutputs.step4.slides?.length },
      durationMs: step4Duration,
    });
    console.log(`[Carousel] Step 4 completed in ${step4Duration}ms`);
    } else {
      console.log('[Carousel] Skipping Step 4 (already saved)');
    }

    // Step 7 blueprint is intentionally created before image generation.
    if (!stepOutputs.step7) {
      const step7Start = Date.now();
      logStepStart({
        generationId,
        tenantId,
        accountId,
        step: 7,
        stepName: 'pre_image_text_blueprint',
        input: { slidesCount: stepOutputs.step4?.slides?.length },
      });
      console.log('[Carousel] Step 7: Creating editable text blueprint before images...');
      stepOutputs.step7 = buildTextAwareBlueprint(
        stepOutputs.step4,
        stepOutputs.step2,
        stepOutputs.step3,
        carouselProfile,
      );
      const step7Duration = Date.now() - step7Start;
      await storeStepOutput(
        db,
        generationId,
        7,
        'step_7_text_blueprint',
        { step4Output: stepOutputs.step4, step2Output: stepOutputs.step2 },
        stepOutputs.step7,
        step7Duration,
      );
      logStepComplete({
        generationId,
        tenantId,
        accountId,
        step: 7,
        stepName: 'pre_image_text_blueprint',
        output: { slidesCount: stepOutputs.step7.slides?.length },
        durationMs: step7Duration,
      });
    }

    // Step 5: Format caption for Instagram
    if (!stepOutputs.step5) {
    const step5Start = Date.now();
    logStepStart({
      generationId,
      tenantId,
      accountId,
      step: 5,
      stepName: 'caption',
      input: { step4SlidesCount: stepOutputs.step4?.slides?.length },
    });
    console.log('[Carousel] Step 5: Formatting caption for Instagram...');
    await updateGenerationStatus(db, generationId, 'running', 4, 'step_5_caption');

    stepOutputs.step5 = await runStep5_FormatCaption({
      step4Output: stepOutputs.step4,
      generationId,
      tenantId,
      accountId,
    });

    const step5Duration = Date.now() - step5Start;
    await storeStepOutput(
      db,
      generationId,
      5,
      'step_5_caption',
      { step4Output: stepOutputs.step4 },
      stepOutputs.step5,
      step5Duration
    );
    await updateGenerationStatus(db, generationId, 'running', 5);
    logStepComplete({
      generationId,
      tenantId,
      accountId,
      step: 5,
      stepName: 'caption',
      output: { captionLength: stepOutputs.step5.instagramCaption?.fullText?.length },
      durationMs: step5Duration,
    });
    console.log(`[Carousel] Step 5 completed in ${step5Duration}ms`);
    } else {
      console.log('[Carousel] Skipping Step 5 (already saved)');
    }

    // Step 6: Generate carousel visuals (GPT Image 2 - NO TEXT)
    if (!stepOutputs.step6) {
    const step6Start = Date.now();
    logStepStart({
      generationId,
      tenantId,
      accountId,
      step: 6,
      stepName: 'visuals',
      input: { visualsToGenerate: stepOutputs.step2?.perSlideVisuals?.length },
    });
    console.log('[Carousel] Step 6: Generating carousel visuals (GPT Image 2)...');
    await updateGenerationStatus(db, generationId, 'running', 5, 'step_6_visuals');

    stepOutputs.step6 = await persistStep6Images(
      generationId,
      await generateCarouselImages(
        stepOutputs.step2,
        stepOutputs.step4,
        stepOutputs.step7,
        generationId,
        tenantId,
        accountId,
        carouselProfile,
      ),
    );

    const generatedImages = (stepOutputs.step6.images || []).filter((img) => img.status === 'generated');
    const failedImages = (stepOutputs.step6.images || []).filter((img) => img.status === 'failed');
    if (generatedImages.length === 0 && failedImages.length > 0) {
      const firstError = failedImages[0]?.error || 'unknown error';
      throw new Error(`GPT Image 2 failed for all ${failedImages.length} slides: ${firstError}`);
    }

    const step6Duration = Date.now() - step6Start;
    await storeStepOutput(
      db,
      generationId,
      6,
      'step_6_visuals',
      { step2Output: stepOutputs.step2, step4Output: stepOutputs.step4 },
      stepOutputs.step6,
      step6Duration
    );
    await updateGenerationStatus(db, generationId, 'running', 6);
    logStepComplete({
      generationId,
      tenantId,
      accountId,
      step: 6,
      stepName: 'visuals',
      output: { 
        generatedCount: generatedImages.length, 
        failedCount: failedImages.length,
        totalImages: stepOutputs.step6.images?.length 
      },
      durationMs: step6Duration,
    });
    console.log(`[Carousel] Step 6 completed in ${step6Duration}ms`);
    } else {
      console.log('[Carousel] Skipping Step 6 (already saved)');
    }

    // Step 7 already exists: its geometry was created before Step 6 so the
    // generated art could protect the exact native-text rectangle.
    if (!stepOutputs.step7) {
      stepOutputs.step7 = buildTextAwareBlueprint(
        stepOutputs.step4,
        stepOutputs.step2,
        stepOutputs.step3,
        carouselProfile,
      );
    }

    // Step 8: Assemble in Figma with text overlays
    let figmaResult = { note: 'Figma file pending MCP integration' };
    if (!stepOutputs.step8) {
    const step8Start = Date.now();
    logStepStart({
      generationId,
      tenantId,
      accountId,
      step: 8,
      stepName: 'figma_assembly',
      input: { slidesCount: stepOutputs.step7?.slides?.length },
    });
    console.log('[Carousel] Step 8: Assembling in Figma with text overlays...');
    await updateGenerationStatus(db, generationId, 'running', 7, 'step_8_figma_assembly');

    stepOutputs.step8 = await runStep8_FigmaAssembly({
      step2Output: stepOutputs.step2,
      step3Output: stepOutputs.step3,
      step4Output: stepOutputs.step4,
      step5Output: stepOutputs.step5,
      step6Output: sanitizeStep6ForJson(stepOutputs.step6),
      step7Output: stepOutputs.step7,
      carouselProfile,
      generationId,
      tenantId,
      accountId,
    });

    // Assemble the carousel using Figma MCP
    figmaResult = await assembleCarouselWithTextOverlays(
      stepOutputs.step7,
      stepOutputs.step6,
      stepOutputs.step5,
      stepOutputs.step2.visualTheme,
      carouselProfile,
    );

    const step8Duration = Date.now() - step8Start;
    await storeStepOutput(
      db,
      generationId,
      8,
      'step_8_figma_assembly',
      { allSteps: 'combined' },
      { ...stepOutputs.step8, figmaResult },
      step8Duration
    );
    await updateGenerationStatus(db, generationId, 'running', 8);
    logStepComplete({
      generationId,
      tenantId,
      accountId,
      step: 8,
      stepName: 'figma_assembly',
      output: { figmaResultNote: figmaResult?.note },
      durationMs: step8Duration,
    });
    console.log(`[Carousel] Step 8 completed in ${step8Duration}ms`);
    }

    // Store final results
    const imageUrls = (stepOutputs.step6.images || [])
      .map((img) => img.assetRef)
      .filter(
        (ref) =>
          typeof ref === 'string' &&
          (ref.startsWith('data:') ||
            ref.startsWith('https://') ||
            ref.startsWith('http://') ||
            ref.startsWith('/api/carousel/assets/')),
      );

    const figmaFileUrl =
      typeof figmaResult?.fileUrl === 'string' && figmaResult.fileUrl.startsWith('https://www.figma.com/')
        ? figmaResult.fileUrl
        : typeof figmaResult?.url === 'string' && figmaResult.url.startsWith('https://www.figma.com/')
          ? figmaResult.url
          : null;

    await storeFinalResults(
      db,
      generationId,
      stepOutputs.step5.instagramCaption.fullText,
      figmaFileUrl,
      imageUrls
    );

    await updateGenerationStatus(db, generationId, 'completed', 8);
    const pipelineDuration = Date.now() - pipelineStart;
    logGenerationComplete({
      generationId,
      tenantId,
      accountId,
      durationMs: pipelineDuration,
      stepsCompleted: 8,
    });
    console.log(`[Carousel] Generation ${generationId} completed successfully!`);

    return {
      generationId,
      status: 'completed',
      steps: stepOutputs,
      finalCaption: stepOutputs.step5.instagramCaption.fullText,
      imageUrls,
      figmaResult,
    };
  } catch (error) {
    const pipelineDuration = Date.now() - pipelineStart;
    logGenerationError({
      generationId,
      tenantId,
      accountId,
      error,
      step: completedStepCount(stepOutputs),
      durationMs: pipelineDuration,
    });
    console.error('[Carousel] Generation failed:', error);

    if (generationId) {
      await updateGenerationStatus(
        db,
        generationId,
        'failed',
        Object.keys(stepOutputs).length,
        null,
        error.message
      );
    }

    throw error;
  }
}

/**
 * Get generation status for polling
 */
export async function getGenerationStatus(db, generationId) {
  const query = `
    SELECT 
      id,
      status,
      steps_completed,
      current_step,
      created_at,
      started_at,
      finished_at,
      error,
      final_caption,
      figma_file_url,
      image_urls
    FROM carousel_generations
    WHERE id = $1
  `;

  const result = await db.query(query, [generationId]);

  if (result.rows.length === 0) {
    throw new Error(`Generation ${generationId} not found`);
  }

  const generation = result.rows[0];

  // Fetch step outputs
  const outputsQuery = `
    SELECT 
      step_number,
      step_name,
      output_json,
      duration_ms,
      error,
      completed_at
    FROM carousel_generation_outputs
    WHERE generation_id = $1
    ORDER BY step_number ASC
  `;

  const outputsResult = await db.query(outputsQuery, [generationId]);

  return {
    ...generation,
    stepOutputs: outputsResult.rows,
    progress: {
      current: generation.steps_completed,
      total: 8,
      percentage: Math.round((generation.steps_completed / 8) * 100),
    },
  };
}

/**
 * List recent generations for a tenant
 */
export async function listGenerations(db, tenantId, limit = 20) {
  const query = `
    SELECT 
      id,
      account_id,
      selected_post_id,
      post_prompt,
      status,
      steps_completed,
      created_at,
      finished_at,
      error,
      image_urls,
      figma_file_url
    FROM carousel_generations
    WHERE tenant_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  const result = await db.query(query, [tenantId, limit]);
  return result.rows;
}

/**
 * FIGMA JOB API
 * Functions for managing Figma plugin import jobs
 */

/**
 * Generate a random import code (8 chars, URL-safe)
 */
function generateImportCode() {
  return crypto.randomBytes(6).toString('base64url').substring(0, 8);
}

/**
 * Hash an import code for storage
 */
function hashImportCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Create a Figma import job for a completed generation
 */
export async function createFigmaJob(db, generationId, tenantId, accountId) {
  // Verify generation exists and is completed
  const genResult = await db.query(
    `SELECT id, status FROM carousel_generations WHERE id = $1 AND tenant_id = $2`,
    [generationId, tenantId]
  );
  
  if (genResult.rows.length === 0) {
    throw new Error('Generation not found');
  }
  
  if (genResult.rows[0].status !== 'completed') {
    throw new Error('Generation must be completed before creating a Figma job');
  }

  await db.query(
    `UPDATE carousel_figma_jobs
     SET status = 'failed', error = $2
     WHERE generation_id = $1
       AND status IN ('queued', 'claimed', 'importing')`,
    [generationId, 'Superseded by a new import code'],
  )
  
  // Generate import code and hash it
  const importCode = generateImportCode();
  const importTokenHash = hashImportCode(importCode);
  
  const query = `
    INSERT INTO carousel_figma_jobs (
      generation_id,
      tenant_id,
      account_id,
      import_token_hash,
      status
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, created_at, expires_at
  `;
  
  const result = await db.query(query, [
    generationId,
    tenantId,
    accountId,
    importTokenHash,
    'queued'
  ]);
  
  const job = result.rows[0];
  
  logFigmaJobCreated({
    generationId,
    tenantId,
    accountId,
    jobId: job.id,
    importCode,
  });
  
  return {
    jobId: job.id,
    importCode, // Only returned here, never stored or returned again
    expiresAt: job.expires_at,
  };
}

/**
 * Claim a Figma job using the import code (called by plugin)
 */
export async function claimFigmaJob(db, importCode) {
  const importTokenHash = hashImportCode(importCode);
  
  const query = `
    UPDATE carousel_figma_jobs
    SET status = 'claimed', claimed_at = now()
    WHERE import_token_hash = $1
      AND status IN ('queued', 'claimed', 'importing', 'failed')
      AND expires_at > now()
    RETURNING id, generation_id, tenant_id, account_id
  `;
  
  const result = await db.query(query, [importTokenHash]);
  
  if (result.rows.length === 0) {
    throw new Error('Invalid import code or job already claimed/expired');
  }
  
  const job = result.rows[0];
  
  logFigmaJobClaimed({
    jobId: job.id,
    generationId: job.generation_id,
    tenantId: job.tenant_id,
    accountId: job.account_id,
    claimedAt: new Date().toISOString(),
  });
  
  // Return the generation data needed by the plugin
  const genResult = await getGenerationForFigmaJob(db, job.generation_id);
  
  return {
    jobId: job.id,
    generationId: job.generation_id,
    generation: genResult,
  };
}

/**
 * Get generation data for Figma job (includes all step outputs and assets)
 */
async function getGenerationForFigmaJob(db, generationId) {
  const genQuery = `
    SELECT 
      id,
      post_prompt,
      post_text,
      final_caption,
      image_urls
    FROM carousel_generations
    WHERE id = $1
  `;
  
  const genResult = await db.query(genQuery, [generationId]);
  
  if (genResult.rows.length === 0) {
    throw new Error('Generation not found');
  }
  
  const generation = genResult.rows[0];
  
  // Get all step outputs
  const outputsQuery = `
    SELECT step_number, step_name, output_json
    FROM carousel_generation_outputs
    WHERE generation_id = $1
    ORDER BY step_number ASC
  `;
  
  const outputsResult = await db.query(outputsQuery, [generationId]);
  
  const stepOutputs = {};
  for (const row of outputsResult.rows) {
    stepOutputs[`step${row.step_number}`] = row.output_json;
  }
  
  return {
    ...generation,
    stepOutputs,
  };
}

/**
 * Update Figma job status
 */
export async function updateFigmaJobStatus(db, importCode, status, error = null) {
  const importTokenHash = hashImportCode(importCode);
  
  const query = `
    UPDATE carousel_figma_jobs
    SET status = $2, error = $3
    WHERE import_token_hash = $1
    RETURNING id, generation_id, tenant_id, account_id
  `;
  
  const result = await db.query(query, [importTokenHash, status, error]);
  
  if (result.rows.length === 0) {
    throw new Error('Job not found');
  }
  
  return result.rows[0];
}

/**
 * Complete a Figma job with final assets
 */
export async function completeFigmaJob(db, importCode, completionData) {
  const importTokenHash = hashImportCode(importCode);
  const { figmaFileKey, figmaPageId, figmaPageName, figmaFileUrl, exportedSlideUrls } = completionData;
  
  const query = `
    UPDATE carousel_figma_jobs
    SET 
      status = 'completed',
      figma_file_key = $2,
      figma_page_id = $3,
      figma_page_name = $4,
      figma_file_url = $5,
      exported_slide_urls = $6,
      completed_at = now()
    WHERE import_token_hash = $1 AND status = 'importing'
    RETURNING id, generation_id, tenant_id, account_id, figma_file_url
  `;
  
  const result = await db.query(query, [
    importTokenHash,
    figmaFileKey,
    figmaPageId,
    figmaPageName,
    figmaFileUrl,
    JSON.stringify(exportedSlideUrls)
  ]);
  
  if (result.rows.length === 0) {
    throw new Error('Job not found or not in importing state');
  }
  
  const job = result.rows[0];
  
  // Update the generation record with the Figma URL
  await db.query(
    `UPDATE carousel_generations SET figma_file_url = $2 WHERE id = $1`,
    [job.generation_id, figmaFileUrl]
  );
  
  logFigmaJobComplete({
    jobId: job.id,
    generationId: job.generation_id,
    tenantId: job.tenant_id,
    accountId: job.account_id,
    fileUrl: figmaFileUrl,
    pageUrl: figmaFileUrl, // Could be more specific with node-id
    durationMs: null, // Could calculate from created_at to completed_at
    framesCreated: exportedSlideUrls?.length || 0,
  });
  
  return {
    jobId: job.id,
    generationId: job.generation_id,
    figmaFileUrl: job.figma_file_url,
  };
}

/**
 * Get Figma job status (for polling)
 */
export async function getFigmaJobStatus(db, generationId) {
  const query = `
    SELECT 
      id,
      status,
      figma_file_url,
      exported_slide_urls,
      error,
      created_at,
      completed_at
    FROM carousel_figma_jobs
    WHERE generation_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  const result = await db.query(query, [generationId]);
  
  if (result.rows.length === 0) {
    return null;
  }
  
  return result.rows[0];
}

