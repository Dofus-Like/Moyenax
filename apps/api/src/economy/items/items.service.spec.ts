import { Test, TestingModule } from '@nestjs/testing';
import { ItemsService } from './items.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

describe('ItemsService', () => {
  let service: ItemsService;
  let prisma: { item: { findMany: jest.Mock; findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      item: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ItemsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ItemsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('findAll retourne tous les items', async () => {
    const items = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    prisma.item.findMany.mockResolvedValue(items);
    const result = await service.findAll();
    expect(result).toEqual(items);
    expect(prisma.item.findMany).toHaveBeenCalledWith();
  });

  it('findAll retourne liste vide si aucun item', async () => {
    prisma.item.findMany.mockResolvedValue([]);
    expect(await service.findAll()).toEqual([]);
  });

  it('findById retourne l\'item', async () => {
    prisma.item.findUnique.mockResolvedValue({ id: 'x' });
    const result = await service.findById('x');
    expect(result).toEqual({ id: 'x' });
    expect(prisma.item.findUnique).toHaveBeenCalledWith({ where: { id: 'x' } });
  });

  it('findById retourne null si inexistant', async () => {
    prisma.item.findUnique.mockResolvedValue(null);
    expect(await service.findById('ghost')).toBeNull();
  });
});
