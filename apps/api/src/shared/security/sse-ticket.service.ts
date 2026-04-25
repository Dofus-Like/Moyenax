import { randomUUID } from 'node:crypto';

import { ForbiddenException, Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

import { SSE_TICKET_PREFIX, SSE_TICKET_TTL_SECONDS } from './security.constants';

export type SseResourceType = 'game-session' | 'combat';

export interface SseTicketPayload {
  userId: string;
  resourceId: string;
  resourceType: SseResourceType;
}

@Injectable()
export class SseTicketService {
  constructor(private readonly redis: RedisService) {}

  async issueTicket(payload: SseTicketPayload) {
    const ticket = randomUUID();
    await this.redis.setJson(`${SSE_TICKET_PREFIX}:${ticket}`, payload, SSE_TICKET_TTL_SECONDS);

    return {
      ticket,
      expiresIn: SSE_TICKET_TTL_SECONDS,
    };
  }

  async consumeTicket(
    ticket: string,
    resourceType: SseResourceType,
    resourceId: string,
  ): Promise<SseTicketPayload> {
    const key = `${SSE_TICKET_PREFIX}:${ticket}`;
    const payload = await this.redis.getJson<SseTicketPayload>(key);

    if (!payload) {
      throw new ForbiddenException('Ticket SSE invalide ou expire');
    }

    await this.redis.del(key);

    if (payload.resourceType !== resourceType || payload.resourceId !== resourceId) {
      throw new ForbiddenException('Ticket SSE invalide pour ce flux');
    }

    return payload;
  }
}
