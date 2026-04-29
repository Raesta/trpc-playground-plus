import { json } from '@codemirror/lang-json';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import type React from 'react';
import { useMemo, useRef } from 'react';
import { createEditorTheme, getCodeMirrorTheme } from '../editorTheme';
import { useTheme } from '../ThemeContext';
import type { CallInfo } from '../types';
import { EditorToolbar } from './EditorToolbar';

interface JsonViewerProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  callInfo?: CallInfo | null;
  fontSize?: number;
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

export const JsonViewer: React.FC<JsonViewerProps> = ({ value, onChange, isLoading, callInfo, fontSize = 15 }) => {
  const theme = useTheme();
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const editorTheme = useMemo(() => createEditorTheme(fontSize, theme), [fontSize, theme]);
  const cmTheme = useMemo(() => getCodeMirrorTheme(theme), [theme]);

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
      <EditorToolbar editorRef={editorRef} leftContent={callInfo ? <CallInfoInline info={callInfo} /> : null} />
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <Spinner />
        </div>
      )}
      <CodeMirror
        ref={editorRef}
        value={value}
        theme={cmTheme}
        extensions={[json(), editorTheme]}
        onChange={onChange}
        editable={false}
        style={styles.editor}
      />
    </div>
  );
};
