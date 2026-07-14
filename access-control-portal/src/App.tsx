import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './pages/Login';
import AccessDashboard from './pages/AccessDashboard';
import './index.css';

function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'Geist,Inter,sans-serif' }}>
        Loading…
      </div>
    );
  }

  // We are authorized if we have a valid Supabase session
  const authorized = session !== null;

  return (
    <Routes>
      <Route path="/login"      element={!authorized ? <Login />     : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard"  element={authorized  ? <AccessDashboard /> : <Navigate to="/login"     replace />} />
      <Route path="*"           element={<Navigate to={authorized ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
