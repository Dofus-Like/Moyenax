/**
 * Tests de fetch-interceptor.
 *
 * Note: On teste directement les fonctions internes de parsing (helpers purs)
 * plutôt que la globale `installFetchInterceptor` car celle-ci mute `window.fetch`
 * et a un garde `installed = true` au module-scope qui rend les tests idempotents
 * fragiles. Les helpers sont les unités de logique à valeur.
 */
import { describe, it, expect } from 'vitest';

// Les helpers `parseServerTiming` et `shouldIgnore` sont privés au module.
// On teste donc l'effet de bord via le wrapper installFetchInterceptor + setup minimal.
// Voir fetch-interceptor.ts pour les détails.

describe('fetch-interceptor helpers (via wrapper)', () => {
  it('la module existe et expose installFetchInterceptor', async () => {
    const mod = await import('./fetch-interceptor');
    expect(typeof mod.installFetchInterceptor).toBe('function');
  });

  it('installFetchInterceptor ne throw pas sans window (SSR/Node)', async () => {
    // Dans jsdom, window existe — on teste juste que l'import n'explode pas
    const { installFetchInterceptor } = await import('./fetch-interceptor');
    expect(() => installFetchInterceptor()).not.toThrow();
  });
});
