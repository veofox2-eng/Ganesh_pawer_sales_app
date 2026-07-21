import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Shield, Users, LogOut, Sun, Moon } from 'lucide-react';

import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Login from './pages/Login';

function AppContent() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark');
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (!session) navigate('/login');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) navigate('/login');
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-white">Loading...</div>;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[var(--bg)] text-[var(--text)] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border)] bg-[var(--bg2)] flex flex-col z-20 shadow-2xl">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Shield size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-white">FoxHQ</h1>
            <p className="text-[10px] uppercase tracking-widest text-blue-400 font-bold">Super Admin</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
          <NavLink icon={<Users size={18} />} label="Access Control" active />
          {/* Future items */}
        </nav>

        <div className="p-4 border-t border-[var(--border)]">
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] rounded-xl transition-all"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            Toggle Theme
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all mt-2"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--orb1)] blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--orb2)] blur-[120px]" />
        </div>
        
        <div className="relative z-10 h-full p-8">
          <Routes>
            <Route path="/" element={<SuperAdminDashboard />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function NavLink({ icon, label, active }: any) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
      active 
        ? 'bg-[var(--nav-active)] text-white shadow-lg shadow-blue-500/20' 
        : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
    }`}>
      {icon}
      {label}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
