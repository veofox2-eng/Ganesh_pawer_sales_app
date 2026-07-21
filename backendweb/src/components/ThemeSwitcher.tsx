import { useTheme } from '../context/ThemeContext';
import { Moon, Sun } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    // If the theme is currently light, switch to dark. Otherwise, default/switch to light.
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const Icon = theme === 'light' ? Moon : Sun;

  return (
    <div style={{ position: 'relative', cursor: 'none' }}>
      <button
        onClick={toggleTheme}
        title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} mode`}
        style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--surface)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted)', cursor: 'none',
          transition: 'border-color 0.2s, color 0.2s',
          backdropFilter: 'blur(12px)',
        }}
        onMouseEnter={(e) => { 
          e.currentTarget.style.borderColor = 'var(--accent)'; 
          e.currentTarget.style.color = 'var(--accent)'; 
        }}
        onMouseLeave={(e) => { 
          e.currentTarget.style.borderColor = 'var(--border)'; 
          e.currentTarget.style.color = 'var(--muted)'; 
        }}
      >
        <Icon size={16} />
      </button>
    </div>
  );
}
