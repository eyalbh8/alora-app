import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, JWTPayload, jwtVerify } from 'jose';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../types/auth-request';

const DESCOPE_API = 'https://api.descope.com';

type VerifiedClaims = {
  userId: string;
  email: string;
  name: string | null;
};

/**
 * Descope JWT authentication — ported from functions/snapshots-api/auth.mjs.
 * Verifies session tokens via JWKS and upserts wl_users on first request.
 */
@Injectable()
export class DescopeService {
  private jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
  private jwksProjectId: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getProjectId(): string {
    return this.configService.descopeProjectId;
  }

  private getJWKS(projectId: string) {
    if (!this.jwksCache || this.jwksProjectId !== projectId) {
      this.jwksProjectId = projectId;
      // Same endpoint as auth.mjs (Descope JWKS)
      this.jwksCache = createRemoteJWKSet(
        new URL(`${DESCOPE_API}/v2/keys/${projectId}`),
      );
    }
    return this.jwksCache;
  }

  private extractBearer(authHeader: string | undefined): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }
    const token = authHeader.substring(7).trim();
    if (!token) throw new Error('Missing JWT token');
    return token;
  }

  private claimsFromPayload(payload: JWTPayload): {
    userId: string;
    email: string | null;
    name: string | null;
  } {
    const descope = payload['descope'] as { email?: string } | undefined;
    const email =
      (payload.email as string | undefined) ||
      (payload.emailAddress as string | undefined) ||
      (Array.isArray(payload.emails) ? (payload.emails[0] as string) : null) ||
      descope?.email ||
      null;
    const givenName = payload.givenName as string | undefined;
    const familyName = payload.familyName as string | undefined;
    const name =
      (payload.name as string | undefined) ||
      (payload.given_name as string | undefined) ||
      [givenName, familyName].filter(Boolean).join(' ') ||
      null;
    return {
      userId: String(payload.sub),
      email: email ? String(email) : null,
      name: name ? String(name) : null,
    };
  }

  /**
   * Fetch email/name from Descope /v1/auth/me (session JWT often omits email).
   */
  async getUser(
    projectId: string,
    token: string,
  ): Promise<{
    userId: string | null;
    email: string | null;
    name: string | null;
  } | null> {
    try {
      const response = await fetch(`${DESCOPE_API}/v1/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${projectId}:${token}`,
        },
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        user?: Record<string, unknown>;
        userId?: string;
        user_id?: string;
        email?: string;
        loginIds?: string[];
        loginId?: string;
        name?: string;
        givenName?: string;
      };
      const user = body.user || body;
      return {
        userId:
          (user.userId as string | undefined) ||
          (user.user_id as string | undefined) ||
          null,
        email:
          (user.email as string | undefined) ||
          (Array.isArray(user.loginIds) ? user.loginIds[0] : null) ||
          (user.loginId as string | undefined) ||
          null,
        name:
          (user.name as string | undefined) ||
          (user.givenName as string | undefined) ||
          null,
      };
    } catch (err) {
      console.warn(
        '[auth] Descope /me failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  /**
   * Verify Descope JWT from Authorization header.
   */
  async verifyToken(authHeader: string | undefined): Promise<VerifiedClaims> {
    const token = this.extractBearer(authHeader);
    const projectId = this.getProjectId();

    let payload: JWTPayload;
    try {
      const { payload: verified } = await jwtVerify(
        token,
        this.getJWKS(projectId),
        {
          // Descope session JWTs use the project ID as iss (not the API URL).
          issuer: [
            projectId,
            `${DESCOPE_API}/${projectId}`,
            `${DESCOPE_API}/v1/apps/${projectId}`,
          ],
        },
      );
      payload = verified;
    } catch (err) {
      throw new Error(
        `JWT verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!payload.sub) {
      throw new Error('JWT missing sub (user id)');
    }

    const fromJwt = this.claimsFromPayload(payload);
    let email = fromJwt.email;
    let name = fromJwt.name;
    let userId = fromJwt.userId;

    if (!email) {
      const fromMe = await this.getUser(projectId, token);
      if (fromMe) {
        userId = fromMe.userId || userId;
        email = fromMe.email || email;
        name = fromMe.name || name;
      }
    }

    if (!email) {
      email = `${userId}@descope.local`;
    }

    return { userId, email, name: name || null };
  }

  /**
   * Upsert user in wl_users on first authenticated request.
   * Pre-provisioned users (by email) are claimed: pending id replaced with Descope id.
   */
  async upsertUser(user: {
    userId: string;
    email: string;
    name?: string | null;
  }): Promise<AuthUser> {
    const email = user.email ? String(user.email).trim().toLowerCase() : null;
    if (!email) {
      throw new Error('User email is required');
    }

    const count = await this.prisma.wlUser.count();
    const isFirstUser = count === 0;

    return this.prisma.$transaction(async (tx) => {
      const byId = await tx.wlUser.findUnique({
        where: { id: user.userId },
      });
      if (byId) {
        const updated = await tx.wlUser.update({
          where: { id: user.userId },
          data: {
            email,
            name: user.name || undefined,
          },
        });
        return {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          isAdmin: updated.isAdmin,
        };
      }

      const byEmail = await tx.wlUser.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (byEmail) {
        const oldId = byEmail.id;
        const isAdmin = byEmail.isAdmin;
        // Insert first (temp email) so membership FKs can move, then drop the pending row.
        await tx.wlUser.create({
          data: {
            id: user.userId,
            email: `${user.userId}@descope.pending`,
            name: user.name || null,
            isAdmin,
          },
        });
        await tx.wlUserTenant.updateMany({
          where: { userId: oldId },
          data: { userId: user.userId },
        });
        await tx.wlUser.delete({ where: { id: oldId } });
        const updated = await tx.wlUser.update({
          where: { id: user.userId },
          data: {
            email,
            name: user.name || undefined,
          },
        });
        return {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          isAdmin: updated.isAdmin,
        };
      }

      const created = await tx.wlUser.create({
        data: {
          id: user.userId,
          email,
          name: user.name || null,
          isAdmin: isFirstUser,
        },
      });
      return {
        id: created.id,
        email: created.email,
        name: created.name,
        isAdmin: created.isAdmin,
      };
    });
  }

  /**
   * Check if user can access the given tenant.
   * Admins may access any enabled tenant; others need wl_user_tenants membership.
   */
  async canAccessTenant(
    userId: string,
    tenantId: string,
    isAdmin: boolean,
  ): Promise<boolean> {
    if (isAdmin) {
      const tenant = await this.prisma.whitelabelTenant.findFirst({
        where: { id: tenantId, enabled: true },
        select: { id: true },
      });
      return !!tenant;
    }

    const membership = await this.prisma.wlUserTenant.findUnique({
      where: {
        userId_tenantId: { userId, tenantId },
      },
      select: { userId: true },
    });
    return !!membership;
  }
}
