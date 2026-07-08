import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Palette } from 'lucide-react';

const themes = [
  { id: 'dark',  label: 'Dark',    Icon: Moon,    dot: null },
  { id: 'light', label: 'Light',   Icon: Sun,     dot: null },
  { id: 'blue',  label: 'Ocean',   Icon: null,    dot: '#38bdf8' },
  { id: 'green', label: 'Forest',  Icon: null,    dot: '#10b981' },
  { id: 'red',   label: 'Crimson', Icon: null,    dot: '#f87171' },
] as const;

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const current = themes.find((t) => t.id === theme);

  return (
    <div style={{ position: 'relative', cursor: 'none' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Change theme"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--surface)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted)', cursor: 'none',
          transition: 'border-color 0.2s, color 0.2s',
          backdropFilter: 'blur(12px)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
      >
        {current?.Icon ? <current.Icon size={15} /> : <Palette size={15} />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} style={{ cursor: 'none' }} />
          <div
            className="glass"
            style={{
              position: 'absolute', right: 0, top: 44, zIndex: 50,
              minWidth: 150, padding: '0.375rem', borderRadius: 14,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px var(--border)',
              animation: 'fadeSlideDown 0.2s ease both',
            }}
          >
            <style>{`@keyframes fadeSlideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
            {themes.map(({ id, label, Icon, dot }) => {
              const active = theme === id;
              return (
                <button
                  key={id}
                  onClick={() => { setTheme(id); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '0.5rem 0.75rem', borderRadius: 10,
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--text)',
                    fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
                    border: 'none', cursor: 'none',
                    transition: 'background 0.15s ease',
                    fontFamily: 'inherit',
                  }}
                >
                  {Icon
                    ? <Icon size={13} />
                    : <span style={{ width: 13, height: 13, borderRadius: '50%', background: dot!, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 6px ${dot}88` }} />
                  }
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
