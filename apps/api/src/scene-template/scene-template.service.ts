import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../shared/prisma/prisma.service';

const SUMMARY = { id: true, name: true, updatedAt: true } as const;

@Injectable()
export class SceneTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  // Upsert by (owner, name): saving under an existing name overwrites it.
  async save(ownerId: string, name: string, data: Record<string, unknown>) {
    return this.prisma.sceneTemplate.upsert({
      where: { ownerId_name: { ownerId, name } },
      create: { ownerId, name, data: data as Prisma.InputJsonValue },
      update: { data: data as Prisma.InputJsonValue },
      select: SUMMARY,
    });
  }

  async list(ownerId: string) {
    return this.prisma.sceneTemplate.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      select: SUMMARY,
    });
  }

  async get(ownerId: string, id: string) {
    const scene = await this.prisma.sceneTemplate.findFirst({ where: { id, ownerId } });
    if (!scene) throw new NotFoundException('Scène introuvable');
    return scene;
  }

  async remove(ownerId: string, id: string) {
    await this.prisma.sceneTemplate.deleteMany({ where: { id, ownerId } });
    return { ok: true };
  }
}
