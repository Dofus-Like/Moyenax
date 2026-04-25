import { Injectable } from '@nestjs/common';

import { PrismaService } from '../shared/prisma/prisma.service';

@Injectable()
export class PlayerService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.player.findUnique({
      where: { id },
      include: { stats: true },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.player.findUnique({
      where: { username },
      include: { stats: true },
    });
  }
}
