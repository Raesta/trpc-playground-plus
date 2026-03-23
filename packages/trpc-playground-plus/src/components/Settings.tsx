import React, { useState, useEffect } from "react";
import { theme as t } from "../theme";
import { PlaygroundSettings } from "../types";

interface SettingsProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  settings: PlaygroundSettings;
  onSettingsChange: (settings: Partial<PlaygroundSettings>) => void;
}

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    color: t.colors.text.muted,
    fontSize: t.font.size.xs,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '8px 0 6px',
    borderBottom: `1px solid ${t.colors.border.primary}`,
    marginBottom: '10px',
  }}>
    {children}
  </div>
);

const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{
      display: 'block',
      color: t.colors.text.secondary,
      fontSize: t.font.size.xs,
      marginBottom: '6px',
    }}>
      {label}
    </label>
    {children}
  </div>
);

const Settings = ({ open, setOpen, settings, onSettingsChange }: SettingsProps) => {
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
              backgroundColor: t.colors.bg.overlay,
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
              backgroundColor: t.colors.bg.primary,
              borderLeft: `1px solid ${t.colors.border.primary}`,
              padding: '10px',
              boxSizing: 'border-box',
              overflow: 'auto',
              zIndex: 10,
              animation: closing ? 'slideOut 0.25s forwards' : 'slideIn 0.3s forwards',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: t.colors.text.primary, margin: 0 }}>Settings</h3>
              <button
                onClick={handleClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: t.colors.text.secondary,
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: 1,
                  transition: `color ${t.transition.fast}`,
                }}
                onMouseOver={(e) => e.currentTarget.style.color = t.colors.text.primary}
                onMouseOut={(e) => e.currentTarget.style.color = t.colors.text.secondary}
              >
                ×
              </button>
            </div>

            <SectionTitle>Editor</SectionTitle>

            <SettingRow label="Font size">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  value={settings.fontSize}
                  onChange={(e) => onSettingsChange({ fontSize: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: t.colors.accent.primary }}
                />
                <span style={{
                  color: t.colors.text.primary,
                  fontSize: t.font.size.xs,
                  minWidth: '32px',
                  textAlign: 'right',
                }}>
                  {settings.fontSize}px
                </span>
              </div>
            </SettingRow>
          </div>
        </>
      )}
    </>
  );
};

export default Settings;
