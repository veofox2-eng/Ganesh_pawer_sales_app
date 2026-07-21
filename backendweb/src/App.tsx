import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { ThemeProvider } from './context/ThemeContext';
import CustomCursor from './components/CustomCursor';

function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setAuthorized(false);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    
    async function checkAuth() {
      try {
        const email = session?.user?.email;
        if (email === 'backendadmin1@gmail.com' || email === 'foxsuperadmin@gmail.com') {
          setAuthorized(true);
          return;
        }
        
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
          
        if (!error && data && (data.role === 'Admin' || data.role === 'SuperAdmin')) {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      } catch (err) {
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }
    
    checkAuth();
  }, [session]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--muted)', fontFamily: 'Geist,Inter,sans-serif' }}>
        Loading…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login"      element={!authorized ? <Login />     : <Navigate to="/dashboard" replace />} />
      <Route path="/dashboard/*" element={authorized  ? <Dashboard /> : <Navigate to="/login"     replace />} />
      <Route path="*"           element={<Navigate to={authorized ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <CustomCursor />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}
