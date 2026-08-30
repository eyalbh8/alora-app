import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";

@Injectable()
export class ConfigService {
  constructor(private readonly configService: NestConfigService) {}

  get<T = string>(key: string): T {
    const value = this.configService.get<T>(key);
    if (value === undefined || value === null || value === "") {
      throw new Error(`Missing configuration key: ${key}`);
    }
    return value;
  }

  getOptional<T = string>(key: string, fallback?: T): T | undefined {
    const value = this.configService.get<T>(key);
    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    return value;
  }

  get databaseUrl(): string {
    return this.get<string>("DATABASE_URL");
  }

  get descopeProjectId(): string {
    return this.get<string>("DESCOPE_PROJECT_ID");
  }

  get sourceApiBase(): string {
    const raw =
      this.optionalTrimmed("SOURCE_API_BASE") ||
      this.optionalTrimmed("API_BASE") ||
      "";
    return raw.replace(/\/$/, "");
  }

  get sourceApiKey(): string {
    return this.optionalTrimmed("SOURCE_API_KEY") ?? "";
  }

  get mcpUrl(): string {
    return this.optionalTrimmed("MCP_URL") ?? "";
  }

  get mcpApiKey(): string {
    return this.optionalTrimmed("MCP_API_KEY") ?? "";
  }

  get openaiApiKey(): string {
    return this.optionalTrimmed("OPENAI_API_KEY") ?? "";
  }

  get anthropicApiKey(): string {
    return this.optionalTrimmed("ANTHROPIC_API_KEY") ?? "";
  }

  /** Zernio social publishing API key (also accepts legacy ZERNIO_AOI_KEY). */
  get zernioApiKey(): string {
    return (
      this.optionalTrimmed("ZERNIO_API_KEY") ||
      this.optionalTrimmed("ZERNIO_AOI_KEY") ||
      ""
    );
  }

  get zernioApiBase(): string {
    const raw =
      this.optionalTrimmed("ZERNIO_API_BASE") || "https://zernio.com/api/v1";
    return raw.replace(/\/$/, "");
  }

  /** Public base URL of this API (used for OAuth redirect_url). */
  get publicAppUrl(): string {
    return (
      this.optionalTrimmed("PUBLIC_APP_URL") ||
      this.optionalTrimmed("API_PUBLIC_URL") ||
      ""
    );
  }

  /** Public base URL of the Menchly client (OAuth return landing). */
  get publicClientUrl(): string {
    return this.optionalTrimmed("PUBLIC_CLIENT_URL") || "http://localhost:5173";
  }

  /** Optional webhook signing secret from Zernio. */
  get zernioWebhookSecret(): string {
    return this.optionalTrimmed("ZERNIO_WEBHOOK_SECRET") || "";
  }

  /** Env value that is set and not the literal strings "undefined"/"null". */
  private optionalTrimmed(key: string): string | null {
    const value = this.configService.get<string>(key)?.trim();
    if (!value || value === "undefined" || value === "null") return null;
    return value;
  }

  get allowedOrigin(): string {
    return this.getOptional<string>("ALLOWED_ORIGIN", "*") ?? "*";
  }
}
