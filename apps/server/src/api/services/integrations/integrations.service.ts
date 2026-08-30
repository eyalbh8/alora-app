import { Injectable, Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { ConfigService } from "../../../config/config.service";
import { SourceApiService } from "../source-api.service";
import { ZernioApiError, ZernioService } from "./zernio.service";
import {
  CONNECTABLE_ZERNIO_PLATFORMS,
  classifyIgeoBlogSite,
  isConnectablePlatform,
  MENCHLY_SOCIAL_PLATFORMS,
  MENCHLY_TO_ZERNIO,
  toMenchlyPlatform,
  toZernioPlatform,
  type IgeoBlogKind,
} from "./platform-map";

type BlogSiteRow = {
  id: string;
  name: string;
  url: string | null;
  kind: IgeoBlogKind;
};

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly zernio: ZernioService,
    private readonly sourceApi: SourceApiService,
  ) {}

  /** Lazily create a Zernio profile for the tenant and persist its id. */
  async ensureProfile(tenantId: string): Promise<string> {
    const tenant = await this.prisma.whitelabelTenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, zernioProfileId: true },
    });
    if (!tenant) {
      const err = new Error("Tenant not found") as Error & {
        statusCode: number;
      };
      err.statusCode = 404;
      throw err;
    }
    if (tenant.zernioProfileId) return tenant.zernioProfileId;

    const profile = await this.zernio.createProfile(
      `menchly_${tenant.id}`,
      tenant.name || `Menchly tenant ${tenant.id}`,
    );
    await this.prisma.whitelabelTenant.update({
      where: { id: tenantId },
      data: { zernioProfileId: profile.id },
    });
    return profile.id;
  }

  async listConnections(tenantId: string) {
    const accounts = await this.prisma.zernioAccount.findMany({
      where: { tenantId, status: "connected" },
      orderBy: { platform: "asc" },
    });

    const social = MENCHLY_SOCIAL_PLATFORMS.map((menchly) => {
      const zernioPlatform = MENCHLY_TO_ZERNIO[menchly];
      const account = accounts.find((a) => a.platform === zernioPlatform);
      return {
        platform: menchly,
        zernioPlatform,
        connected: Boolean(account),
        account: account
          ? {
              id: account.id,
              username: account.username,
              displayName: account.displayName,
              status: account.status,
              connectedAt: account.connectedAt,
            }
          : null,
      };
    });

    const igeoSites = await this.loadIgeoBlogSites(tenantId);
    const wordpressSites = igeoSites.filter((s) => s.kind === "wordpress");
    const lovableSites = igeoSites.filter((s) => s.kind === "lovable");

    const shopifyAccount = accounts.find((a) => a.platform === "shopify");

    const blog = [
      {
        provider: "wordpress" as const,
        managedBy: "igeo" as const,
        connected: wordpressSites.length > 0,
        sites: wordpressSites.map(({ id, name, url }) => ({ id, name, url })),
        account: null,
      },
      {
        provider: "lovable" as const,
        managedBy: "igeo" as const,
        connected: lovableSites.length > 0,
        sites: lovableSites.map(({ id, name, url }) => ({ id, name, url })),
        account: null,
      },
      {
        provider: "shopify" as const,
        managedBy: "zernio" as const,
        connected: Boolean(shopifyAccount),
        sites: [],
        account: shopifyAccount
          ? {
              id: shopifyAccount.id,
              username: shopifyAccount.username,
              displayName: shopifyAccount.displayName,
            }
          : null,
      },
    ];

    return {
      social,
      blog,
      connectablePlatforms: [...CONNECTABLE_ZERNIO_PLATFORMS, "shopify"],
    };
  }

  private async loadIgeoBlogSites(tenantId: string): Promise<BlogSiteRow[]> {
    try {
      const { accountId, apiKey } =
        await this.sourceApi.resolveCredentials(tenantId);
      const raw = await this.sourceApi.sourceRequest(
        accountId,
        apiKey,
        `/accounts/${accountId}/agents/blog/sites`,
      );
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { sites?: unknown[] })?.sites)
          ? (raw as { sites: unknown[] }).sites
          : Array.isArray((raw as { data?: unknown[] })?.data)
            ? (raw as { data: unknown[] }).data
            : [];
      return list
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const id = row.id ?? row.siteId ?? row.site_id;
          if (id == null) return null;
          const url =
            row.url != null
              ? String(row.url)
              : row.site != null
                ? String(row.site)
                : null;
          const name = String(row.name ?? row.title ?? row.url ?? id);
          const kind = classifyIgeoBlogSite({
            url,
            name,
            cms: row.cms != null ? String(row.cms) : null,
            provider: row.provider != null ? String(row.provider) : null,
            type: row.type != null ? String(row.type) : null,
            platform: row.platform != null ? String(row.platform) : null,
          });
          return { id: String(id), name, url, kind };
        })
        .filter((s): s is BlogSiteRow => Boolean(s));
    } catch (err) {
      this.logger.warn(
        `Failed to load blog sites for ${tenantId}: ${err instanceof Error ? err.message : err}`,
      );
      return [];
    }
  }

  async connect(
    tenantId: string,
    platformInput: string,
  ): Promise<{ authUrl: string }> {
    // Accept Menchly (INSTAGRAM / X) or Zernio (instagram / twitter) names
    const upper = platformInput.toUpperCase();
    const fromMenchly = toZernioPlatform(upper === "TWITTER" ? "X" : upper);
    const platform = (fromMenchly || platformInput).toLowerCase();
    if (!isConnectablePlatform(platform)) {
      const err = new Error(
        `Platform "${platformInput}" is not supported for social connection. Use /connect/shopify for Shopify.`,
      ) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    // One account per platform in v1
    const existing = await this.prisma.zernioAccount.findUnique({
      where: {
        tenantId_platform: { tenantId, platform },
      },
    });
    if (existing && existing.status === "connected") {
      const err = new Error(
        `${toMenchlyPlatform(platform) || platform} is already connected. Disconnect it first to reconnect.`,
      ) as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }

    const profileId = await this.ensureProfile(tenantId);
    const publicApp = this.config.publicAppUrl;
    if (!publicApp) {
      throw new ZernioApiError(
        "PUBLIC_APP_URL is not configured — cannot build OAuth redirect.",
        503,
        "PUBLIC_APP_URL_MISSING",
      );
    }
    const redirectUrl = `${publicApp.replace(/\/$/, "")}/api/snapshots/integrations/callback`;
    return this.zernio.getConnectUrl(platform, profileId, redirectUrl);
  }

  async connectShopify(
    tenantId: string,
    shop: string,
  ): Promise<{ authUrl: string }> {
    const existing = await this.prisma.zernioAccount.findUnique({
      where: { tenantId_platform: { tenantId, platform: "shopify" } },
    });
    if (existing && existing.status === "connected") {
      const err = new Error(
        "Shopify is already connected. Disconnect it first to reconnect.",
      ) as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }

    const profileId = await this.ensureProfile(tenantId);
    const publicApp = this.config.publicAppUrl;
    if (!publicApp) {
      throw new ZernioApiError(
        "PUBLIC_APP_URL is not configured — cannot build OAuth redirect.",
        503,
        "PUBLIC_APP_URL_MISSING",
      );
    }
    const redirectUrl = `${publicApp.replace(/\/$/, "")}/api/snapshots/integrations/callback`;
    return this.zernio.getShopifyConnectUrl(profileId, shop, redirectUrl);
  }

  /**
   * Sync / connect WordPress or Lovable via iGEO.
   * Tries common iGEO connect paths; otherwise returns current sites (managedBy igeo).
   */
  async connectIgeoBlog(
    tenantId: string,
    providerInput: string,
  ): Promise<{
    managedBy: "igeo";
    provider: IgeoBlogKind;
    connected: boolean;
    sites: Array<{ id: string; name: string; url: string | null }>;
    authUrl?: string;
    message?: string;
  }> {
    const provider = providerInput.toLowerCase();
    if (provider !== "wordpress" && provider !== "lovable") {
      const err = new Error(
        `Blog provider "${providerInput}" must be wordpress or lovable`,
      ) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    const { accountId, apiKey } =
      await this.sourceApi.resolveCredentials(tenantId);

    // Probe iGEO for a connect/auth URL (paths vary by upstream version).
    const probePaths = [
      `/accounts/${accountId}/agents/blog/connect?provider=${provider}`,
      `/accounts/${accountId}/agents/blog/sites/connect?provider=${provider}`,
      `/accounts/${accountId}/agents/auth/connect?provider=${provider === "lovable" ? "LOVABLE" : "BLOG"}`,
    ];
    for (const path of probePaths) {
      try {
        const raw = await this.sourceApi.sourceRequest(accountId, apiKey, path);
        const obj =
          raw && typeof raw === "object" && !Array.isArray(raw)
            ? (raw as Record<string, unknown>)
            : {};
        const authUrl =
          typeof obj.authUrl === "string"
            ? obj.authUrl
            : typeof obj.url === "string"
              ? obj.url
              : typeof obj.redirectUrl === "string"
                ? obj.redirectUrl
                : null;
        if (authUrl) {
          return {
            managedBy: "igeo",
            provider,
            connected: false,
            sites: [],
            authUrl,
          };
        }
      } catch {
        // try next path
      }
    }

    const sites = (await this.loadIgeoBlogSites(tenantId))
      .filter((s) => s.kind === provider)
      .map(({ id, name, url }) => ({ id, name, url }));

    return {
      managedBy: "igeo",
      provider,
      connected: sites.length > 0,
      sites,
      message: sites.length
        ? `${provider === "lovable" ? "Lovable" : "WordPress"} sites synced from the linked iGEO workspace.`
        : `No ${provider === "lovable" ? "Lovable" : "WordPress"} sites found. Connect them in the linked iGEO workspace, then sync again.`,
    };
  }

  async handleCallback(
    query: Record<string, string | undefined>,
  ): Promise<string> {
    const clientBase = this.config.publicClientUrl.replace(/\/$/, "");
    const successRedirect = `${clientBase}/integrations?connected=1`;
    const errorRedirect = (msg: string) =>
      `${clientBase}/integrations?error=${encodeURIComponent(msg)}`;

    const platform = (query.connected || query.platform || "").toLowerCase();
    const profileId = query.profileId || "";
    const accountId = query.accountId || "";
    const username = query.username || null;

    if (!platform || !profileId || !accountId) {
      this.logger.warn(
        `Zernio callback missing params: ${JSON.stringify(query)}`,
      );
      return errorRedirect("Connection callback was incomplete");
    }

    const tenant = await this.prisma.whitelabelTenant.findFirst({
      where: { zernioProfileId: profileId },
      select: { id: true },
    });
    if (!tenant) {
      this.logger.warn(`No tenant for Zernio profile ${profileId}`);
      return errorRedirect("Unknown workspace for this connection");
    }

    // Enforce one-per-platform: disconnect prior row for this platform if any
    const prior = await this.prisma.zernioAccount.findUnique({
      where: { tenantId_platform: { tenantId: tenant.id, platform } },
    });
    if (prior && prior.id !== accountId) {
      try {
        await this.zernio.disconnectAccount(prior.id);
      } catch (err) {
        this.logger.warn(
          `Failed to disconnect prior ${platform} account ${prior.id}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
      await this.prisma.zernioAccount
        .delete({ where: { id: prior.id } })
        .catch(() => undefined);
    }

    await this.prisma.zernioAccount.upsert({
      where: { id: accountId },
      create: {
        id: accountId,
        tenantId: tenant.id,
        platform,
        username,
        displayName: username,
        status: "connected",
        connectedAt: new Date(),
        disconnectedAt: null,
      },
      update: {
        tenantId: tenant.id,
        platform,
        username,
        displayName: username,
        status: "connected",
        connectedAt: new Date(),
        disconnectedAt: null,
      },
    });

    return successRedirect;
  }

  async disconnect(
    tenantId: string,
    accountId: string,
  ): Promise<{ ok: boolean }> {
    const account = await this.prisma.zernioAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      const err = new Error("Connected account not found") as Error & {
        statusCode: number;
      };
      err.statusCode = 404;
      throw err;
    }

    try {
      await this.zernio.disconnectAccount(accountId);
    } catch (err) {
      // Still mark local row disconnected if Zernio already removed it
      if (!(err instanceof ZernioApiError && err.statusCode === 404)) {
        this.logger.warn(
          `Zernio disconnect failed for ${accountId}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    await this.prisma.zernioAccount.update({
      where: { id: accountId },
      data: { status: "disconnected", disconnectedAt: new Date() },
    });
    return { ok: true };
  }

  async handleWebhook(
    rawBody: string | Buffer,
    signatureHeader: string | undefined,
    payload: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    const secret = this.config.zernioWebhookSecret;
    if (secret) {
      if (!signatureHeader) {
        const err = new Error("Missing webhook signature") as Error & {
          statusCode: number;
        };
        err.statusCode = 401;
        throw err;
      }
      const body =
        typeof rawBody === "string"
          ? rawBody
          : Buffer.from(rawBody).toString("utf8");
      const expected = createHmac("sha256", secret).update(body).digest("hex");
      const provided = signatureHeader.replace(/^sha256=/i, "");
      const a = Buffer.from(expected);
      const b = Buffer.from(provided);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        const err = new Error("Invalid webhook signature") as Error & {
          statusCode: number;
        };
        err.statusCode = 401;
        throw err;
      }
    }

    const event = String(payload.event || payload.type || "");
    const account =
      (payload.account as Record<string, unknown> | undefined) ||
      (payload.data as Record<string, unknown> | undefined) ||
      {};

    if (event === "account.connected") {
      const accountId = String(
        account.accountId || account._id || account.id || "",
      );
      const profileId = String(account.profileId || "");
      const platform = String(account.platform || "").toLowerCase();
      const username =
        account.username != null ? String(account.username) : null;
      if (accountId && profileId && platform) {
        const tenant = await this.prisma.whitelabelTenant.findFirst({
          where: { zernioProfileId: profileId },
          select: { id: true },
        });
        if (tenant) {
          await this.prisma.zernioAccount.upsert({
            where: { id: accountId },
            create: {
              id: accountId,
              tenantId: tenant.id,
              platform,
              username,
              displayName: username,
              status: "connected",
              connectedAt: new Date(),
            },
            update: {
              status: "connected",
              username,
              disconnectedAt: null,
              connectedAt: new Date(),
            },
          });
        }
      }
    } else if (event === "account.disconnected") {
      const accountId = String(
        account.accountId || account._id || account.id || "",
      );
      if (accountId) {
        await this.prisma.zernioAccount
          .updateMany({
            where: { id: accountId },
            data: { status: "disconnected", disconnectedAt: new Date() },
          })
          .catch(() => undefined);
      }
    } else {
      this.logger.log(`Ignored Zernio webhook event: ${event}`);
    }

    return { ok: true };
  }

  /** Resolve the connected Zernio account for a Menchly social platform. */
  async getConnectedAccount(tenantId: string, menchlyPlatform: string) {
    const zernioPlatform = toZernioPlatform(menchlyPlatform);
    if (!zernioPlatform) return null;
    return this.prisma.zernioAccount.findFirst({
      where: {
        tenantId,
        platform: zernioPlatform,
        status: "connected",
      },
    });
  }

  /** Connected flags keyed by Menchly platform (BLOG excluded). */
  async getConnectedMap(tenantId: string): Promise<Record<string, boolean>> {
    const accounts = await this.prisma.zernioAccount.findMany({
      where: { tenantId, status: "connected" },
      select: { platform: true },
    });
    const connected: Record<string, boolean> = {};
    for (const p of MENCHLY_SOCIAL_PLATFORMS) {
      const z = MENCHLY_TO_ZERNIO[p];
      connected[p] = accounts.some((a) => a.platform === z);
    }
    return connected;
  }
}
