import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators';
import { AuthUser } from '../../types/auth-request';
import { AccountsService } from '../services/accounts.service';
import { rethrowAsHttp } from '../utils/http-error';

@Controller('api/snapshots')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('accounts')
  async listAccounts(@CurrentUser() user: AuthUser) {
    try {
      const accounts = await this.accountsService.listAccessibleTenants(
        user.id,
        user.isAdmin,
      );
      return { accounts };
    } catch (err) {
      rethrowAsHttp(err);
    }
  }

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  async connectAccount(
    @CurrentUser() user: AuthUser,
    @Body() body: { connectionUrl?: string },
  ) {
    try {
      const connectionUrl = typeof body?.connectionUrl === 'string' ? body.connectionUrl : '';
      const account = await this.accountsService.connectFirstAccount(user, connectionUrl);
      return { account };
    } catch (err) {
      rethrowAsHttp(err);
    }
  }
}
