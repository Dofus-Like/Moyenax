import { Injectable } from '@nestjs/common';
import { RedisService } from '../shared/redis/redis.service';
import { GameSessionService } from './game-session.service';

@Injectable()
export class MatchmakingService {
  private readonly QUEUE_KEY = 'matchmaking:queue';

  constructor(
    private readonly redis: RedisService,
    private readonly gameSessionService: GameSessionService,
  ) {}

  async joinQueue(playerId: string) {
    // Vérifier si déjà en queue
    const queue = await this.redis.getJson<string[]>(this.QUEUE_KEY) || [];
    if (queue.includes(playerId)) return { status: 'already_in_queue' };

    // Ajouter à la queue
    queue.push(playerId);
    
    if (queue.length >= 2) {
      // On a un match !
      const p1 = queue.shift();
      const p2 = queue.shift();
      
      if (!p1 || !p2) {
        await this.redis.setJson(this.QUEUE_KEY, queue);
        return { status: 'searching' };
      }

      await this.redis.setJson(this.QUEUE_KEY, queue);
      
      const session = await this.gameSessionService.createSession(p1, p2);
      return { status: 'matched', sessionId: session.id };
    }

    await this.redis.setJson(this.QUEUE_KEY, queue);
    return { status: 'searching' };
  }

  async leaveQueue(playerId: string) {
    let queue = await this.redis.getJson<string[]>(this.QUEUE_KEY) || [];
    queue = queue.filter(id => id !== playerId);
    await this.redis.setJson(this.QUEUE_KEY, queue);
    return { status: 'left' };
  }
}
