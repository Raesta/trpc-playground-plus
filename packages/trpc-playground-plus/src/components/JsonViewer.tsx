import { json } from '@codemirror/lang-json';
import { search } from '@codemirror/search';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { createEditorTheme, getCodeMirrorTheme } from '../editorTheme';
import { createSearchKeymap, createSearchTheme } from '../searchTheme';
import { useTheme } from '../ThemeContext';
import type { CallInfo, HistoryEntry } from '../types';
import { EditorToolbar } from './EditorToolbar';
import { HistoryModal } from './HistoryModal';
import { HistoryPanel } from './HistoryPanel';

interface JsonViewerProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  callInfo?: CallInfo | null;
  fontSize?: number;
  searchShortcut?: string;
  history?: HistoryEntry[];
  onReplay?: (code: string) => void;
  onClearHistory?: () => void;
}

const spinnerKeyframes = `
@keyframes trpc-spin {
  to { transform: rotate(360deg); }
}
`;

const Spinner: React.FC = () => {
  const theme = useTheme();
  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div
        style={{
          width: 32,
          height: 32,
          border: `3px solid ${theme.colors.border.primary}`,
          borderTopColor: theme.colors.accent.spinner,
          borderRadius: '50%',
          animation: 'trpc-spin 0.7s linear infinite',
        }}
      />
    </>
  );
};

const CallInfoInline: React.FC<{ info: CallInfo }> = ({ info }) => {
  const theme = useTheme();
  const methodColor = info.method === 'mutation' ? theme.colors.accent.mutation : theme.colors.accent.query;
  const statusColor = info.status === 'ok' ? theme.colors.accent.play : theme.colors.accent.danger;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: theme.font.size.sm,
        fontFamily: theme.font.mono,
        color: theme.colors.text.secondary,
      }}
    >
      <span
        style={{
          color: methodColor,
          fontWeight: 600,
          textTransform: 'uppercase',
          fontSize: theme.font.size.xs,
          letterSpacing: '0.5px',
        }}
      >
        {info.method}
      </span>
      <span style={{ color: theme.colors.text.primary, fontWeight: 600 }}>{info.procedure}</span>
      <span style={{ color: theme.colors.text.muted }}>·</span>
      <span>{info.durationMs}ms</span>
      <span style={{ color: statusColor, fontWeight: 600 }}>{info.status === 'ok' ? '✓' : '✗'}</span>
    </div>
  );
};

export const JsonViewer: React.FC<JsonViewerProps> = ({
  value,
  onChange,
  isLoading,
  callInfo,
  fontSize = 15,
  searchShortcut,
  history,
  onReplay,
  onClearHistory,
}) => {
  const theme = useTheme();
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [modal, setModal] = useState<{ mode: 'view' | 'compare'; entry: HistoryEntry } | null>(null);
  const entries = history ?? [];
  const current = entries[0] ?? null;
  const editorTheme = useMemo(() => createEditorTheme(fontSize, theme), [fontSize, theme]);
  const cmTheme = useMemo(() => getCodeMirrorTheme(theme), [theme]);
  const searchTheme = useMemo(() => createSearchTheme(theme), [theme]);
  const searchKeymapExt = useMemo(() => createSearchKeymap(searchShortcut), [searchShortcut]);

  const styles: Record<string, React.CSSProperties> = useMemo(
    () => ({
      container: {
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        border: `1px solid ${theme.colors.border.primary}`,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        backgroundColor: theme.colors.bg.primary,
        height: '100%',
        width: '100%',
      },
      editor: {
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        minHeight: 0,
        flex: 1,
      },
      loadingOverlay: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.bg.overlay,
        zIndex: 10,
      },
    }),
    [theme],
  );

  return (
    <div style={styles.container}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <EditorToolbar
          editorRef={editorRef}
          showCopy
          onHistoryClick={onReplay ? () => setHistoryOpen((o) => !o) : undefined}
          historyCount={entries.length}
          leftContent={callInfo ? <CallInfoInline info={callInfo} /> : null}
        />
        {historyOpen && (
          <HistoryPanel
            entries={entries}
            currentId={current?.id}
            onView={(entry) => {
              setModal({ mode: 'view', entry });
              setHistoryOpen(false);
            }}
            onReplay={(entry) => {
              onReplay?.(entry.code);
              setHistoryOpen(false);
            }}
            onCompare={(entry) => {
              setModal({ mode: 'compare', entry });
              setHistoryOpen(false);
            }}
            onClear={() => {
              onClearHistory?.();
              setHistoryOpen(false);
            }}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </div>
      {modal && (
        <HistoryModal
          mode={modal.mode}
          entry={modal.entry}
          current={current}
          fontSize={fontSize}
          onClose={() => setModal(null)}
        />
      )}
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <Spinner />
        </div>
      )}
      <CodeMirror
        ref={editorRef}
        value={value}
        theme={cmTheme}
        extensions={[json(), editorTheme, search({ top: true }), searchKeymapExt, searchTheme]}
        onChange={onChange}
        editable={false}
        style={styles.editor}
      />
    </div>
  );
};
