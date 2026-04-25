import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SSE_RESOURCE_TYPE_KEY } from './sse-ticket.decorator';
import { SseResourceType, SseTicketService } from './sse-ticket.service';

@Injectable()
export class SseTicketGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sseTickets: SseTicketService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ticket = request.query?.ticket;
    const resourceId = request.params?.id;
    const resourceType = this.reflector.getAllAndOverride<SseResourceType>(SSE_RESOURCE_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (typeof ticket !== 'string' || !ticket) {
      throw new ForbiddenException('Ticket SSE requis');
    }

    if (typeof resourceId !== 'string' || !resourceId || !resourceType) {
      throw new ForbiddenException('Flux SSE invalide');
    }

    request.sseTicket = await this.sseTickets.consumeTicket(ticket, resourceType, resourceId);
    return true;
  }
}
