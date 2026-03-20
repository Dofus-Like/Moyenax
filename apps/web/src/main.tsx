import React, { Suspense, lazy, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { ShopPage } from './pages/ShopPage';
import { InventoryPage } from './pages/InventoryPage';
import { CraftingPage } from './pages/CraftingPage';
import { DebugPage } from './pages/DebugPage';
import { useAuthStore } from './store/auth.store';
import './styles/global.css';

const queryClient = new QueryClient();
const FarmingPage = lazy(() => import('./pages/FarmingPage').then((module) => ({ default: module.FarmingPage })));
const CombatPage = lazy(() => import('./pages/CombatPage').then((module) => ({ default: module.CombatPage })));

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
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
          <Route path="/farming" element={<ProtectedRoute><LazyPage><FarmingPage /></LazyPage></ProtectedRoute>} />
          <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
          <Route path="/crafting" element={<ProtectedRoute><CraftingPage /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
          <Route path="/combat/:sessionId" element={<ProtectedRoute><LazyPage><CombatPage /></LazyPage></ProtectedRoute>} />
          <Route path="/debug" element={<ProtectedRoute><DebugPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
