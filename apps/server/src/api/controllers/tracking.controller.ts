import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public, TenantId } from '../../auth/decorators';
import { TenantGuard } from '../../auth/tenant.guard';
import {
  TrackingService,
  type TrackEventInput,
  type TrackRequestContext,
} from '../services/tracking/tracking.service';
import { rethrowAsHttp } from '../utils/http-error';

/**
 * A 1x1 transparent GIF, returned by the no-JS pixel so the response is always a
 * valid image regardless of whether the hit was stored.
 */
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

/**
 * Public ingest for the first-party AI traffic tracker.
 *
 * Routes must live under `api/snapshots` because that is the only path prefix
 * Amplify rewrites to the Lambda (see amplify-redirects.json).
 */
@Controller('api/snapshots')
@UseGuards(ThrottlerGuard)
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Public()
  @Post('track')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 1000, ttl: 900_000 } })
  async track(@Body() body: TrackEventInput, @Req() req: Request) {
    try {
      const result = await this.tracking.collectEvent(
        body ?? {},
        this.requestContext(req),
      );
      return result.stored
        ? { success: true, eventId: result.eventId, provider: result.provider }
        : { success: true, stored: false };
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  /**
   * Fallback for agents that fetch HTML without running scripts. Embedded as
   * `<noscript><img src="...pixel.gif?a=<tenant>&u=<url>"></noscript>`.
   */
  @Public()
  @Get('track/pixel.gif')
  @Throttle({ default: { limit: 1000, ttl: 900_000 } })
  @Header('Content-Type', 'image/gif')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  async pixel(
    @Query('a') accountId: string | undefined,
    @Query('u') url: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.tracking.collectPixel(accountId, url, this.requestContext(req));
    res.end(PIXEL_GIF);
  }

  /** Install verification for the tracker setup screen. */
  @Get('tracker/status')
  @UseGuards(TenantGuard)
  async status(@TenantId() tenantId: string) {
    try {
      return await this.tracking.getStatus(tenantId);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  private requestContext(req: Request): TrackRequestContext {
    return {
      userAgent: this.firstHeader(req, 'user-agent') ?? '',
      ip: this.clientIp(req),
      origin: this.firstHeader(req, 'origin') ?? this.firstHeader(req, 'referer') ?? null,
      edgeCountry:
        this.firstHeader(req, 'cloudfront-viewer-country') ??
        this.firstHeader(req, 'cf-ipcountry') ??
        null,
    };
  }

  /** Left-most x-forwarded-for entry is the original client behind the proxies. */
  private clientIp(req: Request): string | null {
    const forwarded = this.firstHeader(req, 'x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    return this.firstHeader(req, 'x-real-ip') ?? req.socket?.remoteAddress ?? null;
  }

  private firstHeader(req: Request, name: string): string | null {
    const raw = req.headers[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed || null;
  }
}
