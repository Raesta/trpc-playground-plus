import type React from 'react';
import { useMemo, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { eventToKeyString, formatKeyString, hasActionModifier } from '../utils/keybinding';

interface KeybindingInputProps {
  value: string;
  onChange: (key: string) => void;
  /** When provided, shows a reset button that restores this binding. */
  defaultValue?: string;
}

/**
 * Themed "press a combination" capture control. Click to arm, then the next keydown
 * is serialized (CodeMirror syntax) and reported via `onChange`. Escape cancels.
 */
export const KeybindingInput: React.FC<KeybindingInputProps> = ({ value, onChange, defaultValue }) => {
  const theme = useTheme();
  const [capturing, setCapturing] = useState(false);

  const styles = useMemo(
    () => ({
      row: { display: 'flex', alignItems: 'center', gap: '6px' } as React.CSSProperties,
      button: {
        flex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '28px',
        padding: '4px 8px',
        fontFamily: theme.font.mono,
        fontSize: theme.font.size.sm,
        color: capturing ? theme.colors.text.secondary : theme.colors.text.primary,
        backgroundColor: theme.colors.bg.primary,
        border: `1px solid ${capturing ? theme.colors.border.focus : theme.colors.border.primary}`,
        borderRadius: theme.radius.sm,
        cursor: 'pointer',
        transition: `border-color ${theme.transition.fast}`,
      } as React.CSSProperties,
      reset: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        color: theme.colors.text.secondary,
        background: 'none',
        border: `1px solid ${theme.colors.border.primary}`,
        borderRadius: theme.radius.sm,
        cursor: 'pointer',
      } as React.CSSProperties,
      warn: {
        marginTop: '4px',
        fontSize: theme.font.size.xs,
        color: theme.colors.accent.mutation,
      } as React.CSSProperties,
    }),
    [theme, capturing],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setCapturing(false);
      return;
    }
    const key = eventToKeyString(e);
    if (key) {
      onChange(key);
      setCapturing(false);
    }
  };

  const showWarning = !capturing && value !== '' && !hasActionModifier(value);

  return (
    <div>
      <div style={styles.row}>
        <button
          type="button"
          style={styles.button}
          onClick={() => setCapturing(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => setCapturing(false)}
          title="Click, then press the desired shortcut"
        >
          {capturing ? 'Press a combination…' : formatKeyString(value) || 'Unset'}
        </button>
        {defaultValue !== undefined && value !== defaultValue && (
          <button
            type="button"
            style={styles.reset}
            onClick={() => onChange(defaultValue)}
            title="Reset to default"
          >
            ↺
          </button>
        )}
      </div>
      {showWarning && <div style={styles.warn}>No modifier — this key may just be typed into the editor.</div>}
    </div>
  );
};
