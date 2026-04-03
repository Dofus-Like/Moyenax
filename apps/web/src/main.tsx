import React, { Suspense, lazy, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { ShopPage } from './pages/ShopPage';
import { InventoryPage } from './pages/InventoryPage';
import { DebugPage } from './pages/DebugPage';
import { useAuthStore } from './store/auth.store';
import { useThemeStore } from './store/theme.store';
import { GameSessionProvider, GameTunnelGuard } from './pages/GameTunnel';
import './styles/global.css';
import './styles/retro-utilities.css';

const queryClient = new QueryClient();
const FarmingPage = lazy(() => import('./pages/FarmingPage').then((module) => ({ default: module.FarmingPage })));
const CombatPage = lazy(() => import('./pages/CombatPage').then((module) => ({ default: module.CombatPage })));
const CraftingPage = lazy(() => import('./pages/CraftingPage').then((module) => ({ default: module.CraftingPage })));

function ThemeSync() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return null;
}

function PageLoader() {
  return <div className="loading-screen">Chargement...</div>;
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

  if (loading) return <div className="loading-screen">Authentification...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeSync />
        <GameSessionProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <GameTunnelGuard>
                    <LobbyPage />
                  </GameTunnelGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/farming"
              element={
                <ProtectedRoute>
                  <GameTunnelGuard>
                    <LazyPage>
                      <FarmingPage />
                    </LazyPage>
                  </GameTunnelGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/shop"
              element={
                <ProtectedRoute>
                  <GameTunnelGuard>
                    <ShopPage />
                  </GameTunnelGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <GameTunnelGuard>
                    <InventoryPage />
                  </GameTunnelGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/crafting"
              element={
                <ProtectedRoute>
                  <GameTunnelGuard>
                    <LazyPage>
                      <CraftingPage />
                    </LazyPage>
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
            <Route path="/debug" element={<ProtectedRoute><DebugPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </GameSessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
