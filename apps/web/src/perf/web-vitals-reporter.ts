import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals';

import { usePerfHudStore } from './perf-hud.store';

let started = false;

export function startWebVitalsReporter(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const setVital = (key: 'LCP' | 'INP' | 'CLS' | 'TTFB' | 'FCP') => (metric: { value: number }) => {
    usePerfHudStore.getState().setVital(key, Number(metric.value.toFixed(2)));
  };

  onLCP(setVital('LCP'));
  onINP(setVital('INP'));
  onCLS(setVital('CLS'));
  onTTFB(setVital('TTFB'));
  onFCP(setVital('FCP'));
}
