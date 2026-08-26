import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type TenantPublic = {
  id: string;
  source_account_id: string;
  name: string | null;
  domain: string | null;
  enabled: boolean;
};

@Injectable()
export class SnapshotsService {
  constructor(private readonly prisma: PrismaService) {}

  async loadTenant(tenantId: string): Promise<TenantPublic | null> {
    const row = await this.prisma.whitelabelTenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        source_account_id: true,
        name: true,
        domain: true,
        enabled: true,
      },
    });
    return row ?? null;
  }
}
