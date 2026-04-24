import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SseTicketGuard } from './sse-ticket.guard';
import { SseResourceType, SseTicketService } from './sse-ticket.service';

function makeContext(request: Record<string, any>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }) as any,
    getHandler: () => ({}) as any,
    getClass: () => ({}) as any,
  } as ExecutionContext;
}

describe('SseTicketGuard', () => {
  let guard: SseTicketGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let tickets: { consumeTicket: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    tickets = { consumeTicket: jest.fn() };
    guard = new SseTicketGuard(
      reflector as unknown as Reflector,
      tickets as unknown as SseTicketService,
    );
  });

  it('throw Forbidden si ticket manquant', async () => {
    reflector.getAllAndOverride.mockReturnValue('combat-session');
    const ctx = makeContext({ query: {}, params: { id: 's1' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throw Forbidden si ticket vide (empty string)', async () => {
    reflector.getAllAndOverride.mockReturnValue('combat-session');
    const ctx = makeContext({ query: { ticket: '' }, params: { id: 's1' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throw Forbidden si ticket n\'est pas une string', async () => {
    reflector.getAllAndOverride.mockReturnValue('combat-session');
    const ctx = makeContext({ query: { ticket: 42 }, params: { id: 's1' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throw Forbidden si resourceId manquant', async () => {
    reflector.getAllAndOverride.mockReturnValue('combat-session');
    const ctx = makeContext({ query: { ticket: 'abc' }, params: {} });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throw Forbidden si resourceType non configuré (decorator absent)', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeContext({ query: { ticket: 'abc' }, params: { id: 's1' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Flux SSE invalide/);
  });

  it('consomme le ticket et autorise si tout OK', async () => {
    reflector.getAllAndOverride.mockReturnValue('combat-session' as SseResourceType);
    tickets.consumeTicket.mockResolvedValue({ playerId: 'p1', resourceId: 's1' });
    const request: Record<string, any> = { query: { ticket: 'valid' }, params: { id: 's1' } };
    const ctx = makeContext(request);

    const ok = await guard.canActivate(ctx);

    expect(ok).toBe(true);
    expect(tickets.consumeTicket).toHaveBeenCalledWith('valid', 'combat-session', 's1');
    expect(request['sseTicket']).toEqual({ playerId: 'p1', resourceId: 's1' });
  });

  it('propage une erreur si consumeTicket échoue', async () => {
    reflector.getAllAndOverride.mockReturnValue('combat-session' as SseResourceType);
    tickets.consumeTicket.mockRejectedValue(new ForbiddenException('ticket expiré'));
    const ctx = makeContext({ query: { ticket: 'expired' }, params: { id: 's1' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/expiré/);
  });
});
