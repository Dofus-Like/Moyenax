import { Test, TestingModule } from '@nestjs/testing';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { SseService } from '../../shared/sse/sse.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SseTicketGuard } from '../../shared/security/sse-ticket.guard';

describe('SessionController', () => {
  let controller: SessionController;
  let sessionService: Record<string, jest.Mock>;
  let sseService: { getStream: jest.Mock };

  beforeEach(async () => {
    sessionService = {
      startVsAiCombat: jest.fn().mockResolvedValue({ id: 's-ai' }),
      getRooms: jest.fn().mockResolvedValue([]),
      challenge: jest.fn().mockResolvedValue({ id: 'new-challenge' }),
      accept: jest.fn().mockResolvedValue({ id: 'accepted' }),
      getStateForParticipant: jest.fn().mockResolvedValue({}),
      issueStreamTicket: jest.fn().mockResolvedValue({ ticket: 'abc' }),
      getHistory: jest.fn().mockResolvedValue([]),
    };
    sseService = { getStream: jest.fn().mockReturnValue({ subscribe: jest.fn() }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        { provide: SessionService, useValue: sessionService },
        { provide: SseService, useValue: sseService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(SseTicketGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get(SessionController);
  });

  it('POST /combat/vs-ai appelle startVsAiCombat', async () => {
    await controller.startVsAiCombat({ user: { id: 'p1' } });
    expect(sessionService['startVsAiCombat']).toHaveBeenCalledWith('p1');
  });

  it('GET /combat/rooms retourne la liste des rooms', async () => {
    sessionService['getRooms'].mockResolvedValue([{ id: 'r1' }]);
    expect(await controller.getRooms()).toEqual([{ id: 'r1' }]);
  });

  it('POST /combat/challenge sans target crée une room publique', async () => {
    await controller.createRoom({ user: { id: 'p1' } });
    expect(sessionService['challenge']).toHaveBeenCalledWith('p1');
  });

  it('POST /combat/challenge/:targetId crée un défi direct', async () => {
    await controller.challenge('target-id', { user: { id: 'p1' } });
    expect(sessionService['challenge']).toHaveBeenCalledWith('p1', 'target-id');
  });

  it('POST /combat/accept/:sessionId accepte un défi', async () => {
    await controller.accept('s-1', { user: { id: 'p1' } });
    expect(sessionService['accept']).toHaveBeenCalledWith('s-1', 'p1');
  });

  it('GET /combat/session/:id retourne l\'état pour le participant', async () => {
    await controller.getState('s-1', { user: { id: 'p1' } });
    expect(sessionService['getStateForParticipant']).toHaveBeenCalledWith('s-1', 'p1');
  });

  it('POST /combat/session/:id/stream-ticket émet un ticket', async () => {
    const r = await controller.issueStreamTicket('s-1', { user: { id: 'p1' } });
    expect(r).toEqual({ ticket: 'abc' });
  });

  it('SSE /combat/session/:id/events délègue à sseService.getStream', () => {
    controller.events('s-1');
    expect(sseService.getStream).toHaveBeenCalledWith('s-1');
  });

  it('GET /combat/history retourne l\'historique', async () => {
    sessionService['getHistory'].mockResolvedValue([{ id: 'h' }]);
    expect(await controller.getHistory({ user: { id: 'p1' } })).toEqual([{ id: 'h' }]);
  });
});
