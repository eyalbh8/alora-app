import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantGuard } from '../../auth/tenant.guard';
import { TenantId } from '../../auth/decorators';
import { GeoService } from '../services/geo.service';
import { rethrowAsHttp } from '../utils/http-error';

@Controller('api/snapshots/geo')
@UseGuards(TenantGuard)
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('meta')
  async meta(@TenantId() tenantId: string) {
    try {
      return await this.geoService.geoMeta(tenantId);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('dashboard')
  async dashboard(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoDashboard(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('mentions')
  async mentions(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoMentions(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('sentiment')
  async sentiment(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoSentiment(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('prompts')
  async prompts(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoPrompts(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('tags')
  async tags(@TenantId() tenantId: string) {
    try {
      return await this.geoService.geoTags(tenantId);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Post('tags')
  @HttpCode(HttpStatus.CREATED)
  async createTag(@TenantId() tenantId: string, @Body() body: Record<string, unknown>) {
    try {
      return await this.geoService.geoCreateTag(tenantId, body ?? {});
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Patch('prompts/:promptId/tags')
  async setPromptTags(
    @TenantId() tenantId: string,
    @Param('promptId') promptId: string,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.geoService.geoSetPromptTags(
        tenantId,
        decodeURIComponent(promptId),
        body ?? {},
      );
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Delete('tags/:tagId')
  async deleteTag(@TenantId() tenantId: string, @Param('tagId') tagId: string) {
    try {
      return await this.geoService.geoDeleteTag(tenantId, decodeURIComponent(tagId));
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('provider-mentions/:provider/prompts')
  async providerMentionPrompts(
    @TenantId() tenantId: string,
    @Param('provider') provider: string,
    @Query() query: Record<string, string>,
  ) {
    try {
      return await this.geoService.geoProviderMentionPrompts(
        tenantId,
        query,
        decodeURIComponent(provider),
      );
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('competitors')
  async competitors(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoCompetitors(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('marketplace')
  async marketplace(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoMarketplace(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('citations')
  async citations(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoCitations(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('citations/domains/:domain')
  async citationDomain(
    @TenantId() tenantId: string,
    @Param('domain') domain: string,
    @Query() query: Record<string, string>,
  ) {
    try {
      return await this.geoService.geoCitationDomain(
        tenantId,
        query,
        decodeURIComponent(domain),
      );
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('citations/url-detail')
  async citationUrlDetail(
    @TenantId() tenantId: string,
    @Query() query: Record<string, string>,
  ) {
    try {
      return await this.geoService.geoCitationUrlDetail(tenantId, query, query.url);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('responses')
  async responses(@TenantId() tenantId: string, @Query() query: Record<string, string>) {
    try {
      return await this.geoService.geoResponses(tenantId, query);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('responses/:responseId')
  async responseDetail(
    @TenantId() tenantId: string,
    @Param('responseId') responseId: string,
  ) {
    try {
      return await this.geoService.geoResponseDetail(
        tenantId,
        decodeURIComponent(responseId),
      );
    } catch (err) {
      rethrowAsHttp(err);
    }
  }
}
