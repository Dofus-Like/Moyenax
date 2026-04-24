import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import { RedisService } from '../shared/redis/redis.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };
  let redis: { ping: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };
    redis = { ping: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = module.get(HealthService);
  });

  it('retourne status ok avec services database et redis ok', async () => {
    prisma.$queryRaw.mockResolvedValue([1]);
    redis.ping.mockResolvedValue('PONG');

    const r = await service.check();
    expect(r.status).toBe('ok');
    expect(r.services).toEqual({ database: 'ok', redis: 'ok' });
    expect(r.timestamp).toEqual(expect.any(String));
    expect(r.uptimeSeconds).toEqual(expect.any(Number));
  });

  it('throw ServiceUnavailable si Prisma fail', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB down'));
    redis.ping.mockResolvedValue('PONG');
    await expect(service.check()).rejects.toThrow(ServiceUnavailableException);
  });

  it('throw ServiceUnavailable si Redis fail', async () => {
    prisma.$queryRaw.mockResolvedValue([1]);
    redis.ping.mockRejectedValue(new Error('Redis down'));
    await expect(service.check()).rejects.toThrow(ServiceUnavailableException);
  });

  it('propage le message d\'erreur', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('specific failure'));
    redis.ping.mockResolvedValue('PONG');
    try {
      await service.check();
    } catch (e: any) {
      expect(e.getResponse().message).toBe('specific failure');
    }
  });

  it('gère une exception non-Error (message fallback)', async () => {
    prisma.$queryRaw.mockRejectedValue('weird non-Error');
    redis.ping.mockResolvedValue('PONG');
    try {
      await service.check();
    } catch (e: any) {
      expect(e.getResponse().message).toBe('Unknown dependency failure');
    }
  });
});
