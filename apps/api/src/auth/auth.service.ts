import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../shared/prisma/prisma.service';
import { DEFAULT_SKIN_BY_CLASS } from '../shared/security/security.constants';
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
    const skin = DEFAULT_SKIN_BY_CLASS[dto.selectedClass as keyof typeof DEFAULT_SKIN_BY_CLASS];

    const player = await this.prisma.player.create({
      data: {
        username: dto.username,
        email: normalizedEmail,
        passwordHash,
        skin,
        stats: {
          create: {
            vit: 100,
            atk: 10,
            mag: 10,
            def: 5,
            res: 5,
            ini: 100,
            pa: 6,
            pm: 3,
            baseVit: 100,
            baseAtk: 10,
            baseMag: 10,
            baseDef: 5,
            baseRes: 5,
            baseIni: 100,
            basePa: 6,
            basePm: 3,
          },
        },
      },
    });

    const ringNames = ['Anneau du Guerrier', 'Anneau du Mage', 'Anneau du Ninja'];
    const rings = await this.prisma.item.findMany({
      where: { name: { in: ringNames } },
    });

    const inventoryItems = await Promise.all(
      rings.map((ring: { id: string }) =>
        this.prisma.inventoryItem.create({
          data: {
            playerId: player.id,
            itemId: ring.id,
            quantity: 1,
            rank: 3,
          },
        }),
      ),
    );

    let targetRingName = 'Anneau du Guerrier';
    if (dto.selectedClass === 'mage') targetRingName = 'Anneau du Mage';
    if (dto.selectedClass === 'ninja') targetRingName = 'Anneau du Ninja';

    const selectedInventoryItem = inventoryItems.find((inventoryItem: { itemId: string }) => {
      const ring = rings.find(
        (candidate: { id: string; name: string }) => candidate.id === inventoryItem.itemId,
      );
      return ring?.name === targetRingName;
    });

    if (selectedInventoryItem) {
      await this.prisma.equipmentSlot.create({
        data: {
          playerId: player.id,
          slot: 'ACCESSORY',
          inventoryItemId: selectedInventoryItem.id,
        },
      });
    }

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
