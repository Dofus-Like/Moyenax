import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { FarmingPage } from './pages/FarmingPage';
import { ShopPage } from './pages/ShopPage';
import { InventoryPage } from './pages/InventoryPage';
import { CraftingPage } from './pages/CraftingPage';
import { CombatPage } from './pages/CombatPage';
import { DebugPage } from './pages/DebugPage';
import { useAuthStore } from './store/auth.store';
import './styles/global.css';

const queryClient = new QueryClient();

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
          <Route path="/farming" element={<ProtectedRoute><FarmingPage /></ProtectedRoute>} />
          <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
          <Route path="/crafting" element={<ProtectedRoute><CraftingPage /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
          <Route path="/combat/:sessionId" element={<ProtectedRoute><CombatPage /></ProtectedRoute>} />
          <Route path="/debug" element={<ProtectedRoute><DebugPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
