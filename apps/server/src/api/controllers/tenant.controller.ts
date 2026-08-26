import { Controller, Get, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../../auth/tenant.guard';
import { TenantId } from '../../auth/decorators';
import { GeoService } from '../services/geo.service';
import { SnapshotsService } from '../services/snapshots.service';
import { rethrowAsHttp } from '../utils/http-error';

@Controller('api/snapshots')
@UseGuards(TenantGuard)
export class TenantController {
  constructor(
    private readonly snapshotsService: SnapshotsService,
    private readonly geoService: GeoService,
  ) {}

  @Get('tenant')
  async getTenant(@TenantId() tenantId: string) {
    try {
      const tenant = await this.snapshotsService.loadTenant(tenantId);
      if (!tenant) {
        const err = new Error('Configured tenant was not found') as Error & {
          statusCode: number;
        };
        err.statusCode = 404;
        throw err;
      }
      if (!tenant.enabled) {
        const err = new Error('Configured tenant is disabled') as Error & {
          statusCode: number;
        };
        err.statusCode = 403;
        throw err;
      }
      let availableDays: unknown[] = [];
      try {
        availableDays = await this.geoService.geoTenantScanDays(tenantId);
      } catch (err) {
        if ((err as { statusCode?: number })?.statusCode !== 400) throw err;
      }
      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          domain: tenant.domain,
          sourceAccountId: tenant.source_account_id,
        },
        availableDays,
      };
    } catch (err) {
      rethrowAsHttp(err);
    }
  }
}
