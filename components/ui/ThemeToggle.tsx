'use client';
import { useTheme } from '@/lib/theme';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} style={{
      background: 'transparent',
      border: '1px solid var(--border2)',
      borderRadius: 20,
      padding: '5px 12px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      color: 'var(--text3)',
      fontSize: 11,
      letterSpacing: '1px',
      transition: 'all .2s',
    }}>
      <span style={{fontSize:14}}>{theme === 'dark' ? '☀' : '☾'}</span>
      <span style={{fontSize:8,letterSpacing:'1.5px',textTransform:'uppercase'}}>
        {theme === 'dark' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}