import { Controller, Get } from '@nestjs/common';
import { SCREEN_KEYS } from '@alora/shared';
import { Public } from '../auth/decorators';

@Controller()
export class HealthController {
  @Public()
  @Get(['api/snapshots', 'api/snapshots/health'])
  snapshotsHealth() {
    return {
      ok: true,
      screens: SCREEN_KEYS,
    };
  }
}
