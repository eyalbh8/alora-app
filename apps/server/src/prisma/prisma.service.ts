import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log: ['warn', 'error'],
    });
  }

  async onModuleInit() {
    // Soft-connect so health endpoints work even if DB is unreachable during scaffold.
    try {
      await this.$connect();
    } catch (err) {
      console.warn(
        '[PrismaService] Database connect failed (auth/tenant routes will fail until DB is available):',
        err instanceof Error ? err.message : err,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
