import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './utils/SocketProvider.js';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Public pages
import Home from './components/LandingPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import AuthCallback from './pages/auth/AuthCallback';

// Protected pages
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import Metrics from './pages/Metrics';
import Profile from './pages/Profile';
import Room from './components/Room.jsx';
import Lobby from './components/LobbyPage';

const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
    <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--coral)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
  </div>
);

function App() {
  const content = (
    <Suspense fallback={<LoadingSpinner />}>
      <AuthProvider>
        <SocketProvider>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />

          {/* Protected — everything except landing + auth requires login */}
          <Route element={<ProtectedRoute />}>
            <Route path="/lobby" element={<Lobby />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="/join" element={<Lobby />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/room/:roomId" element={<Room />} />
            {/* Legacy room route with email param */}
            <Route path="/room/:roomId/:email" element={<Room />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SocketProvider>
      </AuthProvider>
    </Suspense>
  );

  return (
    <ThemeProvider>
      {content}
    </ThemeProvider>
  );
}

export default App;
