import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { saveSettings } from '../settings';
import { useTheme } from '../ThemeContext';
import type { PlaygroundSettings } from '../types';

interface SettingsProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  settings: PlaygroundSettings;
  onSettingsChange: (settings: Partial<PlaygroundSettings>) => void;
}

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;

const TIMEOUT_OPTIONS = [
  { label: 'No limit', value: 0 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '60s', value: 60000 },
];

const Settings = ({ open, setOpen, settings, onSettingsChange }: SettingsProps) => {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
    }
  }, [open]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setMounted(false);
      setClosing(false);
      setOpen(false);
    }, 250);
  };

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    saveSettings({ theme: newTheme });
    onSettingsChange({ theme: newTheme } as any);
  };

  const sectionTitleStyle: React.CSSProperties = useMemo(
    () => ({
      color: theme.colors.text.muted,
      fontSize: theme.font.size.xs,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      padding: '8px 0 6px',
      borderBottom: `1px solid ${theme.colors.border.primary}`,
      marginBottom: '10px',
    }),
    [theme],
  );

  const settingRowStyle: React.CSSProperties = { marginBottom: '14px' };
  const labelStyle: React.CSSProperties = useMemo(
    () => ({
      display: 'block',
      color: theme.colors.text.secondary,
      fontSize: theme.font.size.xs,
      marginBottom: '6px',
    }),
    [theme],
  );

  const selectStyle: React.CSSProperties = useMemo(
    () => ({
      width: '100%',
      backgroundColor: theme.colors.bg.hover,
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border.primary}`,
      borderRadius: theme.radius.sm,
      padding: '6px 8px',
      fontSize: theme.font.size.sm,
      cursor: 'pointer',
      outline: 'none',
    }),
    [theme],
  );

  return (
    <>
      {mounted && (
        <>
          <div
            onClick={handleClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: theme.colors.bg.overlay,
              zIndex: 9,
              animation: closing ? 'fadeOut 0.25s forwards' : 'fadeIn 0.2s forwards',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: '280px',
              backgroundColor: theme.colors.bg.primary,
              borderLeft: `1px solid ${theme.colors.border.primary}`,
              padding: '10px',
              boxSizing: 'border-box',
              overflow: 'auto',
              zIndex: 10,
              animation: closing ? 'slideOut 0.25s forwards' : 'slideIn 0.3s forwards',
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}
            >
              <h3 style={{ color: theme.colors.text.primary, margin: 0 }}>Settings</h3>
              <button
                onClick={handleClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.text.secondary,
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: 1,
                  transition: `color ${theme.transition.fast}`,
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = theme.colors.text.primary)}
                onMouseOut={(e) => (e.currentTarget.style.color = theme.colors.text.secondary)}
              >
                ×
              </button>
            </div>

            {/* Appearance */}
            <div style={sectionTitleStyle}>Appearance</div>

            <div style={settingRowStyle}>
              <label style={labelStyle}>Theme</label>
              <select
                value={settings.theme}
                onChange={(e) => handleThemeChange(e.target.value as 'dark' | 'light')}
                style={selectStyle}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            {/* Editor */}
            <div style={sectionTitleStyle}>Editor</div>

            <div style={settingRowStyle}>
              <label style={labelStyle}>Font size</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  value={settings.fontSize}
                  onChange={(e) => onSettingsChange({ fontSize: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: theme.colors.accent.primary }}
                />
                <span
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: theme.font.size.xs,
                    minWidth: '32px',
                    textAlign: 'right',
                  }}
                >
                  {settings.fontSize}px
                </span>
              </div>
            </div>

            {/* Request */}
            <div style={sectionTitleStyle}>Request</div>

            <div style={settingRowStyle}>
              <label style={labelStyle}>Timeout</label>
              <select
                value={settings.requestTimeout}
                onChange={(e) => onSettingsChange({ requestTimeout: Number(e.target.value) })}
                style={selectStyle}
              >
                {TIMEOUT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Settings;
