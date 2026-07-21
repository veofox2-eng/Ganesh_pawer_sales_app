import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserCog, Shield, Settings,
  ChevronRight, LogOut, Zap, Search, Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps { children: React.ReactNode; }

const navItems = [
  { to: '/dashboard', end: true, Icon: LayoutDashboard, label: 'Overview' },
  { to: '/dashboard/sales-employees', end: false, Icon: Users, label: 'Sales Employees' },
  { to: '/dashboard/field-employees', end: false, Icon: UserCog, label: 'Field Employees' },
  { to: '/dashboard/admin-employees', end: false, Icon: Shield, label: 'Admin Employees' },
];

const sidebarVariants = {
  hidden: { x: -20, opacity: 0 },
  show: { x: 0, opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const itemV = {
  hidden: { x: -14, opacity: 0 },
  show: { x: 0, opacity: 1, transition: { duration: 0.4, ease: 'easeOut' as const } },
};


export default function Layout({ children }: LayoutProps) {
  const { theme } = useTheme();

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'var(--bg)',
      fontFamily: "'Geist','Inter',sans-serif",
      position: 'relative',
      transition: 'background 0.5s ease',
      cursor: 'none',
    }}>
      {/* Ambient orbs – theme-aware colors */}
      <motion.div
        animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'fixed', top: '-15%', left: '-10%', zIndex: 0, pointerEvents: 'none',
          width: 640, height: 640, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--orb1) 0%, transparent 70%)',
          filter: 'blur(64px)', transition: 'background 0.5s ease',
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        style={{
          position: 'fixed', bottom: '-15%', right: '-10%', zIndex: 0, pointerEvents: 'none',
          width: 560, height: 560, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--orb2) 0%, transparent 70%)',
          filter: 'blur(64px)', transition: 'background 0.5s ease',
        }}
      />

      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.013) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.013) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* ── Sidebar ─────────────────────────────────── */}
      <motion.aside
        variants={sidebarVariants} initial="hidden" animate="show"
        style={{
          position: 'relative', zIndex: 10,
          width: 288, flexShrink: 0,
          background: 'var(--surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          transition: 'background 0.4s ease, border-color 0.4s ease',
          padding: '2rem',
        }}
      >
        {/* Brand Container - Stitch Design */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '2.5rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: 'var(--text)', color: 'var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Fox Sales</h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.65rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin Portal</p>
          </div>
        </div>

        {/* Nav List */}
        <nav style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflowY: 'auto',
        }} className="custom-scrollbar">
          {navItems.map(({ to, end, Icon, label }) => (
            <motion.div key={to} variants={itemV}>
              <NavLink
                to={to} end={end}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '0.875rem 1.25rem', borderRadius: 9999,
                  textDecoration: 'none',
                  background: isActive ? 'var(--text)' : 'transparent',
                  color: isActive ? 'var(--surface)' : 'var(--muted)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 500,
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} color={isActive ? 'var(--surface)' : 'var(--muted)'} />
                    <span style={{ fontSize: '0.875rem', letterSpacing: '0.02em' }}>
                      {label}
                    </span>

                    {/* Right Arrow */}
                    {isActive ? (
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 8, background: 'rgba(255,255,255,0.1)' }}>
                        <ChevronRight size={14} color="var(--surface)" />
                      </div>
                    ) : (
                      <ChevronRight size={14} color="var(--border)" style={{ marginLeft: 'auto', opacity: 0.5 }} />
                    )}
                  </>
                )}
              </NavLink>
            </motion.div>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '1.5rem 1rem 1.5rem 1rem', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <button
            onClick={async () => supabase.auth.signOut()}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '0.875rem', borderRadius: 9999,
              background: 'var(--bg2)',
              border: '1px solid rgba(186, 26, 26, 0.4)',
              color: 'rgb(186, 26, 26)', fontSize: '0.875rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.3s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(186, 26, 26, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(186, 26, 26, 0.8)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg2)';
              e.currentTarget.style.borderColor = 'rgba(186, 26, 26, 0.4)';
            }}
          >
            <LogOut size={20} color="rgb(186, 26, 26)" />
            <span style={{ color: 'rgb(186, 26, 26)', textShadow: 'rgba(186, 26, 26, 0.6) 0px 0px 8px', letterSpacing: '0.02em' }}>Logout</span>
          </button>
        </div>
      </motion.aside>

      {/* ── Main ──────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
