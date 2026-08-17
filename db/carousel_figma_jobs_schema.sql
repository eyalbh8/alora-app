-- Carousel Figma Job Schema
-- Tracks import jobs for the Figma plugin bridge

CREATE TABLE IF NOT EXISTS carousel_figma_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES carousel_generations(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  
  -- One-time access token for the Figma plugin (hashed)
  import_token_hash VARCHAR(64) NOT NULL UNIQUE,
  
  -- Job state
  status VARCHAR(50) NOT NULL DEFAULT 'queued', -- queued, claimed, importing, completed, failed
  
  -- Figma file details (populated by plugin)
  figma_file_key VARCHAR(255),
  figma_page_id VARCHAR(255),
  figma_page_name VARCHAR(255),
  figma_file_url TEXT,
  
  -- Export assets (uploaded by plugin after completion)
  exported_slide_urls JSONB, -- Array of {slideIndex: number, url: string}
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  claimed_at TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  
  -- Error tracking
  error TEXT,
  
  -- Audit
  plugin_version VARCHAR(50),
  plugin_user_info JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_figma_jobs_generation ON carousel_figma_jobs(generation_id);
CREATE INDEX IF NOT EXISTS idx_figma_jobs_tenant ON carousel_figma_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_figma_jobs_status ON carousel_figma_jobs(status);
CREATE INDEX IF NOT EXISTS idx_figma_jobs_token ON carousel_figma_jobs(import_token_hash);
CREATE INDEX IF NOT EXISTS idx_figma_jobs_expires ON carousel_figma_jobs(expires_at);

-- Comments
COMMENT ON TABLE carousel_figma_jobs IS 'Tracks Figma plugin import jobs for carousel generations';
COMMENT ON COLUMN carousel_figma_jobs.import_token_hash IS 'SHA-256 hash of one-time import code shown to user';
COMMENT ON COLUMN carousel_figma_jobs.status IS 'Job lifecycle: queued → claimed → importing → completed/failed';
COMMENT ON COLUMN carousel_figma_jobs.exported_slide_urls IS 'Final PNG exports uploaded by plugin after Figma assembly';
