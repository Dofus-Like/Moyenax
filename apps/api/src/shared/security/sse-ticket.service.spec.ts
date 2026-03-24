import { ForbiddenException } from '@nestjs/common';
import { SseTicketService } from './sse-ticket.service';

describe('SseTicketService', () => {
  const redis = {
    del: jest.fn(),
    getJson: jest.fn(),
    setJson: jest.fn(),
  };

  let service: SseTicketService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SseTicketService(redis as any);
  });

  it('issues a redis-backed ticket with a short ttl', async () => {
    const result = await service.issueTicket({
      userId: 'player-1',
      resourceId: 'session-1',
      resourceType: 'game-session',
    });

    expect(result.ticket).toBeTruthy();
    expect(result.expiresIn).toBe(60);
    expect(redis.setJson).toHaveBeenCalledWith(
      expect.stringMatching(/^sse-ticket:/),
      {
        userId: 'player-1',
        resourceId: 'session-1',
        resourceType: 'game-session',
      },
      60,
    );
  });

  it('consumes a valid ticket and deletes it afterwards', async () => {
    redis.getJson.mockResolvedValue({
      userId: 'player-1',
      resourceId: 'session-1',
      resourceType: 'combat',
    });

    await expect(service.consumeTicket('ticket-1', 'combat', 'session-1')).resolves.toEqual({
      userId: 'player-1',
      resourceId: 'session-1',
      resourceType: 'combat',
    });
    expect(redis.del).toHaveBeenCalledWith('sse-ticket:ticket-1');
  });

  it('rejects an invalid or expired ticket', async () => {
    redis.getJson.mockResolvedValue(null);

    await expect(service.consumeTicket('ticket-1', 'combat', 'session-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
