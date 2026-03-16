import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { RedisService } from '../../shared/redis/redis.service';
import { SseService } from '../../shared/sse/sse.service';
import { CombatState } from '@game/shared-types';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sse: SseService,
  ) {}

  async challenge(challengerId: string, targetId: string) {
    if (challengerId === targetId) {
      throw new BadRequestException('Impossible de se défier soi-même');
    }

    const target = await this.prisma.player.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new NotFoundException('Joueur cible introuvable');
    }

    const session = await this.prisma.combatSession.create({
      data: {
        player1Id: challengerId,
        player2Id: targetId,
        status: 'WAITING',
      },
    });

    return session;
  }

  async accept(sessionId: string) {
    const session = await this.prisma.combatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session introuvable');
    }

    if (session.status !== 'WAITING') {
      throw new BadRequestException('Cette session ne peut plus être acceptée');
    }

    await this.prisma.combatSession.update({
      where: { id: sessionId },
      data: { status: 'ACTIVE' },
    });

    // Initialiser l'état de combat dans Redis
    const initialState: CombatState = {
      sessionId,
      currentTurnPlayerId: session.player1Id,
      turnNumber: 1,
      players: {
        [session.player1Id]: {
          playerId: session.player1Id,
          stats: { hp: 100, maxHp: 100, ap: 6, maxAp: 6, mp: 4, maxMp: 4, strength: 10, agility: 10, initiative: 10 },
          position: { x: 0, y: 0 },
          spells: [],
          remainingAp: 6,
          remainingMp: 4,
          spellCooldowns: {},
        },
        [session.player2Id]: {
          playerId: session.player2Id,
          stats: { hp: 100, maxHp: 100, ap: 6, maxAp: 6, mp: 4, maxMp: 4, strength: 10, agility: 10, initiative: 10 },
          position: { x: 9, y: 9 },
          spells: [],
          remainingAp: 6,
          remainingMp: 4,
          spellCooldowns: {},
        },
      },
      map: {
        width: 10,
        height: 10,
        obstacles: [],
      },
    };

    await this.redis.setJson(`combat:${sessionId}`, initialState, 3600);

    this.sse.emit(sessionId, 'combat:start', initialState);

    return initialState;
  }

  async getState(sessionId: string): Promise<CombatState> {
    const state = await this.redis.getJson<CombatState>(`combat:${sessionId}`);
    if (!state) {
      throw new NotFoundException('État de combat introuvable');
    }
    return state;
  }

  async getHistory(playerId: string) {
    return this.prisma.combatSession.findMany({
      where: {
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
        status: 'FINISHED',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
