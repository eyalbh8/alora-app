-- AlterTable
ALTER TABLE "whitelabel_tenants" ADD COLUMN "zernio_profile_id" TEXT;

-- CreateTable
CREATE TABLE "zernio_accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT,
    "display_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnected_at" TIMESTAMPTZ(6),

    CONSTRAINT "zernio_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_posts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "run_id" UUID,
    "igeo_post_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "zernio_post_id" TEXT,
    "zernio_account_id" TEXT,
    "platform_post_url" TEXT,
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "igeo_linked_at" TIMESTAMPTZ(6),
    "tracked_recommendation_id" TEXT,
    "link_error" TEXT,

    CONSTRAINT "published_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zernio_accounts_tenant_id_idx" ON "zernio_accounts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "zernio_accounts_tenant_id_platform_key" ON "zernio_accounts"("tenant_id", "platform");

-- CreateIndex
CREATE INDEX "published_posts_tenant_id_idx" ON "published_posts"("tenant_id");

-- CreateIndex
CREATE INDEX "published_posts_run_id_idx" ON "published_posts"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "published_posts_igeo_post_id_platform_key" ON "published_posts"("igeo_post_id", "platform");

-- AddForeignKey
ALTER TABLE "zernio_accounts" ADD CONSTRAINT "zernio_accounts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_posts" ADD CONSTRAINT "published_posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "whitelabel_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
