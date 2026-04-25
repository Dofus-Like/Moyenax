import request from 'supertest';
import { createTestApp, TestAppContext, resetDatabase } from './test-app';

describe('[Integration] Auth flow (real Postgres + Redis)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
  }, 60_000);

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  it('POST /auth/register crée un joueur en DB', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@test.com', username: 'alice', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toMatch(/^eyJ/); // JWT

    const player = await ctx.prisma.player.findUnique({
      where: { email: 'alice@test.com' },
    });
    expect(player).not.toBeNull();
    expect(player?.username).toBe('alice');
    expect(player?.gold).toBe(100);
  });

  it('POST /auth/register rejette email dupliqué (409)', async () => {
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@test.com', username: 'alice', password: 'password123' })
      .expect(201);

    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'alice@test.com', username: 'alice2', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('POST /auth/register rejette username trop court (400 via DTO)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'x@x.com', username: 'a', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/register rejette password trop court (400)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'x@x.com', username: 'alice', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/register rejette email invalide (400)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', username: 'alice', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/login avec bons identifiants retourne un token', async () => {
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'bob@test.com', username: 'bob', password: 'password123' });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'bob@test.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it('POST /auth/login avec mauvais password → 401', async () => {
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'bob@test.com', username: 'bob', password: 'password123' });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'bob@test.com', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('GET /auth/me sans token → 401', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /auth/me avec token valide retourne le profil', async () => {
    const register = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'carol@test.com', username: 'carol', password: 'password123' });
    const token = register.body.accessToken as string;

    const res = await request(ctx.app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('carol@test.com');
    expect(res.body.passwordHash).toBeUndefined(); // ne doit PAS être exposé
  });

  it('email normalisé (trim + lowercase)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: '  ALICE@TEST.COM  ', username: 'alice', password: 'password123' });
    expect(res.status).toBe(201);

    const player = await ctx.prisma.player.findUnique({
      where: { email: 'alice@test.com' },
    });
    expect(player).not.toBeNull();
  });
});
