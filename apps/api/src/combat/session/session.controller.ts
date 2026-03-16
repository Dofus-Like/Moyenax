import { Controller, Post, Get, Param, UseGuards, Request, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SessionService } from './session.service';
import { SseService } from '../../shared/sse/sse.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('combat')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly sseService: SseService,
  ) {}

  @Post('challenge/:targetId')
  async challenge(
    @Param('targetId') targetId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.sessionService.challenge(req.user.id, targetId);
  }

  @Post('accept/:sessionId')
  async accept(@Param('sessionId') sessionId: string) {
    return this.sessionService.accept(sessionId);
  }

  @Get('session/:id')
  async getState(@Param('id') id: string) {
    return this.sessionService.getState(id);
  }

  @Sse('session/:id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    return this.sseService.getStream(id);
  }

  @Get('history')
  async getHistory(@Request() req: { user: { id: string } }) {
    return this.sessionService.getHistory(req.user.id);
  }
}
