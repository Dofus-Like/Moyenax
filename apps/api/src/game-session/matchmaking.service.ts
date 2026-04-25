import { Injectable } from '@nestjs/common';
import { PerfStatsService } from '../shared/perf/perf-stats.service';
import { RedisService } from '../shared/redis/redis.service';
import { DistributedLockService } from '../shared/security/distributed-lock.service';
import { MatchmakingQueueStore } from '../shared/security/matchmaking-queue.store';
import { MATCHMAKING_QUEUE_LOCK_KEY } from '../shared/security/security.constants';
import { SessionSecurityService } from '../shared/security/session-security.service';

import { GameSessionService } from './game-session.service';

/**
 * TTL du lock matchmaking en secondes. Raisonnablement large pour couvrir
 * `createSession` qui fait plusieurs requêtes Prisma (bug #6: était 5s, trop juste).
 * Si le lock expire pendant createSession, les deux joueurs ont été retirés
 * de la queue donc pas de double-match possible.
 */
const MATCHMAKING_LOCK_TTL_SECONDS = 20;

@Injectable()
export class MatchmakingService {
  constructor(
    private readonly redis: RedisService,
    private readonly matchmakingQueue: MatchmakingQueueStore,
    private readonly gameSessionService: GameSessionService,
    private readonly sessionSecurity: SessionSecurityService,
    private readonly perfStats: PerfStatsService,
    private readonly distributedLock: DistributedLockService,
  ) {}

  async joinQueue(playerId: string) {
    await this.sessionSecurity.assertPlayerAvailableForPublicRoom(playerId);

    const existingScore = await this.matchmakingQueue.getScore(playerId);
    if (existingScore !== null) {
      return { status: 'already_in_queue' };
    }

    // tryWithLock: si le lock n'est pas acquis, on retourne 'searching'
    // sans throw — le client réessaiera à son rythme.
    const result = await this.distributedLock.tryWithLock(
      MATCHMAKING_QUEUE_LOCK_KEY,
      MATCHMAKING_LOCK_TTL_SECONDS,
      async () => {
        await this.matchmakingQueue.add(playerId, Date.now());

        const queueSize = await this.matchmakingQueue.size();
        if (queueSize < 2) {
          return { status: 'searching' } as const;
        }

        const [p1, p2] = await this.matchmakingQueue.range(0, 1);
        if (!p1 || !p2) {
          return { status: 'searching' } as const;
        }

        const now = Date.now();
        const p1Score = await this.matchmakingQueue.getScore(p1);
        const p2Score = await this.matchmakingQueue.getScore(p2);
        if (p1Score !== null)
          this.perfStats.recordGameMetric('game.matchmaking', 'wait', now - p1Score);
        if (p2Score !== null)
          this.perfStats.recordGameMetric('game.matchmaking', 'wait', now - p2Score);

        // IMPORTANT: on retire les 2 joueurs de la queue AVANT de créer la session,
        // pour qu'un autre matcher ne puisse pas les re-matcher si createSession est lent.
        await this.matchmakingQueue.remove(p1, p2);
        const session = await this.gameSessionService.createSession(p1, p2);
        return { status: 'matched', sessionId: session.id } as const;
      },
    );

    return result ?? { status: 'searching' };
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
