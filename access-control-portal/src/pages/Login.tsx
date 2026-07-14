import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    
    // Simulate network delay for UX
    await new Promise(resolve => setTimeout(resolve, 800));

    if (username === 'Foxdigital' && password === 'Fox@2026') {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'fox_test_admin_04@fox.com',
        password: 'Fox@2026_admin123'
      });
      if (error) {
        setError('Invalid credentials. Please try again.');
      } else {
        localStorage.setItem('fox_access_auth', 'true');
        window.location.href = '/dashboard';
      }
    } else {
      setError('Invalid credentials. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      fontFamily: "'Geist','Inter',sans-serif",
      transition: 'background 0.5s ease',
      cursor: 'default',
    }}>
      {/* Orbs */}
      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: '5%', left: '5%', width: 500, height: 500, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, var(--orb1) 0%, transparent 70%)', filter: 'blur(60px)', transition: 'background 0.5s ease' }}
      />
      <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{ position: 'absolute', bottom: '5%', right: '5%', width: 420, height: 420, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, var(--orb2) 0%, transparent 70%)', filter: 'blur(60px)', transition: 'background 0.5s ease' }}
      />
      <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        style={{ position: 'absolute', top: '50%', right: '15%', width: 300, height: 300, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, var(--orb3) 0%, transparent 70%)', filter: 'blur(48px)', transition: 'background 0.5s ease' }}
      />

      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(var(--border-dark) 1px, transparent 1px), linear-gradient(90deg, var(--border-dark) 1px, transparent 1px)',
        backgroundSize: '60px 60px', opacity: 0.5 }} />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, margin: '0 1.5rem' }}
      >
        {/* Brand */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }} style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 18, marginBottom: '1rem',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            boxShadow: '0 0 36px var(--accent-glow)',
            transition: 'background 0.4s ease, box-shadow 0.4s ease',
          }}>
            <ShieldCheck size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: 5, transition: 'color 0.4s ease' }}>
            Fox Editz
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)', transition: 'color 0.4s ease' }}>
            Access Control Portal
          </p>
        </motion.div>

        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{
            background: 'var(--surface)',
            backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid var(--border)', borderBottomColor: 'var(--border-dark)', borderRightColor: 'var(--border-dark)', borderRadius: 24, padding: '2rem',
            boxShadow: '0 24px 64px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
            transition: 'background 0.4s ease, border-color 0.4s ease',
          }}
        >
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#e11d48', fontSize: '0.8125rem', fontWeight: 500 }}>
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Username */}
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.5rem', letterSpacing: '0.07em', textTransform: 'uppercase', transition: 'color 0.4s ease' }}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} required placeholder="Enter username"
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'var(--bg2)', border: '1px solid var(--border-dark)', borderRadius: 10, color: 'var(--text)', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', transition: 'all 0.4s ease' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-dark)'}
              />
            </motion.div>

            {/* Password */}
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.5 }}>
              <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.5rem', letterSpacing: '0.07em', textTransform: 'uppercase', transition: 'color 0.4s ease' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password" required
                  style={{ width: '100%', padding: '0.75rem 3rem', background: 'var(--bg2)', border: '1px solid var(--border-dark)', borderRadius: 10, color: 'var(--text)', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s, background 0.4s ease, color 0.4s ease' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-dark)'}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </motion.div>

            {/* Submit */}
            <motion.button type="submit" disabled={loading}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              whileHover={{ scale: 1.02, boxShadow: '0 0 40px var(--accent-glow)' }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%', padding: '0.875rem', marginTop: 4,
                background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, var(--accent), var(--accent2))',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 0 24px var(--accent-glow)',
                transition: 'background 0.4s ease, box-shadow 0.4s ease', fontFamily: 'inherit',
                letterSpacing: '-0.01em',
              }}
            >
              {loading ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  Authenticating…
                </>
              ) : (<>Sign In <ArrowRight size={16} /></>)}
            </motion.button>
          </form>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}
          style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--muted)', transition: 'color 0.4s ease' }}>
          Authorised personnel only · Fox Editz © 2026
        </motion.p>
      </motion.div>
    </div>
  );
}
