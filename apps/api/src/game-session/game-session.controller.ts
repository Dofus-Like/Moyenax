import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Throttle, seconds } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SessionService } from '../combat/session/session.service';
import { SseTicketGuard } from '../shared/security/sse-ticket.guard';
import { SseTicketResource } from '../shared/security/sse-ticket.decorator';
import { SseService } from '../shared/sse/sse.service';
import { GameSessionService } from './game-session.service';
import { MatchmakingService } from './matchmaking.service';

@Controller('game-session')
export class GameSessionController {
  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly gameSessionService: GameSessionService,
    private readonly sseService: SseService,
    private readonly sessionService: SessionService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: seconds(60) } })
  @Post('join-queue')
  async joinQueue(@Request() req: { user: { id: string } }) {
    return this.matchmakingService.joinQueue(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: seconds(60) } })
  @Post('leave-queue')
  async leaveQueue(@Request() req: { user: { id: string } }) {
    return this.matchmakingService.leaveQueue(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('queue-status')
  async getQueueStatus(@Request() req: { user: { id: string } }) {
    return this.matchmakingService.getQueueStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('active')
  async getActiveSession(@Request() req: { user: { id: string } }) {
    return this.gameSessionService.getCurrentSession(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('inventory')
  async getInventory(@Request() req: { user: { id: string } }) {
    const session = await this.gameSessionService.getCurrentSession(req.user.id);
    if (!session || session.status !== 'ACTIVE') return [];
    return this.gameSessionService.getSessionInventory(session.id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @Post('ready')
  async toggleReady(
    @Request() req: { user: { id: string } },
    @Body() body: { ready?: boolean; sessionId?: string },
  ) {
    if (typeof body.ready !== 'boolean') {
      throw new BadRequestException('Champ ready (booleen) requis');
    }

    const session = body.sessionId
      ? await this.gameSessionService.getCurrentSession(req.user.id, body.sessionId)
      : await this.gameSessionService.getCurrentSession(req.user.id);

    if (!session || session.status !== 'ACTIVE') {
      throw new BadRequestException('Aucune session active');
    }

    return this.gameSessionService.setReady(session.id, req.user.id, body.ready);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @Post('create-private')
  async createPrivateSession(@Request() req: { user: { id: string } }) {
    return this.gameSessionService.createSession(req.user.id, null);
  }

  @UseGuards(JwtAuthGuard)
  @Get('waiting')
  async getWaitingSessions() {
    return this.gameSessionService.getWaitingSessions();
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @Post('join/:sessionId')
  async joinPrivateSession(
    @Param('sessionId') sessionId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.gameSessionService.joinPrivateSession(sessionId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @Post('vs-ai')
  async startVsAi(@Request() req: { user: { id: string } }) {
    const bot = await this.sessionService.getOrCreateBotPlayer();
    return this.gameSessionService.createVsAiSession(req.user.id, bot.id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @Post('end/:id')
  async endSession(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.gameSessionService.endSession(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('session/:id/stream-ticket')
  async issueStreamTicket(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.gameSessionService.issueStreamTicket(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset')
  async resetSession(@Request() req: { user: { id: string } }) {
    return this.gameSessionService.forceReset(req.user.id);
  }

  @UseGuards(SseTicketGuard)
  @Sse('session/:id/events')
  @SseTicketResource('game-session')
  events(@Param('id') id: string): Observable<any> {
    return this.sseService.getStream(`game-session:${id}`);
  }
}
