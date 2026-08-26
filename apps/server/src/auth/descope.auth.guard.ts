import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthRequest } from '../types/auth-request';
import { IS_PUBLIC_KEY } from './decorators';
import { DescopeService } from './descope.service';

@Injectable()
export class DescopeAuthGuard implements CanActivate {
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
    const authHeader = request.headers.authorization;

    try {
      const claims = await this.descopeService.verifyToken(authHeader);
      const user = await this.descopeService.upsertUser({
        userId: claims.userId,
        email: claims.email,
        name: claims.name,
      });
      request.user = user;
      return true;
    } catch (err) {
      throw new UnauthorizedException(
        err instanceof Error ? err.message : 'Invalid token',
      );
    }
  }
}
