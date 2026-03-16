import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../shared/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<{ accessToken: string }> {
    const existing = await this.prisma.player.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      throw new ConflictException('Un joueur avec cet email ou pseudo existe déjà');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const player = await this.prisma.player.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        stats: {
          create: {
            baseHp: 100,
            baseAp: 6,
            baseMp: 4,
            strength: 10,
            agility: 10,
            initiative: 10,
          },
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
    const player = await this.prisma.player.findUnique({
      where: { email: dto.email },
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
      select: { id: true, username: true, email: true, gold: true },
    });

    if (!player) {
      throw new UnauthorizedException('Joueur introuvable');
    }

    return player;
  }
}
