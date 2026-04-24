import React, { Profiler, type ProfilerOnRenderCallback } from 'react';
import { usePerfHudStore } from './perf-hud.store';

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  usePerfHudStore.getState().recordRender(id, phase as 'mount' | 'update' | 'nested-update', actualDuration);
};

/**
 * Wrap a subtree to count renders + time per commit.
 * Keep the id short and stable — it keys the aggregates in the HUD.
 */
export function ProfiledRegion({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
