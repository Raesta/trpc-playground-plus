import React, { useRef, useMemo } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { json } from "@codemirror/lang-json"
import { theme as t } from '../theme';
import { createEditorTheme } from '../editorTheme';
import { EditorToolbar } from './EditorToolbar';

interface JsonViewerProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
  fontSize?: number;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    border: `1px solid ${t.colors.border.primary}`,
    borderRadius: t.radius.md,
    overflow: 'hidden',
    backgroundColor: t.colors.bg.primary,
    height: '100%',
    width: '100%'
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
    backgroundColor: 'rgba(22, 27, 34, 0.75)',
    zIndex: 10,
  },
}

const spinnerKeyframes = `
@keyframes trpc-spin {
  to { transform: rotate(360deg); }
}
`;

const Spinner: React.FC = () => (
  <>
    <style>{spinnerKeyframes}</style>
    <div
      style={{
        width: 32,
        height: 32,
        border: `3px solid ${t.colors.border.primary}`,
        borderTopColor: t.colors.accent.spinner,
        borderRadius: '50%',
        animation: 'trpc-spin 0.7s linear infinite',
      }}
    />
  </>
);

export const JsonViewer: React.FC<JsonViewerProps> = ({ value, onChange, isLoading, fontSize = 15 }) => {
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const editorTheme = useMemo(() => createEditorTheme(fontSize), [fontSize]);

  return (
    <div style={styles.container}>
      <EditorToolbar editorRef={editorRef} />
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <Spinner />
        </div>
      )}
      <CodeMirror
        ref={editorRef}
        value={value}
        theme={vscodeDark}
        extensions={[
          json(),
          editorTheme,
        ]}
        onChange={onChange}
        editable={false}
        style={styles.editor}
      />
    </div>
  );
};