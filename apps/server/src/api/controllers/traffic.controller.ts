import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../../auth/tenant.guard';
import { TenantId } from '../../auth/decorators';
import { GeoService } from '../services/geo.service';
import { rethrowAsHttp } from '../utils/http-error';

@Controller('api/snapshots')
@UseGuards(TenantGuard)
export class TrafficController {
  constructor(private readonly geoService: GeoService) {}

  @Get('traffic')
  async traffic(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoTraffic(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('crawlers')
  async crawlers(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoCrawlers(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }
}
