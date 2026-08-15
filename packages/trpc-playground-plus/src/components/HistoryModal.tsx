import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createEditorTheme, getCodeMirrorTheme } from '../editorTheme';
import { useTheme } from '../ThemeContext';
import type { HistoryEntry } from '../types';

/** Copy text to the clipboard, falling back to execCommand in non-secure contexts. */
async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}

/** Small "copy to clipboard" button used in the view-mode section headers. */
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    if (await copyToClipboard(text)) setCopied(true);
  }, [text]);

  return (
    <button
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      onClick={handleCopy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: 'none',
        border: `1px solid ${theme.colors.border.primary}`,
        borderRadius: theme.radius.sm,
        color: theme.colors.text.secondary,
        fontSize: theme.font.size.xs,
        padding: '2px 7px',
        cursor: 'pointer',
        transition: `all ${theme.transition.fast}`,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = theme.colors.bg.hover;
        e.currentTarget.style.color = theme.colors.text.primary;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = theme.colors.text.secondary;
      }}
    >
      {copied ? (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={theme.colors.accent.play}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

interface HistoryModalProps {
  mode: 'view' | 'compare';
  entry: HistoryEntry;
  /** The current request (most recent entry) — required for `compare`. */
  current?: HistoryEntry | null;
  fontSize?: number;
  onClose: () => void;
}

/** A side-by-side CodeMirror diff of two documents (`a` = current, `b` = history). */
const DiffView: React.FC<{ a: string; b: string; lang: 'json' | 'js'; fontSize?: number }> = ({
  a,
  b,
  lang,
  fontSize,
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const langExt = lang === 'json' ? json() : javascript({ typescript: true });
    const shared = [
      langExt,
      createEditorTheme(fontSize, theme),
      getCodeMirrorTheme(theme),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      EditorView.lineWrapping,
    ];
    const view = new MergeView({
      a: { doc: a, extensions: shared },
      b: { doc: b, extensions: shared },
      parent: containerRef.current,
      gutter: true,
    });
    return () => view.destroy();
  }, [a, b, lang, fontSize, theme]);

  return <div ref={containerRef} style={{ overflow: 'auto' }} />;
};

/** A single read-only CodeMirror block for the "view" mode. */
const ReadOnlyBlock: React.FC<{ value: string; lang: 'json' | 'js'; fontSize?: number }> = ({
  value,
  lang,
  fontSize,
}) => {
  const theme = useTheme();
  const editorTheme = useMemo(() => createEditorTheme(fontSize, theme), [fontSize, theme]);
  const cmTheme = useMemo(() => getCodeMirrorTheme(theme), [theme]);
  const ext = useMemo(
    () => [lang === 'json' ? json() : javascript({ typescript: true }), editorTheme],
    [lang, editorTheme],
  );
  return (
    <CodeMirror
      value={value}
      theme={cmTheme}
      extensions={ext}
      editable={false}
      basicSetup={{ highlightActiveLine: false, highlightActiveLineGutter: false }}
      style={{ overflow: 'auto', maxHeight: 260 }}
    />
  );
};

export const HistoryModal: React.FC<HistoryModalProps> = ({ mode, entry, current, fontSize, onClose }) => {
  const theme = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sectionLabel: React.CSSProperties = {
    fontSize: theme.font.size.xs,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.colors.text.muted,
    padding: '8px 12px 4px',
  };

  const columnHeaders = (
    <div style={{ display: 'flex', borderBottom: `1px solid ${theme.colors.border.primary}` }}>
      <div
        style={{
          flex: 1,
          padding: '4px 12px',
          fontSize: theme.font.size.xs,
          fontWeight: 600,
          color: theme.colors.text.secondary,
          borderRight: `1px solid ${theme.colors.border.primary}`,
        }}
      >
        actuelle {current ? `· ${current.procedure}` : ''}
      </div>
      <div
        style={{
          flex: 1,
          padding: '4px 12px',
          fontSize: theme.font.size.xs,
          fontWeight: 600,
          color: theme.colors.text.secondary,
        }}
      >
        historique · {entry.procedure}
      </div>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: theme.colors.bg.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: mode === 'compare' ? 'min(1100px, 95vw)' : 'min(760px, 90vw)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: theme.colors.bg.primary,
          border: `1px solid ${theme.colors.border.primary}`,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          boxShadow: `0 12px 40px ${theme.colors.bg.overlay}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: `1px solid ${theme.colors.border.primary}`,
          }}
        >
          <h3 style={{ margin: 0, color: theme.colors.text.primary, fontSize: theme.font.size.md }}>
            {mode === 'compare' ? 'Compare requests' : 'Request details'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: theme.colors.text.secondary,
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = theme.colors.text.primary)}
            onMouseOut={(e) => (e.currentTarget.style.color = theme.colors.text.secondary)}
          >
            ×
          </button>
        </div>

        <div style={{ overflow: 'auto' }}>
          {mode === 'compare' ? (
            <>
              <div style={sectionLabel}>Input</div>
              {columnHeaders}
              <DiffView a={current?.code ?? ''} b={entry.code} lang="js" fontSize={fontSize} />
              <div style={sectionLabel}>Output</div>
              {columnHeaders}
              <DiffView a={current?.response ?? ''} b={entry.response} lang="json" fontSize={fontSize} />
            </>
          ) : (
            <>
              <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Input</span>
                <CopyButton text={entry.code} />
              </div>
              <ReadOnlyBlock value={entry.code} lang="js" fontSize={fontSize} />
              <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Output</span>
                <CopyButton text={entry.response} />
              </div>
              <ReadOnlyBlock value={entry.response} lang="json" fontSize={fontSize} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
