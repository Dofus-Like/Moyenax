import request from 'supertest';
import { createTestApp, TestAppContext } from './test-app';

describe('[Integration] Health & Version endpoints', () => {
  let ctx: TestAppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await ctx?.close();
  }, 60_000);

  it('GET /health retourne status ok avec Postgres + Redis connectés', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      services: { database: 'ok', redis: 'ok' },
    });
    expect(res.body.uptimeSeconds).toEqual(expect.any(Number));
    expect(res.body.timestamp).toEqual(expect.any(String));
  });

  it('GET /version retourne le build metadata', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/v1/version');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('sha');
    expect(res.body).toHaveProperty('builtAt');
    expect(res.body).toHaveProperty('uptimeSeconds');
  });

  it('endpoints non protégés n\'exigent pas de JWT', async () => {
    await request(ctx.app.getHttpServer()).get('/api/v1/health').expect(200);
    await request(ctx.app.getHttpServer()).get('/api/v1/version').expect(200);
  });
});
