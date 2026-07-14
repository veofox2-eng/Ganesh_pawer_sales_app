import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserCog, LogOut, Zap, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import ThemeSwitcher from './ThemeSwitcher';

interface LayoutProps { children: React.ReactNode; }

const navItems = [
  { to: '/dashboard',                 end: true,  Icon: LayoutDashboard, label: 'Overview'        },
  { to: '/dashboard/sales-employees', end: false, Icon: Users,           label: 'Sales Employees' },
  { to: '/dashboard/field-employees', end: false, Icon: UserCog,         label: 'Field Employees' },
];

const sidebarVariants = {
  hidden: { x: -20, opacity: 0 },
  show:  { x: 0, opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const itemV = {
  hidden: { x: -14, opacity: 0 },
  show:  { x: 0,   opacity: 1, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function Layout({ children }: LayoutProps) {
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
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
        style={{
          position: 'fixed', top: '40%', right: '20%', zIndex: 0, pointerEvents: 'none',
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, var(--orb3) 0%, transparent 70%)',
          filter: 'blur(48px)', transition: 'background 0.5s ease',
        }}
      />

      {/* Grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.013) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.013) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* ── Sidebar ─────────────────────────────────── */}
      <motion.aside
        variants={sidebarVariants} initial="hidden" animate="show"
        className="glass"
        style={{
          position: 'relative', zIndex: 10,
          width: 240, flexShrink: 0,
          margin: '0.875rem', marginRight: 0,
          borderRadius: 20,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
          overflow: 'hidden',
          transition: 'background 0.4s ease, border-color 0.4s ease',
        }}
      >
        {/* Brand */}
        <motion.div variants={itemV} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '1.5rem 1.25rem 1.25rem',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03), transparent)'
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 18px var(--accent-glow)',
            transition: 'background 0.4s ease, box-shadow 0.4s ease',
          }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: '1rem', fontWeight: 800, color: 'transparent', backgroundImage: 'linear-gradient(to right, var(--text), var(--accent))', WebkitBackgroundClip: 'text', letterSpacing: '-0.02em', transition: 'color 0.4s ease' }}>Fox Sales App</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'color 0.4s ease' }}>Admin Portal</p>
          </div>
        </motion.div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          <motion.p variants={itemV} style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', padding: '0 0.5rem', marginBottom: 6, transition: 'color 0.4s ease' }}>
            Navigation
          </motion.p>
          {navItems.map(({ to, end, Icon, label }) => (
            <motion.div key={to} variants={itemV}>
              <NavLink
                to={to} end={end}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '0.625rem 0.875rem', borderRadius: 12,
                  color: isActive ? '#fff' : 'var(--muted)',
                  background: isActive ? 'var(--nav-active)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.875rem', textDecoration: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? `0 4px 16px var(--accent-glow)` : 'none',
                  letterSpacing: '-0.01em', cursor: 'none',
                })}
              >
                {({ isActive }) => (<><Icon size={16} style={{ opacity: isActive ? 1 : 0.65 }} />{label}</>)}
              </NavLink>
            </motion.div>
          ))}
        </nav>

        {/* Logout */}
        <motion.div variants={itemV} style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <motion.button
            onClick={async () => supabase.auth.signOut()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '0.625rem 0.875rem', borderRadius: 12,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
              color: '#fca5a5', fontSize: '0.875rem', fontWeight: 500,
              cursor: 'none', fontFamily: 'inherit', transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
          >
            <LogOut size={16} /> Logout
          </motion.button>
        </motion.div>
      </motion.aside>

      {/* ── Main ──────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <motion.header
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: 'easeOut' }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.75rem', height: 68, flexShrink: 0 }}
        >
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              BackendAdmin
            </span>
            <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: '1.45rem', color: 'var(--accent)', fontWeight: 400, transform: 'translateY(1px)' }}>
              Dashboard
            </span>
          </h2>
          <ThemeSwitcher />
        </motion.header>
        <main style={{ flex: 1, overflowY: 'auto', padding: '0 1.75rem 1.75rem' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
