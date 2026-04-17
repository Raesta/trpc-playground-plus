import type { ThemeMode } from './types';

const darkTheme = {
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

const lightTheme = {
  colors: {
    bg: {
      root: '#ffffff',
      primary: '#f6f8fa',
      secondary: '#f0f2f5',
      hover: '#e8eaed',
      active: '#d0d7de',
      overlay: 'rgba(0, 0, 0, 0.3)',
      code: '#f6f8fa',
    },
    border: {
      primary: '#d0d7de',
      secondary: '#b0b8c1',
      focus: 'rgba(9, 105, 218, 0.3)',
    },
    text: {
      primary: '#1f2328',
      secondary: '#656d76',
      muted: '#8b949e',
      link: '#0969da',
    },
    accent: {
      query: '#0969da',
      mutation: '#bf8700',
      router: '#8250df',
      subscription: '#0e8a4e',
      play: '#1a7f37',
      danger: '#cf222e',
      info: '#0969da',
      primary: '#0969da',
      checkbox: '#0969da',
      spinner: '#0969da',
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
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 4px 12px rgba(0,0,0,0.1)',
    lg: '0 8px 24px rgba(0,0,0,0.15)',
  },
  transition: {
    fast: '0.15s ease',
    normal: '0.2s ease',
  },
} as const;

// Use a widened type so both themes are assignable
export interface ThemeConfig {
  colors: {
    bg: {
      root: string;
      primary: string;
      secondary: string;
      hover: string;
      active: string;
      overlay: string;
      code: string;
    };
    border: { primary: string; secondary: string; focus: string };
    text: { primary: string; secondary: string; muted: string; link: string };
    accent: {
      query: string;
      mutation: string;
      router: string;
      subscription: string;
      play: string;
      danger: string;
      info: string;
      primary: string;
      checkbox: string;
      spinner: string;
    };
  };
  radius: { sm: string; md: string; lg: string };
  font: { sans: string; mono: string; size: { xs: string; sm: string; base: string; md: string } };
  shadow: { sm: string; md: string; lg: string };
  transition: { fast: string; normal: string };
}

export function getTheme(mode: ThemeMode): ThemeConfig {
  return mode === 'light' ? lightTheme : darkTheme;
}

// Keep a default export for backward compatibility during migration
export const theme = darkTheme;
export type Theme = typeof darkTheme;
