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

    // 1. Déterminer le skin de départ
    let skin = 'soldier-classic';
    if (dto.selectedClass === 'mage') skin = 'soldier-royal';
    if (dto.selectedClass === 'ninja') skin = 'soldier-dark';

    // 2. Créer le joueur avec ses stats de base (identiques pour tous)
    const player = await this.prisma.player.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        skin,
        stats: {
          create: {
             vit: 100, atk: 0, mag: 0, def: 0, res: 0, ini: 100, pa: 6, pm: 3,
             baseVit: 100, baseAtk: 0, baseMag: 0, baseDef: 0, baseRes: 0, baseIni: 100, basePa: 6, basePm: 3,
          },
        },
      },
    });

    // 3. Ajouter les 3 anneaux à l'inventaire
    const ringNames = ['Anneau du Guerrier', 'Anneau du Mage', 'Anneau du Ninja'];
    const rings = await this.prisma.item.findMany({
      where: { name: { in: ringNames } }
    });

    // On crée les items en inventaire
    const inventoryItems = await Promise.all(rings.map(ring => 
      this.prisma.inventoryItem.create({
        data: {
          playerId: player.id,
          itemId: ring.id,
          quantity: 1,
          rank: 3
        }
      })
    ));

    // 4. Équiper l'anneau correspondant à la classe choisie
    let targetRingName = 'Anneau du Guerrier';
    if (dto.selectedClass === 'mage') targetRingName = 'Anneau du Mage';
    if (dto.selectedClass === 'ninja') targetRingName = 'Anneau du Ninja';

    const selectedInventoryItem = inventoryItems.find(inv => {
      const ring = rings.find(r => r.id === inv.itemId);
      return ring?.name === targetRingName;
    });

    if (selectedInventoryItem) {
      await this.prisma.equipmentSlot.create({
        data: {
          playerId: player.id,
          slot: 'ACCESSORY',
          inventoryItemId: selectedInventoryItem.id
        }
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
