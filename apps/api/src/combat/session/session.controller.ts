import { Controller, Get, Param, Post, Request, Sse, UseGuards } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Throttle, seconds } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SseTicketGuard } from '../../shared/security/sse-ticket.guard';
import { SseTicketResource } from '../../shared/security/sse-ticket.decorator';
import { SseService } from '../../shared/sse/sse.service';
import { SessionService } from './session.service';

@Controller('combat')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly sseService: SseService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: seconds(60) } })
  @Post('vs-ai')
  async startVsAiCombat(@Request() req: { user: { id: string } }) {
    return this.sessionService.startVsAiCombat(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('rooms')
  async getRooms() {
    return this.sessionService.getRooms();
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @Post('challenge')
  async createRoom(@Request() req: { user: { id: string } }) {
    return this.sessionService.challenge(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @Post('challenge/:targetId')
  async challenge(
    @Param('targetId') targetId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.sessionService.challenge(req.user.id, targetId);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @Post('accept/:sessionId')
  async accept(
    @Param('sessionId') sessionId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.sessionService.accept(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('session/:id')
  async getState(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.sessionService.getStateForParticipant(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('session/:id/stream-ticket')
  async issueStreamTicket(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.sessionService.issueStreamTicket(id, req.user.id);
  }

  @UseGuards(SseTicketGuard)
  @Sse('session/:id/events')
  @SseTicketResource('combat')
  events(@Param('id') id: string): Observable<any> {
    return this.sseService.getStream(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getHistory(@Request() req: { user: { id: string } }) {
    return this.sessionService.getHistory(req.user.id);
  }
}
