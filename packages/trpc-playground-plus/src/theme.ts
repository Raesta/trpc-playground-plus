export const theme = {
  colors: {
    bg: {
      root: '#0d1117',
      primary: '#161b22',
      secondary: '#1a1a2e',
      hover: '#21262d',
      active: '#2d2d4a',
      overlay: 'rgba(0, 0, 0, 0.5)',
      code: '#1e1e2e',
    },
    border: {
      primary: '#30363d',
      secondary: '#444c56',
      focus: 'rgba(56, 139, 253, 0.4)',
    },
    text: {
      primary: '#e6edf3',
      secondary: '#8b949e',
      muted: '#6e7681',
      link: '#58a6ff',
    },
    accent: {
      query: '#3b82f6',
      mutation: '#f59e0b',
      router: '#a855f7',
      subscription: '#10b981',
      play: '#4CAF50',
      danger: '#ef4444',
      info: '#7dd3fc',
      primary: '#58a6ff',
      checkbox: '#0078d4',
      spinner: '#0ea5e9',
    },
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
  },
  font: {
    sans: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'Fira Code', 'Cascadia Code', Consolas, monospace",
    size: {
      xs: '13px',
      sm: '14px',
      base: '15px',
      md: '16px',
    },
  },
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.3)',
    md: '0 4px 12px rgba(0,0,0,0.4)',
    lg: '0 8px 24px rgba(0,0,0,0.5)',
  },
  transition: {
    fast: '0.15s ease',
    normal: '0.2s ease',
  },
} as const;

export type Theme = typeof theme;
