import {
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  Body,
  BadRequestException,
  Sse,
  Param,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { MatchmakingService } from './matchmaking.service';
import { GameSessionService } from './game-session.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SseService } from '../shared/sse/sse.service';
import { SessionService } from '../combat/session/session.service';

@Controller('game-session')
@UseGuards(JwtAuthGuard)
export class GameSessionController {
  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly gameSessionService: GameSessionService,
    private readonly sseService: SseService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('join-queue')
  async joinQueue(@Request() req: { user: { id: string } }) {
    return this.matchmakingService.joinQueue(req.user.id);
  }

  @Post('leave-queue')
  async leaveQueue(@Request() req: { user: { id: string } }) {
    return this.matchmakingService.leaveQueue(req.user.id);
  }

  @Get('active')
  async getActiveSession(@Request() req: { user: { id: string } }) {
    return this.gameSessionService.getActiveSession(req.user.id);
  }

  @Get('inventory')
  async getInventory(@Request() req: { user: { id: string } }) {
    const session = await this.gameSessionService.getActiveSession(req.user.id);
    if (!session) return [];
    return this.gameSessionService.getSessionInventory(session.id, req.user.id);
  }

  @Post('ready')
  async toggleReady(@Request() req: { user: { id: string } }, @Body('ready') ready: boolean) {
    const session = await this.gameSessionService.getActiveSession(req.user.id);
    if (!session) throw new BadRequestException('Aucune session active');
    return this.gameSessionService.setReady(session.id, req.user.id, ready);
  }

  @Post('create-private')
  async createPrivateSession(@Request() req: { user: { id: string } }) {
    return this.gameSessionService.createSession(req.user.id, null);
  }

  @Get('waiting')
  async getWaitingSessions() {
    return this.gameSessionService.getWaitingSessions();
  }

  @Post('join/:sessionId')
  async joinPrivateSession(
    @Param('sessionId') sessionId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.gameSessionService.joinPrivateSession(sessionId, req.user.id);
  }

  @Post('vs-ai')
  async startVsAi(@Request() req: { user: { id: string } }) {
    const bot = await this.sessionService.getOrCreateBotPlayer();
    return this.gameSessionService.createSession(req.user.id, bot.id);
  }

  @Post('end/:id')
  async endSession(@Param('id') id: string) {
    return this.gameSessionService.endSession(id);
  }

  @Sse('session/:id/events')
  events(@Param('id') id: string): Observable<any> {
    return this.sseService.getStream(`game-session:${id}`);
  }
}
