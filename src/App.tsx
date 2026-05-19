// src/App.tsx
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import React from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import { useAuth } from './lib/hooks';
import Loading from './components/Loading';

import TournamentDetail from './pages/TournamentDetail';
import Scoring from './pages/Scoring';
import Tournaments from './pages/Tournaments';
import Profile from './pages/Profile';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/tournament/:id" element={<TournamentDetail />} />
          <Route 
            path="/scoring/:id" 
            element={
              <ProtectedRoute>
                <Scoring />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
