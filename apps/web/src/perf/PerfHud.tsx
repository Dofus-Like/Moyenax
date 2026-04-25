import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { apiClient } from '../api/client';

import { usePerfHudStore, type NetworkSample, type RenderAggregate, type SseEventSample } from './perf-hud.store';
import { buildJsonReport, buildMarkdownReport } from './share-report';
import {
  buildDiff,
  clearSnapshots,
  deleteSnapshot,
  listSnapshots,
  saveCurrentSnapshot,
  type SavedSnapshot,
} from './snapshots';

type Tab = 'overview' | 'network' | 'renders' | 'sse' | 'tasks' | 'backend' | 'prisma' | 'game' | 'redis' | 'snap';
type ShareStatus = 'idle' | 'copied' | 'error';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'network', label: 'Network' },
  { key: 'renders', label: 'Renders' },
  { key: 'sse', label: 'SSE' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'backend', label: 'Backend' },
  { key: 'prisma', label: 'Prisma' },
  { key: 'game', label: 'Game' },
  { key: 'redis', label: 'Redis' },
  { key: 'snap', label: 'Snap' },
];

export function PerfHud() {
  const enabled = usePerfHudStore((s) => s.enabled);
  const minimized = usePerfHudStore((s) => s.minimized);
  const toggle = usePerfHudStore((s) => s.toggle);
  const setMinimized = usePerfHudStore((s) => s.setMinimized);
  const [tab, setTab] = useState<Tab>('overview');
  const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');

  const getReportInput = () => {
    const state = usePerfHudStore.getState();
    return {
      fps: state.fps,
      fpsHistory: state.fpsHistory,
      vitals: state.vitals,
      requests: state.requests,
      longTasks: state.longTasks,
      renders: state.renders,
      sseEvents: state.sseEvents,
      sseByType: state.sseByType,
      memory: state.memory,
      memoryHistory: state.memoryHistory,
      backend: state.backend,
      backendError: state.backendError,
    };
  };

  const handleCopyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdownReport(getReportInput()));
      setShareStatus('copied');
    } catch {
      setShareStatus('error');
    }
    setTimeout(() => setShareStatus('idle'), 2000);
  }, []);

  const handleDownloadJson = useCallback(() => {
    const json = buildJsonReport(getReportInput());
    const blob = new Blob([json], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `perf-snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  if (!enabled) {
    return (
      <button onClick={toggle} style={badgeStyle} title="Perf HUD (Shift+P)">
        ⚡ Perf
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <strong style={{ fontSize: 13 }}>⚡ Perf HUD</strong>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            style={{ ...btnStyle, ...(shareStatus === 'copied' ? shareCopiedStyle : {}) }}
            onClick={handleCopyMarkdown}
            title="Copier rapport Markdown pour IA"
          >
            {shareStatus === 'copied' ? '✓ Copié' : shareStatus === 'error' ? '✕ Erreur' : '📋 IA'}
          </button>
          <button style={btnStyle} onClick={handleDownloadJson} title="JSON brut">
            💾
          </button>
          <button style={btnStyle} onClick={() => setMinimized(!minimized)}>
            {minimized ? '▢' : '–'}
          </button>
          <button style={btnStyle} onClick={toggle}>
            ✕
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div style={tabsStyle}>
            {TABS.map((t) => (
              <button
                key={t.key}
                style={{ ...tabBtnStyle, ...(tab === t.key ? tabActiveStyle : {}) }}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={bodyStyle}>
            {tab === 'overview' && <OverviewTab />}
            {tab === 'network' && <NetworkTab />}
            {tab === 'renders' && <RendersTab />}
            {tab === 'sse' && <SseTab />}
            {tab === 'tasks' && <TasksTab />}
            {tab === 'backend' && <BackendTab />}
            {tab === 'prisma' && <PrismaTab />}
            {tab === 'game' && <GameTab />}
            {tab === 'redis' && <RedisTab />}
            {tab === 'snap' && <SnapshotsTab />}
          </div>
          <div style={footerStyle}>Shift+P to toggle</div>
        </>
      )}
    </div>
  );
}

function OverviewTab() {
  const fps = usePerfHudStore((s) => s.fps);
  const fpsHistory = usePerfHudStore((s) => s.fpsHistory);
  const vitals = usePerfHudStore((s) => s.vitals);
  const backend = usePerfHudStore((s) => s.backend);
  const longTasks = usePerfHudStore((s) => s.longTasks);
  const sseEvents = usePerfHudStore((s) => s.sseEvents);
  const memory = usePerfHudStore((s) => s.memory);
  const memoryHistory = usePerfHudStore((s) => s.memoryHistory);
  const color = fps.fps >= 55 ? '#4ade80' : fps.fps >= 30 ? '#facc15' : '#f87171';

  return (
    <div>
      <Section title="Frontend">
        <div style={rowStyle}>
          <Metric label="FPS" value={fps.fps.toString()} color={color} big />
          <Metric label="Frame peak" value={`${fps.ms.toFixed(1)}ms`} />
          <Metric label="Long tasks" value={longTasks.length.toString()} color={longTasks.length > 0 ? '#facc15' : undefined} />
          <Metric label="SSE events" value={sseEvents.length.toString()} />
        </div>
        <Sparkline values={fpsHistory} />
        {memory && (
          <div style={{ marginTop: 6 }}>
            <div style={sectionTitleStyle}>JS Heap (Chrome)</div>
            <div style={rowStyle}>
              <Metric label="Used" value={`${memory.usedMb.toFixed(0)}MB`} />
              <Metric label="Total" value={`${memory.totalMb.toFixed(0)}MB`} />
              <Metric label="Limit" value={`${memory.limitMb.toFixed(0)}MB`} />
            </div>
            <Sparkline values={memoryHistory} />
          </div>
        )}
      </Section>

      <Section title="Web Vitals">
        <div style={gridStyle}>
          <Metric label="LCP" value={vitals.LCP ? `${vitals.LCP.toFixed(0)}ms` : '–'} color={vitalColor('LCP', vitals.LCP)} />
          <Metric label="INP" value={vitals.INP ? `${vitals.INP.toFixed(0)}ms` : '–'} color={vitalColor('INP', vitals.INP)} />
          <Metric label="CLS" value={vitals.CLS !== undefined ? vitals.CLS.toFixed(3) : '–'} color={vitalColor('CLS', vitals.CLS)} />
          <Metric label="TTFB" value={vitals.TTFB ? `${vitals.TTFB.toFixed(0)}ms` : '–'} />
          <Metric label="FCP" value={vitals.FCP ? `${vitals.FCP.toFixed(0)}ms` : '–'} />
        </div>
      </Section>

      <Section title="Backend">
        {backend ? (
          <div style={gridStyle}>
            <Metric label="Loop p95" value={`${backend.runtime.eventLoopLagP95Ms.toFixed(1)}ms`} color={backend.runtime.eventLoopLagP95Ms > 50 ? '#f87171' : '#4ade80'} />
            <Metric label="RSS" value={`${backend.runtime.rssMb.toFixed(0)}MB`} />
            <Metric label="Heap" value={`${backend.runtime.heapUsedMb.toFixed(0)}MB`} />
            <Metric label="Reqs" value={backend.totals.totalRequests.toString()} />
            <Metric label="5xx" value={backend.totals.totalErrors.toString()} color={backend.totals.totalErrors > 0 ? '#f87171' : undefined} />
            <Metric label="SSE" value={backend.runtime.activeSseStreams.toString()} />
          </div>
        ) : (
          <div style={mutedStyle}>Waiting for /debug/perf…</div>
        )}
      </Section>
    </div>
  );
}

function NetworkTab() {
  const requests = usePerfHudStore((s) => s.requests);
  const clear = usePerfHudStore((s) => s.clearRequests);
  const [expanded, setExpanded] = useState<number | null>(null);
  const sorted = useMemo(() => [...requests].sort((a, b) => b.durationMs - a.durationMs).slice(0, 15), [requests]);

  return (
    <div>
      <Section title={`Slowest (${requests.length} tracked)`}>
        <button style={btnStyle} onClick={clear}>Clear</button>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Method</th>
              <th style={thStyle}>URL</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Server</th>
              <th style={thStyle}>Size</th>
              <th style={thStyle}>Trace</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <React.Fragment key={r.id}>
                <tr>
                  <td style={tdStyle}>{r.method}</td>
                  <td style={{ ...tdStyle, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.url}>
                    {shortPath(r.url)}
                  </td>
                  <td style={{ ...tdStyle, color: r.error ? '#f87171' : '#9ca3af' }}>{r.status || 'ERR'}</td>
                  <td style={{ ...tdStyle, color: durationColor(r.durationMs) }}>{r.durationMs.toFixed(0)}ms</td>
                  <td style={tdStyle}>{r.serverMs ? `${r.serverMs.toFixed(0)}ms` : '–'}</td>
                  <td style={tdStyle}>{r.sizeBytes ? formatBytes(r.sizeBytes) : '–'}</td>
                  <td style={tdStyle}>
                    {r.requestId ? (
                      <button style={btnStyle} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                        {expanded === r.id ? '▲' : '▼'}
                      </button>
                    ) : '–'}
                  </td>
                </tr>
                {expanded === r.id && r.requestId && (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, padding: 6, background: '#0f172a' }}>
                      <TraceDetails sample={r} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function TraceDetails({ sample }: { sample: NetworkSample }) {
  const [trace, setTrace] = useState<{
    requestId: string;
    method: string;
    path: string;
    totalMs?: number;
    statusCode?: number;
    queries: Array<{ model: string; action: string; durationMs: number }>;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sample.requestId) return;
    let cancel = false;
    apiClient
      .get(`/debug/perf/trace/${sample.requestId}`)
      .then((res) => {
        if (!cancel) setTrace(res.data);
      })
      .catch((e) => {
        if (!cancel) setErr(e instanceof Error ? e.message : 'fetch failed');
      });
    return () => {
      cancel = true;
    };
  }, [sample.requestId]);

  if (err) return <div style={{ color: '#f87171' }}>Trace unavailable: {err}</div>;
  if (!trace) return <div style={mutedStyle}>Loading trace…</div>;

  const queryTotal = trace.queries.reduce((sum, q) => sum + q.durationMs, 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        <Metric label="Total" value={`${trace.totalMs?.toFixed(1) ?? '–'}ms`} />
        <Metric label="DB total" value={`${queryTotal.toFixed(1)}ms`} />
        <Metric label="DB calls" value={trace.queries.length.toString()} />
        <Metric label="req_id" value={sample.requestId?.slice(0, 8) ?? '–'} />
      </div>
      {trace.queries.length === 0 ? (
        <div style={mutedStyle}>No Prisma queries for this request.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Model</th>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {trace.queries.map((q, i) => (
              <tr key={i}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={tdStyle}>{q.model}</td>
                <td style={tdStyle}>{q.action}</td>
                <td style={{ ...tdStyle, color: durationColor(q.durationMs) }}>{q.durationMs.toFixed(1)}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RendersTab() {
  const renders = usePerfHudStore((s) => s.renders);
  const clear = usePerfHudStore((s) => s.clearRenders);
  const sorted = useMemo<RenderAggregate[]>(
    () => Object.values(renders).sort((a, b) => b.totalMs - a.totalMs).slice(0, 20),
    [renders],
  );

  return (
    <Section title="React re-renders (sorted by total ms)">
      <button style={btnStyle} onClick={clear}>Reset</button>
      {sorted.length === 0 ? (
        <div style={mutedStyle}>No renders recorded yet. Wrap components in &lt;ProfiledRegion id="…"&gt;.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Region</th>
              <th style={thStyle}>Count</th>
              <th style={thStyle}>Total ms</th>
              <th style={thStyle}>Avg</th>
              <th style={thStyle}>Max</th>
              <th style={thStyle}>Last</th>
              <th style={thStyle}>Phase</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.id}</td>
                <td style={tdStyle}>{r.count}</td>
                <td style={{ ...tdStyle, color: durationColor(r.totalMs) }}>{r.totalMs.toFixed(1)}</td>
                <td style={tdStyle}>{(r.totalMs / r.count).toFixed(2)}</td>
                <td style={tdStyle}>{r.maxMs.toFixed(2)}</td>
                <td style={tdStyle}>{r.lastMs.toFixed(2)}</td>
                <td style={{ ...tdStyle, color: '#9ca3af' }}>{r.lastPhase}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function SseTab() {
  const events = usePerfHudStore((s) => s.sseEvents);
  const byType = usePerfHudStore((s) => s.sseByType);
  const clear = usePerfHudStore((s) => s.clearSseEvents);
  const [expanded, setExpanded] = useState<number | null>(null);
  const typeRows = useMemo(
    () =>
      Object.entries(byType)
        .map(([type, v]) => ({ type, ...v }))
        .sort((a, b) => b.count - a.count),
    [byType],
  );

  return (
    <div>
      <Section title="Event types">
        <button style={btnStyle} onClick={clear}>Clear</button>
        {typeRows.length === 0 ? (
          <div style={mutedStyle}>No SSE events captured.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Count</th>
                <th style={thStyle}>Total bytes</th>
                <th style={thStyle}>Avg size</th>
              </tr>
            </thead>
            <tbody>
              {typeRows.map((r) => (
                <tr key={r.type}>
                  <td style={tdStyle}>{r.type}</td>
                  <td style={tdStyle}>{r.count}</td>
                  <td style={tdStyle}>{formatBytes(r.totalBytes)}</td>
                  <td style={tdStyle}>{formatBytes(Math.round(r.totalBytes / r.count))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Recent (${events.length})`}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Size</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 30).map((e: SseEventSample) => (
              <React.Fragment key={e.id}>
                <tr>
                  <td style={tdStyle}>{formatTime(e.at)}</td>
                  <td style={tdStyle}>{e.type}</td>
                  <td style={tdStyle}>{formatBytes(e.sizeBytes)}</td>
                  <td style={{ ...tdStyle, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.source}>
                    {shortPath(e.source)}
                  </td>
                  <td style={tdStyle}>
                    {e.data && (
                      <button style={btnStyle} onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                        {expanded === e.id ? '▲' : '▼'}
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === e.id && e.data && (
                  <tr>
                    <td colSpan={5} style={{ ...tdStyle, background: '#0f172a', padding: 6 }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#d1d5db', fontSize: 10 }}>{e.data}</pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function TasksTab() {
  const longTasks = usePerfHudStore((s) => s.longTasks);
  const clear = usePerfHudStore((s) => s.clearLongTasks);

  return (
    <Section title={`Long tasks (>50ms main thread) — ${longTasks.length}`}>
      <button style={btnStyle} onClick={clear}>Clear</button>
      {longTasks.length === 0 ? (
        <div style={mutedStyle}>No long tasks — main thread is responsive.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Duration</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Attribution</th>
            </tr>
          </thead>
          <tbody>
            {longTasks.map((t) => (
              <tr key={t.id}>
                <td style={tdStyle}>{formatTime(t.at)}</td>
                <td style={{ ...tdStyle, color: durationColor(t.duration) }}>{t.duration.toFixed(0)}ms</td>
                <td style={tdStyle}>{t.name}</td>
                <td style={{ ...tdStyle, color: '#9ca3af' }}>{t.attribution ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function BackendTab() {
  const backend = usePerfHudStore((s) => s.backend);
  const error = usePerfHudStore((s) => s.backendError);

  if (error) {
    return <div style={{ color: '#f87171' }}>Erreur: {error}</div>;
  }

  if (!backend) {
    return <div style={mutedStyle}>Chargement…</div>;
  }

  return (
    <div>
      <Section title="Runtime">
        <div style={gridStyle}>
          <Metric label="Event loop p95" value={`${backend.runtime.eventLoopLagP95Ms.toFixed(1)}ms`} color={backend.runtime.eventLoopLagP95Ms > 50 ? '#f87171' : '#4ade80'} />
          <Metric label="Event loop mean" value={`${backend.runtime.eventLoopLagMeanMs.toFixed(1)}ms`} />
          <Metric label="Heap used" value={`${backend.runtime.heapUsedMb.toFixed(0)}MB`} />
          <Metric label="Heap limit" value={`${backend.runtime.heapLimitMb?.toFixed(0) ?? '–'}MB`} />
          <Metric label="RSS" value={`${backend.runtime.rssMb.toFixed(0)}MB`} />
          <Metric label="Uptime" value={formatUptime(backend.runtime.uptimeSec)} />
          <Metric label="SSE streams" value={backend.runtime.activeSseStreams.toString()} />
          <Metric label="SSE subs" value={backend.runtime.activeSseSubscribers.toString()} />
        </div>
        {backend.runtime.heapHistory && backend.runtime.heapHistory.length > 1 && (
          <>
            <div style={{ ...sectionTitleStyle, marginTop: 6 }}>Heap history (MB, last ~4min)</div>
            <Sparkline values={backend.runtime.heapHistory.map((h) => h.usedMb)} />
          </>
        )}
      </Section>

      {backend.runtime.gc && backend.runtime.gc.count > 0 && (
        <Section title="Garbage collection">
          <div style={gridStyle}>
            <Metric label="GC count" value={backend.runtime.gc.count.toString()} />
            <Metric label="GC total" value={`${backend.runtime.gc.totalPauseMs.toFixed(1)}ms`} color={backend.runtime.gc.totalPauseMs > 200 ? '#facc15' : undefined} />
            <Metric label="GC max" value={`${backend.runtime.gc.maxPauseMs.toFixed(1)}ms`} color={backend.runtime.gc.maxPauseMs > 50 ? '#f87171' : undefined} />
            <Metric label="GC last" value={`${backend.runtime.gc.lastPauseMs.toFixed(1)}ms`} />
          </div>
          {Object.keys(backend.runtime.gc.byKind).length > 0 && (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Kind</th>
                  <th style={thStyle}>Count</th>
                  <th style={thStyle}>Total ms</th>
                  <th style={thStyle}>Avg ms</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(backend.runtime.gc.byKind).map(([kind, v]) => (
                  <tr key={kind}>
                    <td style={tdStyle}>{kind}</td>
                    <td style={tdStyle}>{v.count}</td>
                    <td style={tdStyle}>{v.totalPauseMs.toFixed(1)}</td>
                    <td style={tdStyle}>{(v.totalPauseMs / v.count).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      <Section title={`Top routes (by p95) — ${backend.totals.totalRequests} total`}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Route</th>
              <th style={thStyle}>Count</th>
              <th style={thStyle}>Avg</th>
              <th style={thStyle}>p95</th>
              <th style={thStyle}>p99</th>
              <th style={thStyle}>Max</th>
              <th style={thStyle}>Err</th>
            </tr>
          </thead>
          <tbody>
            {backend.routes.map((r) => (
              <tr key={r.key}>
                <td style={{ ...tdStyle, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.key}>
                  <span style={{ color: '#60a5fa' }}>{r.method}</span> {r.path}
                </td>
                <td style={tdStyle}>{r.count}</td>
                <td style={tdStyle}>{r.avgMs.toFixed(0)}</td>
                <td style={{ ...tdStyle, color: durationColor(r.p95) }}>{r.p95.toFixed(0)}</td>
                <td style={tdStyle}>{r.p99.toFixed(0)}</td>
                <td style={tdStyle}>{r.maxMs.toFixed(0)}</td>
                <td style={{ ...tdStyle, color: r.errorCount > 0 ? '#f87171' : undefined }}>{r.errorCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function GameTab() {
  const backend = usePerfHudStore((s) => s.backend);
  if (!backend) return <div style={mutedStyle}>Chargement…</div>;
  const metrics = backend.gameMetrics ?? [];
  const grouped = metrics.reduce<Record<string, typeof metrics>>((acc, m) => {
    (acc[m.scope] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div>
      {Object.keys(grouped).length === 0 && (
        <div style={mutedStyle}>No game metrics captured yet. Play a turn or cast a spell.</div>
      )}
      {Object.entries(grouped).map(([scope, rows]) => (
        <Section key={scope} title={scope}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Count</th>
                <th style={thStyle}>Avg ms</th>
                <th style={thStyle}>p95</th>
                <th style={thStyle}>Max</th>
                <th style={thStyle}>Last</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={tdStyle}>{r.name}</td>
                  <td style={tdStyle}>{r.count}</td>
                  <td style={tdStyle}>{r.avgMs.toFixed(1)}</td>
                  <td style={{ ...tdStyle, color: durationColor(r.p95) }}>{r.p95.toFixed(1)}</td>
                  <td style={tdStyle}>{r.maxMs.toFixed(1)}</td>
                  <td style={tdStyle}>{r.lastMs.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ))}
    </div>
  );
}

function RedisTab() {
  const backend = usePerfHudStore((s) => s.backend);
  if (!backend) return <div style={mutedStyle}>Chargement…</div>;
  const rows = backend.redis ?? [];
  const getRows = rows.filter((r) => r.hits + r.misses > 0);

  return (
    <div>
      {getRows.length > 0 && (
        <Section title="Cache hit rate (GET ops)">
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Prefix</th>
                <th style={thStyle}>Hits</th>
                <th style={thStyle}>Misses</th>
                <th style={thStyle}>Hit %</th>
              </tr>
            </thead>
            <tbody>
              {getRows.map((r) => (
                <tr key={r.key}>
                  <td style={tdStyle}>{r.prefix}</td>
                  <td style={{ ...tdStyle, color: '#4ade80' }}>{r.hits}</td>
                  <td style={{ ...tdStyle, color: '#f87171' }}>{r.misses}</td>
                  <td style={{ ...tdStyle, color: hitRateColor(r.hitRate) }}>
                    {r.hitRate !== null ? `${(r.hitRate * 100).toFixed(0)}%` : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      <Section title="All Redis commands (by p95)">
        {rows.length === 0 ? (
          <div style={mutedStyle}>No Redis ops recorded.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Cmd:prefix</th>
                <th style={thStyle}>Count</th>
                <th style={thStyle}>Avg ms</th>
                <th style={thStyle}>p95</th>
                <th style={thStyle}>Max</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={tdStyle}>{r.key}</td>
                  <td style={tdStyle}>{r.count}</td>
                  <td style={tdStyle}>{r.avgMs.toFixed(1)}</td>
                  <td style={{ ...tdStyle, color: durationColor(r.p95) }}>{r.p95.toFixed(1)}</td>
                  <td style={tdStyle}>{r.maxMs.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function hitRateColor(rate: number | null): string | undefined {
  if (rate === null) return undefined;
  if (rate >= 0.8) return '#4ade80';
  if (rate >= 0.5) return '#facc15';
  return '#f87171';
}

function PrismaTab() {
  const backend = usePerfHudStore((s) => s.backend);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!backend) return <div style={mutedStyle}>Chargement…</div>;

  return (
    <div>
      <Section title="Prisma operations (by p95)">
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Query</th>
              <th style={thStyle}>Count</th>
              <th style={thStyle}>Avg</th>
              <th style={thStyle}>p95</th>
              <th style={thStyle}>Max</th>
              <th style={thStyle}>Last</th>
            </tr>
          </thead>
          <tbody>
            {backend.prisma.map((q) => (
              <tr key={q.key}>
                <td style={tdStyle}>{q.key}</td>
                <td style={tdStyle}>{q.count}</td>
                <td style={tdStyle}>{q.avgMs.toFixed(1)}</td>
                <td style={{ ...tdStyle, color: durationColor(q.p95) }}>{q.p95.toFixed(1)}</td>
                <td style={tdStyle}>{q.maxMs.toFixed(1)}</td>
                <td style={tdStyle}>{q.lastMs.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Raw SQL (by p95) — click ▼ to inspect / EXPLAIN">
        {(!backend.rawQueries || backend.rawQueries.length === 0) && (
          <div style={mutedStyle}>No raw SQL captured yet. Prisma query logs require SHOW_DEBUG=1 + API restart.</div>
        )}
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>SQL</th>
              <th style={thStyle}>Count</th>
              <th style={thStyle}>Avg</th>
              <th style={thStyle}>p95</th>
              <th style={thStyle}>Max</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {(backend.rawQueries ?? []).map((q) => (
              <React.Fragment key={q.id}>
                <tr>
                  <td
                    style={{
                      ...tdStyle,
                      maxWidth: 260,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={q.sql}
                  >
                    {q.sql}
                  </td>
                  <td style={tdStyle}>{q.count}</td>
                  <td style={tdStyle}>{q.avgMs.toFixed(1)}</td>
                  <td style={{ ...tdStyle, color: durationColor(q.p95) }}>{q.p95.toFixed(1)}</td>
                  <td style={tdStyle}>{q.maxMs.toFixed(1)}</td>
                  <td style={tdStyle}>
                    <button style={btnStyle} onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
                      {expanded === q.id ? '▲' : '▼'}
                    </button>
                  </td>
                </tr>
                {expanded === q.id && (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, background: '#0f172a', padding: 6 }}>
                      <RawQueryDetails query={q} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function RawQueryDetails({ query }: { query: { id: string; sql: string; lastParams: unknown[] } }) {
  const [plan, setPlan] = useState<unknown | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runExplain = async () => {
    setLoading(true);
    setErr(null);
    setPlan(null);
    try {
      const { data } = await apiClient.post('/debug/perf/explain', { id: query.id });
      setPlan(data.plan);
    } catch (e: unknown) {
      const error = e as { response?: { data?: { message?: string } }; message?: string };
      setErr(error.response?.data?.message ?? error.message ?? 'EXPLAIN failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <div style={sectionTitleStyle}>SQL</div>
        <pre style={preStyle}>{query.sql}</pre>
      </div>
      <div style={{ marginBottom: 4 }}>
        <div style={sectionTitleStyle}>Last params</div>
        <pre style={preStyle}>{JSON.stringify(query.lastParams, null, 2)}</pre>
      </div>
      <button style={btnStyle} onClick={runExplain} disabled={loading}>
        {loading ? '⏳ Running…' : '🔍 Run EXPLAIN'}
      </button>
      {err && <div style={{ color: '#f87171', marginTop: 4 }}>Erreur: {err}</div>}
      {plan !== null && (
        <div style={{ marginTop: 4 }}>
          <div style={sectionTitleStyle}>Plan</div>
          <PlanView plan={plan} />
        </div>
      )}
    </div>
  );
}

function PlanView({ plan }: { plan: unknown }) {
  // Postgres returns [{ "QUERY PLAN": [ { Plan: { … }, "Planning Time": …, "Execution Time": … } ] }]
  const root = extractPlanRoot(plan);
  if (!root) {
    return <pre style={preStyle}>{JSON.stringify(plan, null, 2)}</pre>;
  }
  const plannerRoot = (root.Plan ?? root) as Record<string, unknown>;
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
        {typeof root['Planning Time'] === 'number' && (
          <Metric label="Planning" value={`${(root['Planning Time'] as number).toFixed(2)}ms`} />
        )}
        {typeof root['Execution Time'] === 'number' && (
          <Metric label="Execution" value={`${(root['Execution Time'] as number).toFixed(2)}ms`} color={durationColor(root['Execution Time'] as number)} />
        )}
      </div>
      <PlanNode node={plannerRoot} depth={0} />
    </div>
  );
}

function extractPlanRoot(plan: unknown): Record<string, unknown> | null {
  if (Array.isArray(plan) && plan.length > 0) {
    const first = plan[0] as Record<string, unknown>;
    const qp = first['QUERY PLAN'];
    if (Array.isArray(qp) && qp.length > 0) return qp[0] as Record<string, unknown>;
    if (first.Plan) return first;
  }
  return null;
}

function PlanNode({ node, depth }: { node: Record<string, unknown>; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const nodeType = String(node['Node Type'] ?? '?');
  const actualTime = node['Actual Total Time'];
  const actualRows = node['Actual Rows'];
  const planRows = node['Plan Rows'];
  const children = (node.Plans ?? []) as Array<Record<string, unknown>>;

  return (
    <div style={{ marginLeft: depth * 10, borderLeft: depth > 0 ? '1px solid #374151' : undefined, paddingLeft: depth > 0 ? 6 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
        <button style={{ ...btnStyle, padding: '0 4px' }} onClick={() => setOpen(!open)}>
          {children.length > 0 ? (open ? '▼' : '▶') : '•'}
        </button>
        <span style={{ color: nodeColor(nodeType), fontWeight: 600 }}>{nodeType}</span>
        {typeof actualTime === 'number' && (
          <span style={{ color: durationColor(actualTime) }}>{actualTime.toFixed(2)}ms</span>
        )}
        {typeof actualRows === 'number' && (
          <span style={{ color: '#9ca3af' }}>
            rows={actualRows}
            {typeof planRows === 'number' && planRows !== actualRows ? ` (est ${planRows})` : ''}
          </span>
        )}
        {typeof node['Relation Name'] === 'string' && (
          <span style={{ color: '#60a5fa' }}>on {String(node['Relation Name'])}</span>
        )}
        {typeof node['Index Name'] === 'string' && (
          <span style={{ color: '#a78bfa' }}>idx {String(node['Index Name'])}</span>
        )}
      </div>
      {open && (
        <div style={{ marginLeft: 14 }}>
          {['Filter', 'Index Cond', 'Hash Cond', 'Join Filter'].map((key) =>
            typeof node[key] === 'string' ? (
              <div key={key} style={{ fontSize: 10, color: '#9ca3af' }}>
                <span style={{ color: '#facc15' }}>{key}:</span> {String(node[key])}
              </div>
            ) : null,
          )}
          {children.map((child, i) => (
            <PlanNode key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function nodeColor(type: string): string {
  if (type.includes('Seq Scan')) return '#f87171';
  if (type.includes('Index')) return '#4ade80';
  if (type.includes('Hash') || type.includes('Merge') || type.includes('Nested Loop')) return '#facc15';
  return '#f3f4f6';
}

function SnapshotsTab() {
  const [items, setItems] = useState<SavedSnapshot[]>(() => listSnapshots());
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = () => setItems(listSnapshots());
  const save = () => {
    saveCurrentSnapshot(label);
    setLabel('');
    refresh();
  };
  const remove = (id: string) => {
    deleteSnapshot(id);
    if (selected === id) setSelected(null);
    refresh();
  };
  const clearAll = () => {
    clearSnapshots();
    setSelected(null);
    refresh();
  };

  const current = useMemo(() => saveCurrentVirtualSnapshot(), [items, selected]);
  const selectedSnap = items.find((s) => s.id === selected);
  const diff = selectedSnap ? buildDiff(selectedSnap, current) : null;

  return (
    <div>
      <Section title="Save current state">
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            style={inputStyle}
            placeholder="Label (ex: before-fix)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button style={btnStyle} onClick={save}>💾 Save</button>
          {items.length > 0 && <button style={btnStyle} onClick={clearAll}>Clear all</button>}
        </div>
      </Section>

      <Section title={`Saved (${items.length})`}>
        {items.length === 0 && <div style={mutedStyle}>No snapshots saved.</div>}
        {items.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              gap: 4,
              alignItems: 'center',
              padding: '2px 0',
              background: selected === s.id ? '#1e293b' : undefined,
            }}
          >
            <button style={{ ...btnStyle, flex: 1, textAlign: 'left' }} onClick={() => setSelected(s.id === selected ? null : s.id)}>
              <span style={{ fontWeight: 600 }}>{s.label}</span>{' '}
              <span style={{ color: '#9ca3af' }}>
                FPS {s.fpsAvg} · {new Date(s.createdAt).toLocaleTimeString()}
              </span>
            </button>
            <button style={btnStyle} onClick={() => remove(s.id)}>✕</button>
          </div>
        ))}
      </Section>

      {diff && selectedSnap && (
        <Section title={`Diff: "${selectedSnap.label}" → now`}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Metric</th>
                <th style={thStyle}>Before</th>
                <th style={thStyle}>Now</th>
                <th style={thStyle}>Δ</th>
                <th style={thStyle}>%</th>
              </tr>
            </thead>
            <tbody>
              {diff.map((row) => {
                const deltaSign = row.delta === undefined ? '' : row.delta > 0 ? '+' : '';
                const deltaColor = deltaColorFor(row);
                return (
                  <tr key={row.label}>
                    <td style={tdStyle}>{row.label}</td>
                    <td style={tdStyle}>{typeof row.before === 'number' ? row.before.toFixed(1) : row.before}</td>
                    <td style={tdStyle}>{typeof row.after === 'number' ? row.after.toFixed(1) : row.after}</td>
                    <td style={{ ...tdStyle, color: deltaColor }}>{row.delta !== undefined ? `${deltaSign}${row.delta.toFixed(1)}` : '–'}</td>
                    <td style={{ ...tdStyle, color: deltaColor }}>{row.deltaPct !== undefined ? `${deltaSign}${row.deltaPct.toFixed(1)}%` : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

function saveCurrentVirtualSnapshot(): SavedSnapshot {
  const state = usePerfHudStore.getState();
  const history = state.fpsHistory;
  const fpsAvg = history.length ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : 0;
  return {
    id: 'current',
    label: 'current',
    createdAt: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    fps: state.fps,
    fpsAvg,
    fpsMin: history.length ? Math.min(...history) : 0,
    fpsMax: history.length ? Math.max(...history) : 0,
    vitals: state.vitals,
    longTasks: state.longTasks,
    renders: state.renders,
    requests: state.requests,
    backend: state.backend,
  };
}

function deltaColorFor(row: { delta?: number; betterIsLower?: boolean }): string | undefined {
  if (row.delta === undefined || row.delta === 0) return undefined;
  const improved = row.betterIsLower ? row.delta < 0 : row.delta > 0;
  return improved ? '#4ade80' : '#f87171';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={sectionTitleStyle}>{title}</div>
      {children}
    </div>
  );
}

function Metric({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div style={{ padding: '4px 6px', background: '#1f2937', borderRadius: 4, minWidth: 70 }}>
      <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: big ? 18 : 13, fontWeight: 600, color: color ?? '#f3f4f6', fontFamily: 'ui-monospace, monospace' }}>
        {value}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div style={{ height: 24 }} />;
  const max = Math.max(60, ...values);
  const width = 240;
  const height = 24;
  const step = width / Math.max(values.length - 1, 1);
  const pts = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block', marginTop: 4 }}>
      <polyline points={pts} fill="none" stroke="#4ade80" strokeWidth="1" />
    </svg>
  );
}

const badgeStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 12,
  right: 12,
  zIndex: 99999,
  background: '#111827',
  color: '#f3f4f6',
  border: '1px solid #374151',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 11,
  fontFamily: 'ui-monospace, monospace',
  cursor: 'pointer',
  opacity: 0.7,
};

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 12,
  right: 12,
  zIndex: 99999,
  width: 520,
  maxHeight: '82vh',
  background: 'rgba(17, 24, 39, 0.96)',
  color: '#f3f4f6',
  border: '1px solid #374151',
  borderRadius: 8,
  fontSize: 11,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 10px',
  borderBottom: '1px solid #374151',
};

const tabsStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #374151',
  overflowX: 'auto',
};

const tabBtnStyle: React.CSSProperties = {
  padding: '6px 8px',
  background: 'transparent',
  border: 'none',
  color: '#9ca3af',
  cursor: 'pointer',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  whiteSpace: 'nowrap',
};

const tabActiveStyle: React.CSSProperties = {
  color: '#f3f4f6',
  background: '#1f2937',
  boxShadow: 'inset 0 -2px 0 #4ade80',
};

const bodyStyle: React.CSSProperties = {
  padding: 10,
  overflowY: 'auto',
  flex: 1,
};

const footerStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderTop: '1px solid #374151',
  color: '#6b7280',
  fontSize: 10,
  textAlign: 'right',
};

const btnStyle: React.CSSProperties = {
  background: '#1f2937',
  color: '#f3f4f6',
  border: '1px solid #374151',
  padding: '2px 6px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
};

const shareCopiedStyle: React.CSSProperties = {
  background: '#065f46',
  borderColor: '#10b981',
  color: '#d1fae5',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: '#0f172a',
  color: '#f3f4f6',
  border: '1px solid #374151',
  borderRadius: 4,
  padding: '2px 6px',
  fontSize: 11,
  fontFamily: 'inherit',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 4,
};

const rowStyle: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: 4 };
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '3px 4px',
  borderBottom: '1px solid #374151',
  color: '#9ca3af',
  fontWeight: 500,
  fontSize: 10,
};
const tdStyle: React.CSSProperties = {
  padding: '2px 4px',
  borderBottom: '1px solid #1f2937',
  fontSize: 10,
};
const mutedStyle: React.CSSProperties = { color: '#6b7280', fontStyle: 'italic' };

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 4,
  background: '#0b1220',
  borderRadius: 3,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  fontSize: 10,
  color: '#d1d5db',
  maxHeight: 200,
  overflow: 'auto',
};

function durationColor(ms: number): string {
  if (ms < 100) return '#4ade80';
  if (ms < 400) return '#facc15';
  return '#f87171';
}

function vitalColor(key: 'LCP' | 'INP' | 'CLS', value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  const goodThreshold = { LCP: 2500, INP: 200, CLS: 0.1 }[key];
  const badThreshold = { LCP: 4000, INP: 500, CLS: 0.25 }[key];
  if (value <= goodThreshold) return '#4ade80';
  if (value <= badThreshold) return '#facc15';
  return '#f87171';
}

function shortPath(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
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

function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString('en-US', { hour12: false });
}
