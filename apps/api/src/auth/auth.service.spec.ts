import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../shared/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    player: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = {
      player: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwt = { sign: jest.fn().mockReturnValue('signed-jwt-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const validDto = {
      email: 'Alice@Example.Com',
      username: 'alice',
      password: 'password123',
    };

    it('normalise l\'email (trim + lowercase) avant lookup', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.player.create.mockResolvedValue({
        id: 'p-1',
        username: 'alice',
        email: 'alice@example.com',
      });

      await service.register({ ...validDto, email: '  Alice@Example.Com  ' });

      expect(prisma.player.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ email: 'alice@example.com' }, { username: 'alice' }] },
      });
    });

    it('jette ConflictException si email existe déjà', async () => {
      prisma.player.findFirst.mockResolvedValue({ id: 'p-old' });

      await expect(service.register(validDto)).rejects.toThrow(ConflictException);
      expect(prisma.player.create).not.toHaveBeenCalled();
    });

    it('jette ConflictException si username existe déjà', async () => {
      prisma.player.findFirst.mockResolvedValue({ id: 'p-old' });

      await expect(service.register(validDto)).rejects.toThrow(/existe/i);
    });

    it('hash le password avec bcrypt 10 rounds', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.player.create.mockResolvedValue({ id: 'p-1', username: 'alice', email: 'alice@example.com' });

      await service.register(validDto);

      const createArg = prisma.player.create.mock.calls[0][0];
      expect(createArg.data.passwordHash).not.toBe(validDto.password);
      // bcrypt.compare doit confirmer le hash
      const match = await bcrypt.compare(validDto.password, createArg.data.passwordHash);
      expect(match).toBe(true);
    });

    it('crée le joueur avec gold=100, skin=warrior et stats par défaut', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.player.create.mockResolvedValue({ id: 'p-1', username: 'alice', email: 'alice@example.com' });

      await service.register(validDto);

      const createArg = prisma.player.create.mock.calls[0][0];
      expect(createArg.data.gold).toBe(100);
      expect(createArg.data.skin).toBe('warrior');
      expect(createArg.data.stats).toBeDefined();
      expect(createArg.data.stats.create).toBeDefined();
    });

    it('retourne un accessToken JWT signé avec sub/username/email', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.player.create.mockResolvedValue({
        id: 'player-id',
        username: 'alice',
        email: 'alice@example.com',
      });

      const result = await service.register(validDto);

      expect(jwt.sign).toHaveBeenCalledWith({
        sub: 'player-id',
        username: 'alice',
        email: 'alice@example.com',
      });
      expect(result).toEqual({ accessToken: 'signed-jwt-token' });
    });
  });

  describe('login', () => {
    const validDto = { email: 'alice@example.com', password: 'password123' };

    it('jette UnauthorizedException si joueur introuvable', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.login(validDto)).rejects.toThrow(UnauthorizedException);
    });

    it('jette UnauthorizedException si password invalide', async () => {
      const hash = await bcrypt.hash('correct-password', 10);
      prisma.player.findUnique.mockResolvedValue({
        id: 'p-1',
        username: 'alice',
        email: 'alice@example.com',
        passwordHash: hash,
      });

      await expect(service.login({ ...validDto, password: 'wrong-password' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('normalise email avant lookup', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.login({ ...validDto, email: '  ALICE@Example.com  ' })).rejects.toThrow();
      expect(prisma.player.findUnique).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
    });

    it('retourne accessToken si password valide', async () => {
      const hash = await bcrypt.hash(validDto.password, 10);
      prisma.player.findUnique.mockResolvedValue({
        id: 'p-1',
        username: 'alice',
        email: 'alice@example.com',
        passwordHash: hash,
      });

      const result = await service.login(validDto);
      expect(result).toEqual({ accessToken: 'signed-jwt-token' });
      expect(jwt.sign).toHaveBeenCalled();
    });

    it('ne fuite PAS l\'info qui a échoué (email vs password) [sécurité]', async () => {
      // Même message d'erreur pour email inconnu et password faux
      prisma.player.findUnique.mockResolvedValueOnce(null);
      const err1 = await service.login(validDto).catch((e) => e);

      const hash = await bcrypt.hash('another', 10);
      prisma.player.findUnique.mockResolvedValueOnce({
        id: 'p', username: 'a', email: 'a', passwordHash: hash,
      });
      const err2 = await service.login(validDto).catch((e) => e);

      expect(err1.message).toBe(err2.message);
    });
  });

  describe('validateUser', () => {
    it('retourne le joueur (avec select limité, sans passwordHash)', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 'p-1',
        username: 'alice',
        email: 'alice@example.com',
        gold: 100,
        skin: 'warrior',
      });

      const result = await service.validateUser('p-1');

      expect(result).toEqual({
        id: 'p-1',
        username: 'alice',
        email: 'alice@example.com',
        gold: 100,
        skin: 'warrior',
      });
      const selectArg = prisma.player.findUnique.mock.calls[0][0].select;
      expect(selectArg.passwordHash).toBeUndefined();
      expect(selectArg.id).toBe(true);
      expect(selectArg.email).toBe(true);
    });

    it('jette UnauthorizedException si joueur inexistant', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      await expect(service.validateUser('ghost')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('updateSkin', () => {
    it('update le skin du joueur', async () => {
      prisma.player.update.mockResolvedValue({ id: 'p-1', username: 'alice', skin: 'mage' });
      const result = await service.updateSkin('p-1', 'mage');
      expect(result).toEqual({ id: 'p-1', username: 'alice', skin: 'mage' });
      expect(prisma.player.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { skin: 'mage' },
        select: { id: true, username: true, skin: true },
      });
    });
  });
});
