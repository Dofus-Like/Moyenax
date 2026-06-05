import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PrismaService } from '../shared/prisma/prisma.service';

import { SceneTemplateService } from './scene-template.service';

describe('SceneTemplateService', () => {
  let service: SceneTemplateService;
  let prisma: {
    sceneTemplate: {
      upsert: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      sceneTemplate: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [SceneTemplateService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(SceneTemplateService);
  });

  it('save fait un upsert par (owner, name)', async () => {
    prisma.sceneTemplate.upsert.mockResolvedValue({ id: 's1', name: 'A', updatedAt: new Date() });
    await service.save('u1', 'A', { x: 1 });
    expect(prisma.sceneTemplate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId_name: { ownerId: 'u1', name: 'A' } } }),
    );
  });

  it('list filtre par owner', async () => {
    prisma.sceneTemplate.findMany.mockResolvedValue([]);
    await service.list('u1');
    expect(prisma.sceneTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'u1' } }),
    );
  });

  it('get lève NotFound si la scène n’existe pas', async () => {
    prisma.sceneTemplate.findFirst.mockResolvedValue(null);
    await expect(service.get('u1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove est scopé par owner', async () => {
    prisma.sceneTemplate.deleteMany.mockResolvedValue({ count: 1 });
    await service.remove('u1', 's1');
    expect(prisma.sceneTemplate.deleteMany).toHaveBeenCalledWith({
      where: { id: 's1', ownerId: 'u1' },
    });
  });
});
