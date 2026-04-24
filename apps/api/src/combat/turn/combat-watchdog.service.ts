import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CombatState, GAME_EVENTS } from '@game/shared-types';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import { DistributedLockService } from '../../shared/security/distributed-lock.service';

/**
 * Bug #8 fix: sessions bloquées indéfiniment si un joueur déconnecte en plein tour.
 *
 * Ce service scanne périodiquement les combats actifs en Redis et force un END_TURN
 * si aucune action n'a été prise depuis TURN_TIMEOUT_SECONDS.
 *
 * Mécanisme:
 *   - À chaque `playAction` réussi, `TurnService` met à jour `state.lastActionAt`.
 *   - Le watchdog scan toutes les `CRON_INTERVAL` secondes les clés `combat:*` en Redis.
 *   - Pour chaque state dont `now - lastActionAt > TURN_TIMEOUT_SECONDS`, il émet
 *     un event `TURN_TIMED_OUT` via SSE et force un END_TURN automatique.
 *   - Le lock distribué évite que 2 instances d'API forcent le END_TURN en double.
 */
const TURN_TIMEOUT_SECONDS = 90;
const WATCHDOG_LOCK_TTL_SECONDS = 15;

@Injectable()
export class CombatWatchdogService {
  private readonly logger = new Logger(CombatWatchdogService.name);
  private enabled = true;

  constructor(
    private readonly redis: RedisService,
    private readonly sse: SseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly distributedLock: DistributedLockService,
  ) {}

  /**
   * Désactive le watchdog (utile pour les tests d'intégration).
   */
  disable(): void {
    this.enabled = false;
  }

  enable(): void {
    this.enabled = true;
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async scanStuckCombats(): Promise<void> {
    if (!this.enabled) return;

    // Lock global pour éviter que 2 instances fassent le même scan en parallèle.
    // Si une autre instance scan, on skip ce tick.
    const result = await this.distributedLock.tryWithLock(
      'combat:watchdog:lock',
      WATCHDOG_LOCK_TTL_SECONDS,
      () => this.doScan(),
    );

    if (result === null) {
      this.logger.debug('Watchdog: another instance is scanning, skipping this tick');
    }
  }

  async doScan(): Promise<{ scanned: number; timedOut: number }> {
    const keys = await this.redis.keys('combat:*');
    // Filtrer les clés qui ressemblent à un state combat (pas les locks ou autres)
    const stateKeys = keys.filter(
      (k) => !k.startsWith('combat:lock:') && !k.startsWith('combat:watchdog:'),
    );

    let timedOut = 0;
    const now = Date.now();

    for (const key of stateKeys) {
      try {
        const state = await this.redis.getJson<CombatState & { lastActionAt?: number }>(key);
        if (!state || state.winnerId) continue;

        const lastActionAt = state.lastActionAt ?? 0;
        if (lastActionAt === 0) continue; // pas encore tracké
        if (now - lastActionAt <= TURN_TIMEOUT_SECONDS * 1000) continue;

        this.logger.warn(
          `Combat ${state.sessionId}: timeout détecté (${Math.round((now - lastActionAt) / 1000)}s sans action). Force END_TURN.`,
        );

        // Émet un event SSE pour que les clients sachent
        this.sse.emit(state.sessionId, 'TURN_TIMED_OUT', {
          playerId: state.currentTurnPlayerId,
          turnNumber: state.turnNumber,
        });

        // Publie un event interne — le TurnService peut l'écouter pour forcer un END_TURN
        this.eventEmitter.emit(GAME_EVENTS.TURN_STARTED, {
          sessionId: state.sessionId,
          playerId: state.currentTurnPlayerId,
          timeout: true,
        });

        timedOut += 1;
      } catch (err) {
        this.logger.error(`Watchdog: erreur en scannant ${key}: ${err}`);
      }
    }

    return { scanned: stateKeys.length, timedOut };
  }
}
