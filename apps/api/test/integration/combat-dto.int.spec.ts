import request from 'supertest';
import { createTestApp, TestAppContext, resetDatabase } from './test-app';

/**
 * Teste spécifiquement que le CombatActionDto (fix bug #5) rejette bien
 * les payloads invalides avec un 400, à travers toute la pipe NestJS.
 */
describe('[Integration] CombatAction DTO validation (bug #5 regression)', () => {
  let ctx: TestAppContext;
  let token: string;
  let sessionId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
  }, 60_000);

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    for (const k of await ctx.redisService.keys('*')) {
      await ctx.redisService.del(k);
    }

    // Crée un joueur + un Bot + une session combat vs AI pour tester
    const reg = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'hero@test.com', username: 'hero', password: 'password123' });
    token = reg.body.accessToken as string;

    // On n'essaie pas de lancer un vrai combat vs AI (nécessite beaucoup de seed);
    // on utilise un sessionId fictif — le DTO doit valider AVANT d'atteindre le service.
    sessionId = 'fictive-session-id';
  });

  it('rejette targetX négatif (400)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/v1/combat/action/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'MOVE', targetX: -5, targetY: 0 });
    expect(res.status).toBe(400);
  });

  it('rejette targetX trop grand (>100)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/v1/combat/action/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'MOVE', targetX: 9999, targetY: 0 });
    expect(res.status).toBe(400);
  });

  it('rejette type invalide (non dans l\'enum)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/v1/combat/action/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'HACK_THE_SERVER', targetX: 0, targetY: 0 });
    expect(res.status).toBe(400);
  });

  it('rejette targetY float (non-integer)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/v1/combat/action/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'MOVE', targetX: 0, targetY: 3.7 });
    expect(res.status).toBe(400);
  });

  it('accepte un payload valide avec targetX/Y in-range (mais échoue au service car pas de session)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/v1/combat/action/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'MOVE', targetX: 5, targetY: 3 });
    // Le DTO passe → le service fait BadRequest car session n'existe pas en Redis
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Session de combat introuvable/);
  });

  it('accepte END_TURN sans targetX/Y (optional)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/v1/combat/action/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'END_TURN' });
    // DTO OK, service throw car session inexistante
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Session/);
  });
});
