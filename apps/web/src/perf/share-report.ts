import type {
  BackendSnapshot,
  FpsSample,
  LongTaskSample,
  MemorySample,
  NetworkSample,
  RenderAggregate,
  SseEventSample,
  WebVitals,
} from './perf-hud.store';

interface ReportInput {
  fps: FpsSample;
  fpsHistory: number[];
  vitals: WebVitals;
  requests: NetworkSample[];
  longTasks: LongTaskSample[];
  renders: Record<string, RenderAggregate>;
  sseEvents: SseEventSample[];
  sseByType: Record<string, { count: number; totalBytes: number; lastAt: number }>;
  memory: MemorySample | null;
  memoryHistory: number[];
  backend: BackendSnapshot | null;
  backendError: string | null;
}

export function buildMarkdownReport(input: ReportInput): string {
  const now = new Date().toISOString();
  const url = typeof window !== 'undefined' ? window.location.href : 'n/a';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a';
  const viewport =
    typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'n/a';
  const deviceMemory =
    typeof navigator !== 'undefined' && 'deviceMemory' in navigator
      ? `${(navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? '?'}GB`
      : 'n/a';
  const hardwareConcurrency =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 'n/a';

  const fpsMin = input.fpsHistory.length ? Math.min(...input.fpsHistory) : 0;
  const fpsMax = input.fpsHistory.length ? Math.max(...input.fpsHistory) : 0;
  const fpsAvg = input.fpsHistory.length
    ? Math.round(input.fpsHistory.reduce((a, b) => a + b, 0) / input.fpsHistory.length)
    : 0;

  const slowest = [...input.requests].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10);
  const errors = input.requests.filter((r) => r.error);

  const lines: string[] = [];
  lines.push('# Performance Snapshot');
  lines.push('');
  lines.push(`- **Timestamp**: ${now}`);
  lines.push(`- **URL**: ${url}`);
  lines.push(`- **Viewport**: ${viewport}`);
  lines.push(`- **Device memory**: ${deviceMemory}`);
  lines.push(`- **CPU threads**: ${hardwareConcurrency}`);
  lines.push(`- **User agent**: \`${ua}\``);
  lines.push('');

  lines.push('## Frontend — Rendering');
  lines.push(`- **FPS current**: ${input.fps.fps}`);
  lines.push(`- **FPS avg / min / max (last ${input.fpsHistory.length}s)**: ${fpsAvg} / ${fpsMin} / ${fpsMax}`);
  lines.push(`- **Peak frame time (last second)**: ${input.fps.ms.toFixed(1)}ms`);
  if (input.memory) {
    const memMin = input.memoryHistory.length ? Math.min(...input.memoryHistory) : input.memory.usedMb;
    const memMax = input.memoryHistory.length ? Math.max(...input.memoryHistory) : input.memory.usedMb;
    lines.push(`- **JS heap (Chrome)**: ${input.memory.usedMb}MB used / ${input.memory.totalMb}MB total / ${input.memory.limitMb}MB limit (min ${memMin} · max ${memMax})`);
  }
  lines.push('');

  lines.push('## Frontend — Web Vitals');
  const vitalsRows: Array<[string, number | undefined, string]> = [
    ['LCP', input.vitals.LCP, 'good <2500ms · poor >4000ms'],
    ['INP', input.vitals.INP, 'good <200ms · poor >500ms'],
    ['CLS', input.vitals.CLS, 'good <0.1 · poor >0.25'],
    ['TTFB', input.vitals.TTFB, 'time-to-first-byte'],
    ['FCP', input.vitals.FCP, 'first contentful paint'],
  ];
  lines.push('| Metric | Value | Reference |');
  lines.push('|---|---|---|');
  for (const [key, value, ref] of vitalsRows) {
    let formatted = '–';
    if (value !== undefined) {
      formatted = key === 'CLS' ? value.toFixed(3) : `${value.toFixed(0)}ms`;
    }
    lines.push(`| ${key} | ${formatted} | ${ref} |`);
  }
  lines.push('');

  lines.push(`## Frontend — Network (${input.requests.length} requests tracked)`);
  if (errors.length > 0) {
    lines.push(`- **Errors**: ${errors.length}`);
  }
  if (slowest.length === 0) {
    lines.push('_No requests tracked._');
  } else {
    lines.push('| Method | URL | Status | Total ms | Server ms | Size | ReqId |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const r of slowest) {
      const url = shortUrl(r.url);
      const server = r.serverMs !== undefined ? `${r.serverMs.toFixed(0)}` : '–';
      const size = r.sizeBytes !== undefined ? formatBytes(r.sizeBytes) : '–';
      const rid = r.requestId ? r.requestId.slice(0, 8) : '–';
      lines.push(`| ${r.method} | ${url} | ${r.status || 'ERR'} | ${r.durationMs.toFixed(0)} | ${server} | ${size} | ${rid} |`);
    }
  }
  lines.push('');

  lines.push(`## Frontend — Long tasks (${input.longTasks.length})`);
  if (input.longTasks.length === 0) {
    lines.push('_None — main thread responsive._');
  } else {
    lines.push('| Time | Duration ms | Name | Attribution |');
    lines.push('|---|---|---|---|');
    for (const t of input.longTasks.slice(0, 15)) {
      lines.push(`| ${new Date(t.at).toISOString()} | ${t.duration.toFixed(0)} | ${t.name} | ${t.attribution ?? '–'} |`);
    }
  }
  lines.push('');

  const renderRows = Object.values(input.renders).sort((a, b) => b.totalMs - a.totalMs).slice(0, 15);
  lines.push(`## Frontend — React renders (${Object.keys(input.renders).length} regions)`);
  if (renderRows.length === 0) {
    lines.push('_No render data. Wrap components in <ProfiledRegion> to capture._');
  } else {
    lines.push('| Region | Count | Total ms | Avg ms | Max ms | Last phase |');
    lines.push('|---|---|---|---|---|---|');
    for (const r of renderRows) {
      lines.push(`| \`${r.id}\` | ${r.count} | ${r.totalMs.toFixed(1)} | ${(r.totalMs / r.count).toFixed(2)} | ${r.maxMs.toFixed(2)} | ${r.lastPhase} |`);
    }
  }
  lines.push('');

  lines.push(`## Frontend — SSE events (${input.sseEvents.length} total)`);
  const typeRows = Object.entries(input.sseByType)
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => b.count - a.count);
  if (typeRows.length === 0) {
    lines.push('_No SSE events captured._');
  } else {
    lines.push('| Type | Count | Total bytes | Avg size |');
    lines.push('|---|---|---|---|');
    for (const r of typeRows) {
      lines.push(`| ${r.type} | ${r.count} | ${formatBytes(r.totalBytes)} | ${formatBytes(Math.round(r.totalBytes / r.count))} |`);
    }
  }
  lines.push('');

  if (input.backend) {
    const b = input.backend;
    lines.push('## Backend — Runtime');
    lines.push(`- **Node**: ${b.runtime.nodeVersion}`);
    lines.push(`- **Uptime**: ${formatUptime(b.runtime.uptimeSec)}`);
    lines.push(`- **Event loop lag**: p95=${b.runtime.eventLoopLagP95Ms.toFixed(2)}ms, mean=${b.runtime.eventLoopLagMeanMs.toFixed(2)}ms`);
    lines.push(`- **Memory**: RSS=${b.runtime.rssMb.toFixed(0)}MB, heap=${b.runtime.heapUsedMb.toFixed(0)}/${b.runtime.heapTotalMb.toFixed(0)}MB (limit ${b.runtime.heapLimitMb ?? '?'}MB)`);
    if (b.runtime.gc && b.runtime.gc.count > 0) {
      const byKind = Object.entries(b.runtime.gc.byKind)
        .map(([k, v]) => `${k}=${v.count}/${v.totalPauseMs.toFixed(1)}ms`)
        .join(', ');
      lines.push(`- **GC**: count=${b.runtime.gc.count}, total=${b.runtime.gc.totalPauseMs.toFixed(1)}ms, max=${b.runtime.gc.maxPauseMs.toFixed(1)}ms (${byKind})`);
    }
    lines.push(`- **SSE**: streams=${b.runtime.activeSseStreams}, subscribers=${b.runtime.activeSseSubscribers}, total events=${b.runtime.totalSseEvents}`);
    lines.push(`- **Totals**: ${b.totals.totalRequests} requests, ${b.totals.totalErrors} 5xx`);
    lines.push('');

    lines.push('## Backend — Top routes (sorted by p95)');
    if (b.routes.length === 0) {
      lines.push('_No routes yet._');
    } else {
      lines.push('| Route | Count | Avg ms | p50 | p95 | p99 | Max | Errors |');
      lines.push('|---|---|---|---|---|---|---|---|');
      for (const r of b.routes) {
        lines.push(
          `| \`${r.method} ${r.path}\` | ${r.count} | ${r.avgMs.toFixed(1)} | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.p99.toFixed(1)} | ${r.maxMs.toFixed(1)} | ${r.errorCount} |`,
        );
      }
    }
    lines.push('');

    lines.push('## Backend — Top Prisma queries (sorted by p95)');
    if (b.prisma.length === 0) {
      lines.push('_No Prisma calls recorded._');
    } else {
      lines.push('| Query | Count | Avg ms | p95 | Max | Last |');
      lines.push('|---|---|---|---|---|---|');
      for (const q of b.prisma) {
        lines.push(
          `| \`${q.key}\` | ${q.count} | ${q.avgMs.toFixed(1)} | ${q.p95.toFixed(1)} | ${q.maxMs.toFixed(1)} | ${q.lastMs.toFixed(1)} |`,
        );
      }
    }
    lines.push('');

    if (b.gameMetrics && b.gameMetrics.length > 0) {
      lines.push('## Backend — Game metrics (sorted by p95)');
      lines.push('| Scope | Name | Count | Avg ms | p95 | Max | Last |');
      lines.push('|---|---|---|---|---|---|---|');
      for (const m of b.gameMetrics) {
        lines.push(`| ${m.scope} | ${m.name} | ${m.count} | ${m.avgMs.toFixed(1)} | ${m.p95.toFixed(1)} | ${m.maxMs.toFixed(1)} | ${m.lastMs.toFixed(1)} |`);
      }
      lines.push('');
    }

    if (b.redis && b.redis.length > 0) {
      lines.push('## Backend — Redis commands (sorted by p95)');
      lines.push('| Cmd:prefix | Count | Avg ms | p95 | Max | Hits | Misses | Hit % |');
      lines.push('|---|---|---|---|---|---|---|---|');
      for (const r of b.redis) {
        const hitPct = r.hitRate !== null ? `${(r.hitRate * 100).toFixed(0)}%` : '–';
        lines.push(`| ${r.key} | ${r.count} | ${r.avgMs.toFixed(1)} | ${r.p95.toFixed(1)} | ${r.maxMs.toFixed(1)} | ${r.hits} | ${r.misses} | ${hitPct} |`);
      }
      lines.push('');
    }

    if (b.recent.length > 0) {
      lines.push('## Backend — Last 10 requests (server-side)');
      lines.push('| Method | Path | Status | Duration ms | Slow |');
      lines.push('|---|---|---|---|---|');
      for (const r of b.recent.slice(0, 10)) {
        lines.push(`| ${r.method} | ${r.path} | ${r.statusCode ?? '–'} | ${r.durationMs.toFixed(1)} | ${r.slow ? 'yes' : 'no'} |`);
      }
      lines.push('');
    }
  } else {
    lines.push('## Backend');
    lines.push(input.backendError ? `_Backend unreachable: ${input.backendError}_` : '_No backend snapshot._');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Analysis request');
  lines.push('');
  lines.push(
    'You are a performance engineer. Using the snapshot above, identify:',
  );
  lines.push('1. The **top 3 likely bottlenecks** (frontend rendering, network, or backend) with supporting numbers.');
  lines.push('2. For each bottleneck, the **most probable root cause** (e.g. N+1 query, render thrash, oversized payload, event-loop blocking).');
  lines.push('3. A **prioritized action list** (cheap wins first) with the concrete file or layer to investigate.');
  lines.push('4. Any **numbers that look suspicious or inconsistent** (e.g. Server-Timing >> Total, p99 >> p95, FPS drops with low event-loop lag).');
  lines.push('');
  lines.push('If data is missing for a category, say so explicitly — do not invent numbers.');

  return lines.join('\n');
}

export function buildJsonReport(input: ReportInput): string {
  return JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      context: {
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        viewport:
          typeof window !== 'undefined'
            ? { width: window.innerWidth, height: window.innerHeight }
            : null,
        deviceMemory:
          typeof navigator !== 'undefined'
            ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null
            : null,
        hardwareConcurrency:
          typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : null,
      },
      frontend: {
        fps: input.fps,
        fpsHistory: input.fpsHistory,
        vitals: input.vitals,
        requests: input.requests,
        longTasks: input.longTasks,
        renders: input.renders,
        sseEvents: input.sseEvents,
        sseByType: input.sseByType,
        memory: input.memory,
        memoryHistory: input.memoryHistory,
      },
      backend: input.backend,
      backendError: input.backendError,
    },
    null,
    2,
  );
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h${Math.floor((sec % 3600) / 60)}m`;
}
