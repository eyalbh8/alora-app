-- Instagram Carousel Generation Tables
-- Run this migration to add carousel generation tracking and storage

-- Main tracking table for carousel generation runs
CREATE TABLE IF NOT EXISTS carousel_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES whitelabel_tenants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL, -- iGEO Account ID
  selected_post_id UUID NOT NULL, -- iGEO post.id
  post_prompt TEXT NOT NULL,
  post_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  steps_completed INTEGER NOT NULL DEFAULT 0, -- 0-7 (7 main steps)
  current_step TEXT, -- step_1_carousel_plan, step_2_visual_direction, step_3_templates, step_4_brandhub, step_5_caption, step_6_visuals, step_7_text_layout, step_8_figma_assembly
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error TEXT,
  final_caption TEXT,
  figma_file_url TEXT,
  image_urls TEXT[], -- Array of generated image URLs
  profile_config JSONB, -- Immutable effective account profile used by this run
  CONSTRAINT carousel_generations_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

ALTER TABLE carousel_generations
  ADD COLUMN IF NOT EXISTS profile_config JSONB;

CREATE INDEX IF NOT EXISTS carousel_generations_tenant_id_idx ON carousel_generations(tenant_id);
CREATE INDEX IF NOT EXISTS carousel_generations_status_idx ON carousel_generations(status);
CREATE INDEX IF NOT EXISTS carousel_generations_created_at_idx ON carousel_generations(created_at DESC);

-- Step-by-step outputs storage
CREATE TABLE IF NOT EXISTS carousel_generation_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES carousel_generations(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL, -- 1-8 (Steps: 1=plan, 2=visual direction, 3=templates, 4=brandhub, 5=caption, 6=visuals, 7=text layout, 8=figma assembly)
  step_name TEXT NOT NULL, -- step_1_carousel_plan, step_2_visual_direction, step_3_templates, step_4_brandhub, step_5_caption, step_6_visuals, step_7_text_layout, step_8_figma_assembly
  input_json JSONB NOT NULL,
  output_json JSONB,
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT carousel_generation_outputs_step_number_check CHECK (step_number BETWEEN 1 AND 8)
);

CREATE INDEX IF NOT EXISTS carousel_generation_outputs_generation_id_idx ON carousel_generation_outputs(generation_id, step_number);

-- Figma template metadata cache
CREATE TABLE IF NOT EXISTS carousel_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  description TEXT,
  figma_file_key TEXT NOT NULL,
  figma_node_id TEXT NOT NULL,
  template_json JSONB, -- Full template structure from Figma
  zones JSONB, -- {headline: true, body: true, image: true, logo: true, accent: true}
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carousel_templates_template_name_idx ON carousel_templates(template_name);

-- Carousel content arc options (narrative structures)
CREATE TABLE IF NOT EXISTS carousel_content_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_name TEXT NOT NULL UNIQUE,
  slide_count INTEGER NOT NULL,
  narrative_structure TEXT NOT NULL,
  use_cases TEXT[],
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT carousel_content_options_slide_count_check CHECK (slide_count BETWEEN 3 AND 10)
);

CREATE INDEX IF NOT EXISTS carousel_content_options_option_name_idx ON carousel_content_options(option_name);

-- Tenant-owned carousel creation rules. Config is snapshotted onto each
-- generation so profile changes cannot alter an in-progress/resumed run.
CREATE TABLE IF NOT EXISTS carousel_account_profiles (
  tenant_id UUID PRIMARY KEY REFERENCES whitelabel_tenants(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES wl_accounts(id) ON DELETE CASCADE,
  profile_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id)
);

CREATE INDEX IF NOT EXISTS carousel_account_profiles_account_id_idx
  ON carousel_account_profiles(account_id);

-- Berkos is the first account-specific creative system. Re-running this seed is
-- safe and refreshes the profile only when the account can be resolved.
INSERT INTO carousel_account_profiles (tenant_id, account_id, profile_key, version, config)
SELECT
  account.tenant_id,
  account.id,
  'berkos-editorial-real-estate',
  1,
  $berkos${
    "name": "Berkos editorial real estate",
    "format": "instagram-square-1x1",
    "content": {
      "minSlides": 4,
      "maxSlides": 5,
      "narrativeRoles": ["market-stat", "location-leadership", "international-demand", "project-opportunity"],
      "headlineMaxWords": 8,
      "bodyMaxWords": 28
    },
    "palette": {
      "primary": "#061D3A",
      "secondary": "#F1E4D2",
      "accent": "#FFFFFF",
      "body": "#E2E5E9"
    },
    "typography": {
      "headlineFont": "Playfair Display",
      "headlineWeight": "700",
      "headlineItalicStyle": "Bold Italic",
      "bodyFont": "Inter",
      "bodyWeight": "400",
      "labelFont": "Inter",
      "labelWeight": "500"
    },
    "logo": {
      "enabled": true,
      "source": "brandHub",
      "anchor": "top-right",
      "width": 240,
      "maxHeight": 92,
      "marginX": 58,
      "marginY": 48
    },
    "imagePolicy": {
      "mode": "all-slides-photography",
      "allowedStyles": ["editorial-photography"],
      "bannedElements": ["generic abstract blobs", "3D objects", "decorative gradients", "floating icons", "cut-paper shapes"],
      "allowPurposefulGraphics": true,
      "purposefulGraphicRoles": ["international-demand"],
      "protectedTextPanel": false,
      "subject": "premium Cyprus residential property, Limassol skyline, Mediterranean coast, Berkos developments"
    },
    "readability": {
      "mode": "profile-scrim",
      "scrim": {
        "color": "#061D3A",
        "opacity": 0.78,
        "direction": "left-to-right"
      }
    },
    "layouts": [
      {"id":"editorial-left","roles":["hook","market-stat"],"textZoneBounds":{"x":54,"y":66,"width":570,"height":840},"alignment":"left","scrimDirection":"left-to-right"},
      {"id":"location-split","roles":["location-leadership","insight"],"textZoneBounds":{"x":54,"y":70,"width":610,"height":760},"alignment":"left","scrimDirection":"top-to-bottom"},
      {"id":"demand-graphic","roles":["international-demand","proof"],"textZoneBounds":{"x":54,"y":54,"width":620,"height":450},"alignment":"left","scrimDirection":"solid"},
      {"id":"project-hero","roles":["project-opportunity","cta"],"textZoneBounds":{"x":54,"y":54,"width":600,"height":830},"alignment":"left","scrimDirection":"left-to-right"}
    ],
    "viewerChrome": false
  }$berkos$::jsonb
FROM wl_accounts account
WHERE lower(account.title) LIKE '%berkos%'
ON CONFLICT (tenant_id) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  profile_key = EXCLUDED.profile_key,
  version = EXCLUDED.version,
  config = EXCLUDED.config,
  enabled = true,
  updated_at = now();

-- Comments
COMMENT ON TABLE carousel_generations IS 'Tracks Instagram carousel generation runs from post selection to final output (7 steps)';
COMMENT ON TABLE carousel_generation_outputs IS 'Stores input/output JSON for each step (Steps 1-8: plan, visual direction, templates, brandhub, caption, visuals, text layout, figma assembly)';
COMMENT ON TABLE carousel_templates IS 'Cached Figma template metadata for carousel layouts';
COMMENT ON TABLE carousel_content_options IS 'Available carousel narrative structures (listicles, how-tos, etc.)';
COMMENT ON TABLE carousel_account_profiles IS 'Tenant-specific, versioned carousel creation rules';
