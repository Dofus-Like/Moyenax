import React, { Profiler, Suspense, lazy, useEffect, useState, type ProfilerOnRenderCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Leva } from 'leva';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { ShopPage } from './pages/ShopPage';
import { InventoryPage } from './pages/InventoryPage';
import { DebugPage } from './pages/DebugPage';
import { useAuthStore } from './store/auth.store';
import { GameSessionProvider, GameTunnelGuard } from './pages/GameTunnel';
import { GameLayout } from './components/GameLayout';
import './styles/global.css';

const SHOW_DEBUG = ['1', 'true', 'on', 'yes'].includes(
  String(import.meta.env.VITE_SHOW_DEBUG ?? '').toLowerCase().trim(),
);

const PerfHud = SHOW_DEBUG
  ? lazy(() => import('./perf').then((mod) => ({ default: mod.PerfHud })))
  : null;

let recordRenderRef: ((id: string, phase: 'mount' | 'update' | 'nested-update', duration: number) => void) | null = null;

if (SHOW_DEBUG) {
  void import('./perf').then((mod) => {
    mod.initPerfHud();
    recordRenderRef = (id, phase, duration) =>
      mod.usePerfHudStore.getState().recordRender(id, phase, duration);
  });
}

const onAppRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  recordRenderRef?.(id, phase as 'mount' | 'update' | 'nested-update', actualDuration);
};

function AppProfiler({ children }: { children: React.ReactNode }) {
  if (!SHOW_DEBUG) return <>{children}</>;
  return (
    <Profiler id="app" onRender={onAppRender}>
      {children}
    </Profiler>
  );
}

const queryClient = new QueryClient();
const FarmingPage = lazy(() => import('./pages/FarmingPage').then((module) => ({ default: module.FarmingPage })));
const CombatPage = lazy(() => import('./pages/CombatPage').then((module) => ({ default: module.CombatPage })));
const CraftingPage = lazy(() => import('./pages/CraftingPage').then((module) => ({ default: module.CraftingPage })));

function PageLoader({ message = 'Chargement...' }: { message?: string }) {
  return (
    <div className="loading-screen">
      <span>⚔️ {message}</span>
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, initialize } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await initialize();
      setLoading(false);
    };
    init();
  }, [initialize]);

  if (loading) return <PageLoader message="Authentification..." />;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Leva hidden={!SHOW_DEBUG} />
      <BrowserRouter>
        <GameSessionProvider>
          <AppProfiler>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <GameTunnelGuard>
                    <GameLayout>
                      <LobbyPage />
                    </GameLayout>
                  </GameTunnelGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/farming"
              element={
                <ProtectedRoute>
                  <GameTunnelGuard>
                    <GameLayout>
                      <LazyPage>
                        <FarmingPage />
                      </LazyPage>
                    </GameLayout>
                  </GameTunnelGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/shop"
              element={
                <ProtectedRoute>
                  <GameTunnelGuard>
                    <GameLayout>
                      <ShopPage />
                    </GameLayout>
                  </GameTunnelGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <GameTunnelGuard>
                    <GameLayout>
                      <InventoryPage />
                    </GameLayout>
                  </GameTunnelGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/crafting"
              element={
                <ProtectedRoute>
                  <GameTunnelGuard>
                    <GameLayout>
                      <LazyPage>
                        <CraftingPage />
                      </LazyPage>
                    </GameLayout>
                  </GameTunnelGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/combat/:sessionId"
              element={
                <ProtectedRoute>
                  <LazyPage>
                    <CombatPage />
                  </LazyPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/debug"
              element={
                <ProtectedRoute>
                  <GameLayout>
                    <DebugPage />
                  </GameLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          </AppProfiler>
        </GameSessionProvider>
      </BrowserRouter>
      {PerfHud && (
        <Suspense fallback={null}>
          <PerfHud />
        </Suspense>
      )}
    </QueryClientProvider>
  </React.StrictMode>,
);

