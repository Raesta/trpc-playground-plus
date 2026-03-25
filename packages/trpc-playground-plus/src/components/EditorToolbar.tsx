import React, { useCallback } from 'react';
import { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { unfoldAll, foldable, foldEffect } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { theme as t } from '../theme';

interface EditorToolbarProps {
  editorRef: React.RefObject<ReactCodeMirrorRef | null>;
  onTabDrawerClick?: () => void;
  children?: React.ReactNode;
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: t.colors.bg.primary,
    borderBottom: `1px solid ${t.colors.border.primary}`,
    flexShrink: 0,
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: '1px solid transparent',
    borderRadius: t.radius.sm,
    color: t.colors.text.secondary,
    fontSize: '13px',
    padding: '2px 6px',
    cursor: 'pointer',
    transition: `all ${t.transition.fast}`,
    lineHeight: 1,
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.bg.primary,
    border: `1px solid ${t.colors.border.primary}`,
    borderRadius: t.radius.md,
    color: t.colors.text.primary,
    fontSize: '13px',
    padding: '4px 10px',
    cursor: 'pointer',
    transition: `background-color ${t.transition.normal}`,
    lineHeight: 1,
    gap: '5px',
  },
};

const ToolbarButton: React.FC<{
  title: string;
  onClick: () => void;
  variant?: 'icon' | 'pill';
  children: React.ReactNode;
}> = ({ title, onClick, variant = 'icon', children }) => (
  <button
    title={title}
    onClick={onClick}
    style={variant === 'pill' ? styles.pill : styles.btn}
    onMouseOver={(e) => {
      e.currentTarget.style.backgroundColor = t.colors.bg.hover;
      if (variant === 'icon') {
        e.currentTarget.style.borderColor = t.colors.border.secondary;
      }
      e.currentTarget.style.color = t.colors.text.primary;
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.backgroundColor = variant === 'pill' ? t.colors.bg.primary : 'transparent';
      e.currentTarget.style.borderColor = variant === 'pill' ? t.colors.border.primary : 'transparent';
      e.currentTarget.style.color = variant === 'pill' ? t.colors.text.primary : t.colors.text.secondary;
    }}
  >
    {children}
  </button>
);

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editorRef, onTabDrawerClick, children }) => {
  const getView = useCallback(() => editorRef.current?.view ?? null, [editorRef]);

  const handleFoldAll = useCallback(() => {
    const view = getView();

    if (!view) {
      return;
    }

    unfoldAll(view);

    const { state } = view;
    const effects = [];

    for (let i = 1; i <= state.doc.lines; i++) {
      const line = state.doc.line(i);
      const range = foldable(state, line.from, line.to);
      if (range) effects.push(foldEffect.of({ from: range.from, to: range.to }));
    }

    if (effects.length) {
      view.dispatch({ effects });
    }
  }, [getView]);

  const handleUnfoldAll = useCallback(() => {
    const view = getView();
    if (view) {
      unfoldAll(view);
    }
  }, [getView]);

  return (
    <div style={styles.toolbar}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {onTabDrawerClick && (
          <ToolbarButton title="Tab Headers & Variables" onClick={onTabDrawerClick} variant="pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Headers & Variables
          </ToolbarButton>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <ToolbarButton title="Fold all" onClick={handleFoldAll} variant="pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 12 6 20 14" />
            <polyline points="4 22 12 14 20 22" />
          </svg>
        </ToolbarButton>
        <ToolbarButton title="Unfold all" onClick={handleUnfoldAll} variant="pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 6 12 14 20 6" />
            <polyline points="4 14 12 22 20 14" />
          </svg>
        </ToolbarButton>
        {children}
      </div>
    </div>
  );
};
