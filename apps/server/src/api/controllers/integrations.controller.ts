import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public, TenantId } from '../../auth/decorators';
import { TenantGuard } from '../../auth/tenant.guard';
import { rethrowAsHttp } from '../utils/http-error';
import { IntegrationsService } from '../services/integrations/integrations.service';

@Controller('api/snapshots/integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  @UseGuards(TenantGuard)
  async list(@TenantId() tenantId: string) {
    try {
      return await this.integrations.listConnections(tenantId);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Post('connect/shopify')
  @UseGuards(TenantGuard)
  async connectShopify(
    @TenantId() tenantId: string,
    @Body() body: { shop?: string },
  ) {
    try {
      const shop = typeof body?.shop === 'string' ? body.shop : '';
      if (!shop.trim()) {
        const err = new Error('shop is required (e.g. your-store.myshopify.com)') as Error & {
          statusCode: number;
        };
        err.statusCode = 400;
        throw err;
      }
      return await this.integrations.connectShopify(tenantId, shop);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Post('connect/blog/:provider')
  @UseGuards(TenantGuard)
  async connectBlog(
    @TenantId() tenantId: string,
    @Param('provider') provider: string,
  ) {
    try {
      return await this.integrations.connectIgeoBlog(tenantId, provider);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Post('connect/:platform')
  @UseGuards(TenantGuard)
  async connect(
    @TenantId() tenantId: string,
    @Param('platform') platform: string,
  ) {
    try {
      return await this.integrations.connect(tenantId, platform);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  /** OAuth return from Zernio — public, then redirect to client Integrations screen. */
  @Get('callback')
  @Public()
  async callback(@Query() query: Record<string, string>, @Res() res: Response) {
    try {
      const url = await this.integrations.handleCallback(query);
      res.redirect(url);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Delete('accounts/:accountId')
  @UseGuards(TenantGuard)
  async disconnect(
    @TenantId() tenantId: string,
    @Param('accountId') accountId: string,
  ) {
    try {
      return await this.integrations.disconnect(tenantId, accountId);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Post('webhooks/zernio')
  @Public()
  async webhook(
    @Headers('x-zernio-signature') signature: string | undefined,
    @Headers('x-signature') altSignature: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      const raw = JSON.stringify(body ?? {});
      return await this.integrations.handleWebhook(
        raw,
        signature || altSignature,
        body ?? {},
      );
    } catch (err) {
      rethrowAsHttp(err);
    }
  }
}
