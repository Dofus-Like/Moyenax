import request from 'supertest';
import { createTestApp, TestAppContext, resetDatabase } from './test-app';

describe('[Integration] Matchmaking (race conditions with real Redis)', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
  }, 60_000);

  async function createPlayer(email: string, username: string): Promise<string> {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, username, password: 'password123' });
    return res.body.accessToken as string;
  }

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    // Purger Redis aussi
    for (const k of await ctx.redisService.keys('*')) {
      await ctx.redisService.del(k);
    }
  });

  it('un joueur seul en queue → status searching', async () => {
    const token = await createPlayer('p1@test.com', 'p1');
    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/game-session/join-queue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('searching');
  });

  it('deux joueurs en queue → matched', async () => {
    const t1 = await createPlayer('p1@test.com', 'p1');
    const t2 = await createPlayer('p2@test.com', 'p2');

    await request(ctx.app.getHttpServer())
      .post('/api/v1/game-session/join-queue')
      .set('Authorization', `Bearer ${t1}`)
      .expect(201);

    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/game-session/join-queue')
      .set('Authorization', `Bearer ${t2}`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('matched');
    expect(res.body.sessionId).toBeDefined();
  });

  it('rejoindre deux fois → already_in_queue', async () => {
    const token = await createPlayer('p1@test.com', 'p1');
    await request(ctx.app.getHttpServer())
      .post('/api/v1/game-session/join-queue')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(ctx.app.getHttpServer())
      .post('/api/v1/game-session/join-queue')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.status).toBe('already_in_queue');
  });

  it('leave-queue retire le joueur', async () => {
    const token = await createPlayer('p1@test.com', 'p1');
    await request(ctx.app.getHttpServer())
      .post('/api/v1/game-session/join-queue')
      .set('Authorization', `Bearer ${token}`);

    const leave = await request(ctx.app.getHttpServer())
      .post('/api/v1/game-session/leave-queue')
      .set('Authorization', `Bearer ${token}`);
    expect(leave.status).toBe(201);
    expect(leave.body.status).toBe('left');

    // On peut re-joindre
    const rejoin = await request(ctx.app.getHttpServer())
      .post('/api/v1/game-session/join-queue')
      .set('Authorization', `Bearer ${token}`);
    expect(rejoin.body.status).toBe('searching');
  });

  it('[BUG #6 REGRESSION] join concurrent de 2 joueurs → exactement 1 session créée', async () => {
    const t1 = await createPlayer('p1@test.com', 'p1');
    const t2 = await createPlayer('p2@test.com', 'p2');

    // Deux POST en parallèle
    const [r1, r2] = await Promise.all([
      request(ctx.app.getHttpServer())
        .post('/api/v1/game-session/join-queue')
        .set('Authorization', `Bearer ${t1}`),
      request(ctx.app.getHttpServer())
        .post('/api/v1/game-session/join-queue')
        .set('Authorization', `Bearer ${t2}`),
    ]);

    // Les deux requêtes réussissent
    expect([r1.status, r2.status]).toEqual([201, 201]);

    // Exactement une session créée
    const sessions = await ctx.prisma.gameSession.findMany();
    expect(sessions).toHaveLength(1);

    // Et exactement un des 2 statuses est "matched" (l'autre est searching ou matched selon l'ordre)
    const statuses = [r1.body.status, r2.body.status].sort();
    // Acceptable: [matched, searching] OU [matched, matched] (si le second GET arrive juste après le match)
    expect(statuses).toContain('matched');
  });

  it('GET /game-session/queue-status retourne queued:true après join', async () => {
    const token = await createPlayer('p1@test.com', 'p1');
    await request(ctx.app.getHttpServer())
      .post('/api/v1/game-session/join-queue')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(ctx.app.getHttpServer())
      .get('/api/v1/game-session/queue-status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.queued).toBe(true);
  });
});
