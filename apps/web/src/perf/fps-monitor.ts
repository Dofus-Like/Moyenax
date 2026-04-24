import { usePerfHudStore } from './perf-hud.store';

let rafId: number | null = null;

export function startFpsMonitor(): void {
  if (rafId !== null || typeof window === 'undefined') return;

  let lastTime = performance.now();
  let frames = 0;
  let lastFrameTs = lastTime;
  let maxFrameMs = 0;

  const loop = (now: number) => {
    const frameMs = now - lastFrameTs;
    lastFrameTs = now;
    if (frameMs > maxFrameMs) maxFrameMs = frameMs;
    frames += 1;

    const elapsed = now - lastTime;
    if (elapsed >= 1000) {
      const fps = Math.round((frames * 1000) / elapsed);
      usePerfHudStore.getState().setFps(fps, Number(maxFrameMs.toFixed(1)));
      frames = 0;
      maxFrameMs = 0;
      lastTime = now;
    }

    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);
}

export function stopFpsMonitor(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}
