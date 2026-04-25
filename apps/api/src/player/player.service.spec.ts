import { Test, TestingModule } from '@nestjs/testing';
import { PlayerService } from './player.service';
import { PrismaService } from '../shared/prisma/prisma.service';

describe('PlayerService', () => {
  let service: PlayerService;
  let prisma: { player: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { player: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlayerService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(PlayerService);
  });

  afterEach(() => jest.clearAllMocks());

  it('findById inclut stats', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'p1', stats: {} });
    await service.findById('p1');
    expect(prisma.player.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      include: { stats: true },
    });
  });

  it('findById retourne null si introuvable', async () => {
    prisma.player.findUnique.mockResolvedValue(null);
    const result = await service.findById('ghost');
    expect(result).toBeNull();
  });

  it('findByUsername utilise la clé username', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: 'p1', username: 'alice', stats: {} });
    await service.findByUsername('alice');
    expect(prisma.player.findUnique).toHaveBeenCalledWith({
      where: { username: 'alice' },
      include: { stats: true },
    });
  });

  it('findByUsername retourne null si introuvable', async () => {
    prisma.player.findUnique.mockResolvedValue(null);
    const result = await service.findByUsername('ghost');
    expect(result).toBeNull();
  });
});
