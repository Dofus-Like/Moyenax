import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { createDefaultPlayerStats } from '../player/default-player-stats';
import { PrismaService } from '../shared/prisma/prisma.service';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existing = await this.prisma.player.findFirst({
      where: { OR: [{ email: normalizedEmail }, { username: dto.username }] },
    });

    if (existing) {
      throw new ConflictException('Un joueur avec cet email ou pseudo existe deja');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    // Registration now creates a simple character without initial items
    // Classes are intended to be equipment-based (rings)
    const player = await this.prisma.player.create({
      data: {
        username: dto.username,
        email: normalizedEmail,
        passwordHash,
        gold: 100,
        skin: 'warrior', // Default skin
        stats: {
          create: createDefaultPlayerStats(),
        },
      },
    });

    const accessToken = this.jwtService.sign({
      sub: player.id,
      username: player.username,
      email: player.email,
    });

    return { accessToken };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const player = await this.prisma.player.findUnique({
      where: { email: normalizedEmail },
    });

    if (!player) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, player.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const accessToken = this.jwtService.sign({
      sub: player.id,
      username: player.username,
      email: player.email,
    });

    return { accessToken };
  }

  async validateUser(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, gold: true, skin: true },
    });

    if (!player) {
      throw new UnauthorizedException('Joueur introuvable');
    }

    return player;
  }

  async updateSkin(id: string, skin: string) {
    return this.prisma.player.update({
      where: { id },
      data: { skin },
      select: { id: true, username: true, skin: true },
    });
  }
}
