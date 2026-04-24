import { Injectable } from '@nestjs/common';
import { RedisService } from '../shared/redis/redis.service';
import {
  MATCHMAKING_QUEUE_LOCK_KEY,
} from '../shared/security/security.constants';
import { MatchmakingQueueStore } from '../shared/security/matchmaking-queue.store';
import { SessionSecurityService } from '../shared/security/session-security.service';
import { PerfStatsService } from '../shared/perf/perf-stats.service';
import { GameSessionService } from './game-session.service';

@Injectable()
export class MatchmakingService {
  constructor(
    private readonly redis: RedisService,
    private readonly matchmakingQueue: MatchmakingQueueStore,
    private readonly gameSessionService: GameSessionService,
    private readonly sessionSecurity: SessionSecurityService,
    private readonly perfStats: PerfStatsService,
  ) {}

  async joinQueue(playerId: string) {
    await this.sessionSecurity.assertPlayerAvailableForPublicRoom(playerId);

    const existingScore = await this.matchmakingQueue.getScore(playerId);
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
      await this.matchmakingQueue.add(playerId, Date.now());

      const queueSize = await this.matchmakingQueue.size();
      if (queueSize < 2) {
        return { status: 'searching' };
      }

      const [p1, p2] = await this.matchmakingQueue.range(0, 1);
      if (!p1 || !p2) {
        return { status: 'searching' };
      }

      const now = Date.now();
      const p1Score = await this.matchmakingQueue.getScore(p1);
      const p2Score = await this.matchmakingQueue.getScore(p2);
      if (p1Score !== null) this.perfStats.recordGameMetric('game.matchmaking', 'wait', now - p1Score);
      if (p2Score !== null) this.perfStats.recordGameMetric('game.matchmaking', 'wait', now - p2Score);

      await this.matchmakingQueue.remove(p1, p2);
      const session = await this.gameSessionService.createSession(p1, p2);
      return { status: 'matched', sessionId: session.id };
    } finally {
      await this.redis.del(MATCHMAKING_QUEUE_LOCK_KEY);
    }
  }

  async leaveQueue(playerId: string) {
    await this.matchmakingQueue.remove(playerId);
    return { status: 'left' };
  }

  async getQueueStatus(playerId: string) {
    return {
      queued: await this.sessionSecurity.isPlayerQueued(playerId),
    };
  }
}
