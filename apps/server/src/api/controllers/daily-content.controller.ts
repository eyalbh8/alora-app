import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../auth/admin.guard';
import { TenantGuard } from '../../auth/tenant.guard';
import { TenantId } from '../../auth/decorators';
import { DailyContentService } from '../services/daily-content/daily-content.service';
import { rethrowAsHttp } from '../utils/http-error';

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('api/snapshots/daily-content')
@UseGuards(TenantGuard)
export class DailyContentController {
  constructor(private readonly dailyContent: DailyContentService) {}

  @Get('runs')
  @UseGuards(AdminGuard)
  async listRuns(
    @TenantId() tenantId: string,
    @Query('take') take?: string,
  ) {
    try {
      const runs = await this.dailyContent.listRuns(
        tenantId,
        take ? Number(take) : 30,
      );
      return { runs };
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('days')
  async listDays(
    @TenantId() tenantId: string,
    @Query('take') take?: string,
  ) {
    try {
      const days = await this.dailyContent.listRunDays(
        tenantId,
        take ? Number(take) : 60,
      );
      return { days };
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('days/:date/posts')
  async getPostsForDate(
    @TenantId() tenantId: string,
    @Param('date') date: string,
  ) {
    try {
      if (!LOCAL_DATE_RE.test(date)) {
        const err = new Error('date must be YYYY-MM-DD') as Error & {
          statusCode: number;
        };
        err.statusCode = 400;
        throw err;
      }
      return await this.dailyContent.getPostsForDate(tenantId, date);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('runs/:runId/posts')
  async getRunPosts(
    @TenantId() tenantId: string,
    @Param('runId') runId: string,
  ) {
    try {
      return await this.dailyContent.getRunPosts(tenantId, runId);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Patch('runs/:runId/posts/:postId')
  async updateRunPost(
    @TenantId() tenantId: string,
    @Param('runId') runId: string,
    @Param('postId') postId: string,
    @Body()
    body: {
      body?: string;
      title?: string;
      tags?: string[];
      focusKeyphrase?: string;
      metaDescription?: string;
      slug?: string;
      publishAt?: string | null;
      removeImages?: boolean;
      state?: string;
    },
  ) {
    try {
      const post = await this.dailyContent.updateRunPost(
        tenantId,
        runId,
        postId,
        body ?? {},
      );
      return { post };
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Post('runs/:runId/posts/:postId/publish')
  async publishRunPost(
    @TenantId() tenantId: string,
    @Param('runId') runId: string,
    @Param('postId') postId: string,
    @Body()
    body: {
      siteIds?: string[];
      categoryBySite?: Record<string, number>;
    },
  ) {
    try {
      return await this.dailyContent.publishRunPost(
        tenantId,
        runId,
        postId,
        body ?? {},
      );
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Post('runs/:runId/posts/:postId/image-upload')
  async addPostImage(
    @TenantId() tenantId: string,
    @Param('runId') runId: string,
    @Param('postId') postId: string,
  ) {
    try {
      return await this.dailyContent.addPostImage(tenantId, runId, postId);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Post('runs/:runId/posts/:postId/image-remove')
  async removePostImage(
    @TenantId() tenantId: string,
    @Param('runId') runId: string,
    @Param('postId') postId: string,
    @Body() body: { imageUrl?: string },
  ) {
    try {
      return await this.dailyContent.removePostImage(
        tenantId,
        runId,
        postId,
        body?.imageUrl ?? '',
      );
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('publish-targets')
  async getPublishTargets(@TenantId() tenantId: string) {
    try {
      return await this.dailyContent.getPublishTargets(tenantId);
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('blog-sites/:siteId/categories')
  async getBlogSiteCategories(
    @TenantId() tenantId: string,
    @Param('siteId') siteId: string,
  ) {
    try {
      const categories = await this.dailyContent.getBlogSiteCategories(
        tenantId,
        siteId,
      );
      return { categories };
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Get('settings')
  @UseGuards(AdminGuard)
  async getSettings(@TenantId() tenantId: string) {
    try {
      const settings = await this.dailyContent.getSettings(tenantId);
      if (!settings) {
        const err = new Error('Tenant not found') as Error & { statusCode: number };
        err.statusCode = 404;
        throw err;
      }
      return { settings };
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Patch('settings')
  @UseGuards(AdminGuard)
  async updateSettings(
    @TenantId() tenantId: string,
    @Body()
    body: {
      dailyContentAutomation?: boolean;
      dailyContentTimezone?: string;
      dailyContentHour?: number;
    },
  ) {
    try {
      const settings = await this.dailyContent.updateSettings(tenantId, body ?? {});
      return { settings };
    } catch (err) {
      rethrowAsHttp(err);
    }
  }
}
