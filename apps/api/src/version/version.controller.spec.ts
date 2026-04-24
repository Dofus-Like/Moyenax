import { VersionController } from './version.controller';

describe('VersionController', () => {
  const controller = new VersionController();

  afterEach(() => {
    delete process.env.BUILD_SHA;
    delete process.env.BUILD_TIME;
  });

  it('retourne les env vars BUILD_SHA et BUILD_TIME', () => {
    process.env.BUILD_SHA = 'abc123';
    process.env.BUILD_TIME = '2026-04-24';
    const r = controller.getVersion();
    expect(r).toEqual({
      sha: 'abc123',
      builtAt: '2026-04-24',
      uptimeSeconds: expect.any(Number),
    });
  });

  it('retourne "unknown" si BUILD_SHA absent', () => {
    const r = controller.getVersion();
    expect(r.sha).toBe('unknown');
    expect(r.builtAt).toBe('unknown');
  });

  it('uptimeSeconds est un entier positif', () => {
    const r = controller.getVersion();
    expect(Number.isInteger(r.uptimeSeconds)).toBe(true);
    expect(r.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
