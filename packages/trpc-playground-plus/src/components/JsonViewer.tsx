import React, { useRef, useMemo } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { getCodeMirrorTheme } from '../editorTheme';
import { json } from "@codemirror/lang-json"
import { useTheme } from '../ThemeContext';
import { createEditorTheme } from '../editorTheme';
import { EditorToolbar } from './EditorToolbar';

interface JsonViewerProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
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

export const JsonViewer: React.FC<JsonViewerProps> = ({ value, onChange, isLoading, fontSize = 15 }) => {
  const theme = useTheme();
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const editorTheme = useMemo(() => createEditorTheme(fontSize, theme), [fontSize, theme]);
  const cmTheme = useMemo(() => getCodeMirrorTheme(theme), [theme]);

  const styles: Record<string, React.CSSProperties> = useMemo(() => ({
    container: {
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      border: `1px solid ${theme.colors.border.primary}`,
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      backgroundColor: theme.colors.bg.primary,
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
      backgroundColor: theme.colors.bg.overlay,
      zIndex: 10,
    },
  }), [theme]);

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
        theme={cmTheme}
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
