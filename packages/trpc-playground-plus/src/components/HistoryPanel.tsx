import type React from 'react';
import { useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import type { HistoryEntry } from '../types';
import { formatRelativeTime } from '../utils/history';

interface HistoryPanelProps {
  entries: HistoryEntry[];
  /** The most recent entry (index 0) — "Compare" is disabled against itself. */
  currentId?: string;
  onView: (entry: HistoryEntry) => void;
  onReplay: (entry: HistoryEntry) => void;
  onCompare: (entry: HistoryEntry) => void;
  onClear: () => void;
  onClose: () => void;
}

const RowButton: React.FC<{
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ title, onClick, disabled, children }) => {
  const theme = useTheme();
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        background: 'none',
        border: `1px solid ${theme.colors.border.primary}`,
        borderRadius: theme.radius.sm,
        color: disabled ? theme.colors.text.muted : theme.colors.text.secondary,
        fontSize: theme.font.size.xs,
        padding: '3px 7px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `all ${theme.transition.fast}`,
      }}
      onMouseOver={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = theme.colors.bg.hover;
        e.currentTarget.style.color = theme.colors.text.primary;
      }}
      onMouseOut={(e) => {
        if (disabled) return;
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = theme.colors.text.secondary;
      }}
    >
      {children}
    </button>
  );
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  entries,
  currentId,
  onView,
  onReplay,
  onCompare,
  onClear,
  onClose,
}) => {
  const theme = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);
  const now = Date.now();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    // Defer so the click that opened the panel doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener('mousedown', onClickOutside), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
      clearTimeout(id);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: '100%',
        right: 8,
        marginTop: 4,
        width: 560,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 360,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.bg.primary,
        border: `1px solid ${theme.colors.border.primary}`,
        borderRadius: theme.radius.md,
        boxShadow: `0 8px 24px ${theme.colors.bg.overlay}`,
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: `1px solid ${theme.colors.border.primary}`,
        }}
      >
        <span
          style={{
            fontSize: theme.font.size.xs,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.colors.text.muted,
          }}
        >
          History ({entries.length})
        </span>
        {entries.length > 0 && (
          <RowButton title="Clear all history" onClick={onClear}>
            Clear all
          </RowButton>
        )}
      </div>

      <div style={{ overflowY: 'auto' }}>
        {entries.length === 0 ? (
          <div
            style={{
              padding: '20px 12px',
              textAlign: 'center',
              color: theme.colors.text.muted,
              fontSize: theme.font.size.sm,
            }}
          >
            No requests yet
          </div>
        ) : (
          entries.map((entry) => {
            const methodColor =
              entry.method === 'mutation' ? theme.colors.accent.mutation : theme.colors.accent.query;
            const statusColor = entry.status === 'ok' ? theme.colors.accent.play : theme.colors.accent.danger;
            const isCurrent = entry.id === currentId;
            return (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '7px 10px',
                  borderBottom: `1px solid ${theme.colors.border.primary}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      color: methodColor,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      fontSize: theme.font.size.xs,
                      letterSpacing: '0.5px',
                      flexShrink: 0,
                    }}
                  >
                    {entry.method}
                  </span>
                  <span
                    style={{
                      color: theme.colors.text.primary,
                      fontWeight: 600,
                      fontSize: theme.font.size.sm,
                      fontFamily: theme.font.mono,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={entry.procedure}
                  >
                    {entry.procedure}
                  </span>
                  <span style={{ color: statusColor, fontWeight: 600, flexShrink: 0 }}>
                    {entry.status === 'ok' ? '✓' : '✗'}
                  </span>
                  <span style={{ color: theme.colors.text.muted, fontSize: theme.font.size.xs, flexShrink: 0 }}>
                    {entry.durationMs}ms · {formatRelativeTime(entry.timestamp, now)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <RowButton title="View input & output" onClick={() => onView(entry)}>
                    View
                  </RowButton>
                  <RowButton title="Replay this request" onClick={() => onReplay(entry)}>
                    Replay
                  </RowButton>
                  <RowButton
                    title={isCurrent ? 'This is the current request' : 'Compare with the current request'}
                    onClick={() => onCompare(entry)}
                    disabled={isCurrent}
                  >
                    Compare
                  </RowButton>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
