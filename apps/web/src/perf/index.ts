import { apiClient } from '../api/client';
import { installAxiosInterceptor } from './axios-interceptor';
import { startBackendPoller } from './backend-poller';
import { installFetchInterceptor } from './fetch-interceptor';
import { startFpsMonitor } from './fps-monitor';
import { startLongTaskObserver } from './long-tasks';
import { startMemoryMonitor } from './memory-monitor';
import { installSseInspector } from './sse-inspector';
import { startWebVitalsReporter } from './web-vitals-reporter';

export { CanvasPerfOverlay } from './CanvasPerfOverlay';
export { PerfHud } from './PerfHud';
export { ProfiledRegion } from './render-profiler';
export { usePerfHudStore } from './perf-hud.store';

let initialized = false;

/**
 * Boot the perf monitoring system. Safe to call multiple times.
 * Must be guarded by VITE_SHOW_DEBUG at the call site.
 */
export function initPerfHud(): void {
  if (initialized) return;
  initialized = true;

  installFetchInterceptor();
  installAxiosInterceptor(apiClient);
  installSseInspector();
  startWebVitalsReporter();
  startFpsMonitor();
  startLongTaskObserver();
  startMemoryMonitor(2000);
  startBackendPoller(2000);
}
