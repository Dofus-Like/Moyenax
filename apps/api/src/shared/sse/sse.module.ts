import { Module, Global } from '@nestjs/common';

import { SseService } from './sse.service';

@Global()
@Module({
  providers: [SseService],
  exports: [SseService],
})
export class SseModule {}
