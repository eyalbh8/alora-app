import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthRequest } from '../types/auth-request';
import { IS_PUBLIC_KEY } from './decorators';
import { DescopeService } from './descope.service';

const TENANT_HEADER = 'x-alora-tenant-id';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly descopeService: DescopeService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const raw = request.headers[TENANT_HEADER];
    const tenantId = Array.isArray(raw) ? raw[0] : raw;
    if (!tenantId || typeof tenantId !== 'string') {
      throw new ForbiddenException('Missing X-Alora-Tenant-Id header');
    }

    const allowed = await this.descopeService.canAccessTenant(
      user.id,
      tenantId,
      user.isAdmin,
    );
    if (!allowed) {
      throw new ForbiddenException('No access to this tenant');
    }

    request.tenantId = tenantId;
    return true;
  }
}
