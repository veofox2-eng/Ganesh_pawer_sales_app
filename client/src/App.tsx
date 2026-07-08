import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { AuthView } from './components/AuthView';
import { DashboardLayout } from './components/DashboardLayout';
import { CallSheet } from './modules/CallSheet';
import { TaskBoard } from './modules/TaskBoard';
import { PaymentLog } from './modules/PaymentLog';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={!session ? <AuthView /> : <Navigate to="/calls" replace />} 
        />
        
        {/* Protected Dashboard Routes */}
        <Route path="/" element={session ? <DashboardLayout session={session} /> : <Navigate to="/login" replace />}>
          <Route index element={<Navigate to="/calls" replace />} />
          <Route path="calls" element={<CallSheet />} />
          <Route path="tasks" element={<TaskBoard />} />
          <Route path="payments" element={<PaymentLog />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
