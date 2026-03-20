import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GAME_EVENTS } from '@game/shared-types';
import { SessionService } from '../combat/session/session.service';
import { PerfLoggerService } from '../shared/perf/perf-logger.service';

@Injectable()
export class EconomyListenerService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly perfLogger: PerfLoggerService,
  ) {}

  @OnEvent(GAME_EVENTS.COMBAT_ENDED)
  async handleCombatEnded(payload: { sessionId: string; winnerId: string; loserId: string }) {
    this.perfLogger.logEvent('economy', 'combat_ended.received', {
      session_id: payload.sessionId,
      winner_id: payload.winnerId,
      loser_id: payload.loserId,
    });

    if (payload.winnerId) {
      await this.sessionService.endCombat(payload.sessionId, payload.winnerId);
    }
  }
}
