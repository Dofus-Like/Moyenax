import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GAME_EVENTS } from '@game/shared-types';
import { SessionService } from '../combat/session/session.service';

@Injectable()
export class EconomyListenerService {
  constructor(private readonly sessionService: SessionService) {}

  @OnEvent(GAME_EVENTS.COMBAT_ENDED)
  async handleCombatEnded(payload: { sessionId: string; winnerId: string; loserId: string }) {
    console.log(`[EconomyListener] Handling combat end for session ${payload.sessionId}. Winner: ${payload.winnerId}`);
    if (payload.winnerId) {
      await this.sessionService.endCombat(payload.sessionId, payload.winnerId);
    }
  }
}
