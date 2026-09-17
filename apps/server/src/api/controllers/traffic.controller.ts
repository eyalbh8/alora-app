import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../../auth/tenant.guard';
import { TenantId } from '../../auth/decorators';
import { PrismaService } from '../../prisma/prisma.service';
import { GeoService } from '../services/geo.service';
import { SourceApiService } from '../services/source-api.service';
import { AnalyticsService } from '../services/tracking/analytics.service';
import { rethrowAsHttp } from '../utils/http-error';

@Controller('api/snapshots')
@UseGuards(TenantGuard)
export class TrafficController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geoService: GeoService,
    private readonly sourceApi: SourceApiService,
    private readonly analytics: AnalyticsService,
  ) {}

  /**
   * AI referral traffic. Workspaces with `first_party_traffic` use our tracker
   * (`analytics_events`); everyone else keeps the linked iGEO ai-dashboard feed
   * (e.g. Nayax on the public.igeo.ai tracker).
   */
  @Get('traffic')
  async traffic(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      const tenant = await this.prisma.whitelabelTenant.findUnique({
        where: { id: tenantId },
        select: { firstPartyTraffic: true },
      });

      if (!tenant?.firstPartyTraffic) {
        return await this.geoService.geoTraffic(tenantId, query);
      }

      const filters = this.geoService.parseGeoFilters(query);
      const previous = this.sourceApi.previousPeriod(filters);

      return await this.analytics.getAiDashboardAggregates(
        tenantId,
        new Date(this.sourceApi.toStartIso(filters.startDate)),
        new Date(this.sourceApi.toEndIso(filters.endDate)),
        new Date(this.sourceApi.toStartIso(previous.startDate)),
        new Date(this.sourceApi.toEndIso(previous.endDate)),
        { providers: filters.providers, countries: filters.regions },
      );
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  /**
   * Crawler analytics still come from the upstream Cloudflare feed: AI crawlers
   * do not execute JavaScript, so the first-party tracker cannot see them.
   */
  @Get('crawlers')
  async crawlers(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoCrawlers(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }
}
