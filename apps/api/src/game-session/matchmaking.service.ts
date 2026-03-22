import { Injectable } from '@nestjs/common';
import { RedisService } from '../shared/redis/redis.service';
import {
  MATCHMAKING_QUEUE_KEY,
  MATCHMAKING_QUEUE_LOCK_KEY,
} from '../shared/security/security.constants';
import { SessionSecurityService } from '../shared/security/session-security.service';
import { GameSessionService } from './game-session.service';

@Injectable()
export class MatchmakingService {
  constructor(
    private readonly redis: RedisService,
    private readonly gameSessionService: GameSessionService,
    private readonly sessionSecurity: SessionSecurityService,
  ) {}

  async joinQueue(playerId: string) {
    await this.sessionSecurity.assertPlayerAvailableForPublicRoom(playerId);

    const existingScore = await this.redis.zScore(MATCHMAKING_QUEUE_KEY, playerId);
    if (existingScore !== null) {
      return { status: 'already_in_queue' };
    }

    const lockAcquired = await this.redis.setIfNotExists(
      MATCHMAKING_QUEUE_LOCK_KEY,
      playerId,
      5,
    );

    if (!lockAcquired) {
      return { status: 'searching' };
    }

    try {
      await this.redis.zAdd(MATCHMAKING_QUEUE_KEY, Date.now(), playerId);

      const queueSize = await this.redis.zCard(MATCHMAKING_QUEUE_KEY);
      if (queueSize < 2) {
        return { status: 'searching' };
      }

      const [p1, p2] = await this.redis.zRange(MATCHMAKING_QUEUE_KEY, 0, 1);
      if (!p1 || !p2) {
        return { status: 'searching' };
      }

      await this.redis.zRem(MATCHMAKING_QUEUE_KEY, p1, p2);
      const session = await this.gameSessionService.createSession(p1, p2);
      return { status: 'matched', sessionId: session.id };
    } finally {
      await this.redis.del(MATCHMAKING_QUEUE_LOCK_KEY);
    }
  }

  async leaveQueue(playerId: string) {
    await this.redis.zRem(MATCHMAKING_QUEUE_KEY, playerId);
    return { status: 'left' };
  }

  async getQueueStatus(playerId: string) {
    return {
      queued: await this.sessionSecurity.isPlayerQueued(playerId),
    };
  }
}
