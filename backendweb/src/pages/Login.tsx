import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, ArrowRight, Mail } from 'lucide-react';
import ThemeSwitcher from '../components/ThemeSwitcher';

// Dot Matrix decoration using CSS variables
const DotGrid = () => (
  <div style={{
    backgroundImage: 'radial-gradient(var(--border) 1.5px, transparent 1.5px)',
    backgroundSize: '12px 12px',
    width: 72,
    height: 72,
    opacity: 0.4
  }} />
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Focus states for dynamic outline styles
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); 
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (signInError) {
      setError('Invalid credentials. Please try again.');
      setLoading(false);
    } else {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg2) 100%)',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      position: 'relative', 
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
      transition: 'background 0.5s ease, color 0.5s ease',
      cursor: 'none',
      padding: '1.5rem',
    }}>
      {/* Input placeholder styling tag */}
      <style>{`
        .login-input::placeholder {
          color: var(--muted);
          opacity: 0.8;
        }
      `}</style>

      {/* Background Ambient Orbs */}
      <div style={{ 
        position: 'absolute', top: '-10%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, var(--orb1) 0%, transparent 70%)', filter: 'blur(80px)',
        transition: 'background 0.5s ease'
      }} />
      <div style={{ 
        position: 'absolute', bottom: '-10%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, var(--orb3) 0%, transparent 70%)', filter: 'blur(80px)',
        transition: 'background 0.5s ease'
      }} />

      {/* Decorative Dot Grid (Top Right) */}
      <div style={{ position: 'absolute', top: 40, right: 40, zIndex: 1 }}>
        <DotGrid />
      </div>

      {/* Theme Switcher */}
      <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 30 }}>
        <ThemeSwitcher />
      </div>

      {/* Form Wrapper (Centered) */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ 
          width: '100%', 
          maxWidth: 460, 
          zIndex: 10,
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center' 
        }}
      >
        {/* Main Card */}
        <div style={{
          background: 'var(--surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 24,
          padding: '3rem 2.5rem',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease'
        }}>
          {/* Logo box */}
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px var(--accent-glow)',
            marginBottom: '1.25rem',
            transition: 'background 0.5s ease, box-shadow 0.5s ease'
          }}>
            {/* White silhouette logo */}
            <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 32L36 44L26 51L15 32Z" fill="#ffffff" />
              <path d="M85 32L64 44L74 51L85 32Z" fill="#ffffff" />
              <path d="M50 82L15 45L25 35L50 57L75 35L85 45L50 82Z" fill="#ffffff" />
              <path d="M50 57L36 47L50 35L64 47L50 57Z" fill="var(--bg)" style={{ transition: 'fill 0.5s ease' }} />
            </svg>
          </div>

          {/* Titles */}
          <h1 style={{ 
            fontSize: '1.875rem', fontWeight: 800, color: 'var(--text)', 
            letterSpacing: '-0.02em', margin: '0 0 8px 0', textAlign: 'center',
            transition: 'color 0.5s ease'
          }}>
            Fox Sales App
          </h1>

          {/* Subtitle between lines */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12, marginBottom: '2.5rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)', transition: 'background 0.5s ease' }} />
            <span style={{ 
              fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', 
              letterSpacing: '0.05em', textTransform: 'uppercase',
              transition: 'color 0.5s ease'
            }}>
              Backend Admin Portal
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)', transition: 'background 0.5s ease' }} />
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              width: '100%', marginBottom: '1.5rem', padding: '0.75rem 1rem',
              background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 10,
              color: '#ef4444', fontSize: '0.8125rem', display: 'flex', alignItems: 'center'
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Email field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ 
                fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text)', 
                opacity: 0.7, letterSpacing: '0.05em', textTransform: 'uppercase',
                transition: 'color 0.5s ease'
              }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ 
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', 
                  color: 'var(--muted)', transition: 'color 0.5s ease' 
                }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className="login-input"
                  style={{
                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem',
                    background: 'var(--bg2)', 
                    border: `1px solid ${emailFocused ? 'var(--accent)' : 'var(--border)'}`, 
                    borderRadius: 10,
                    color: 'var(--text)', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit',
                    boxShadow: emailFocused ? '0 0 0 3px var(--accent-glow)' : 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.5s, color 0.5s', 
                    cursor: 'none'
                  }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </div>
            </div>

            {/* Password field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ 
                fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text)', 
                opacity: 0.7, letterSpacing: '0.05em', textTransform: 'uppercase',
                transition: 'color 0.5s ease'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ 
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', 
                  color: 'var(--muted)', transition: 'color 0.5s ease' 
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="login-input"
                  style={{
                    width: '100%', padding: '0.75rem 2.75rem 0.75rem 2.75rem',
                    background: 'var(--bg2)', 
                    border: `1px solid ${passwordFocused ? 'var(--accent)' : 'var(--border)'}`, 
                    borderRadius: 10,
                    color: 'var(--text)', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit',
                    boxShadow: passwordFocused ? '0 0 0 3px var(--accent-glow)' : 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.5s, color 0.5s', 
                    cursor: 'none'
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--muted)', cursor: 'none',
                    display: 'flex', alignItems: 'center', padding: 4,
                    transition: 'color 0.5s ease'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01, boxShadow: '0 12px 28px var(--accent-glow)' }}
              whileTap={{ scale: 0.99 }}
              style={{
                width: '100%', padding: '0.875rem', marginTop: '0.5rem',
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
                border: 'none', borderRadius: 10, color: '#ffffff',
                fontSize: '0.9375rem', fontWeight: 600, cursor: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 8px 24px var(--accent-glow)',
                transition: 'background 0.5s ease, box-shadow 0.5s ease, transform 0.1s ease', 
                fontFamily: 'inherit'
              }}
            >
              {loading ? (
                <motion.div 
                  animate={{ rotate: 360 }} 
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} 
                />
              ) : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </motion.button>
          </form>
        </div>

        {/* Footer Text */}
        <p style={{ 
          textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: 'var(--muted)',
          transition: 'color 0.5s ease' 
        }}>
          Authorised personnel only · Fox Sales App © 2026
        </p>
      </motion.div>
    </div>
  );
}
