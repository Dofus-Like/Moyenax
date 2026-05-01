import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

const noop = (): void => undefined;

class ResizeObserverPolyfill {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
}

const globalAny = globalThis as unknown as { ResizeObserver?: unknown };
const windowAny = (typeof window !== 'undefined'
  ? (window as unknown as { ResizeObserver?: unknown })
  : null);

if (typeof globalAny.ResizeObserver !== 'function') {
  globalAny.ResizeObserver = ResizeObserverPolyfill;
}
if (windowAny && typeof windowAny.ResizeObserver !== 'function') {
  windowAny.ResizeObserver = ResizeObserverPolyfill;
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => false,
  });
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? (store.get(k) ?? null) : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  });
}
