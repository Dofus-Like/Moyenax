import { Controller, Get } from '@nestjs/common';

@Controller()
export class VersionController {
  @Get('version')
  getVersion() {
    return {
      sha: process.env.BUILD_SHA ?? 'unknown',
      builtAt: process.env.BUILD_TIME ?? 'unknown',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
