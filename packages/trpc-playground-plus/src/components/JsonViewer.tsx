import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { json } from "@codemirror/lang-json"
import { theme as t } from '../theme';
import { editorThemeExtension } from '../editorTheme';

interface JsonViewerProps {
  value: string;
  onChange: (value: string) => void;
  isLoading?: boolean;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
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

export const JsonViewer: React.FC<JsonViewerProps> = ({ value, onChange, isLoading }) => {
  return (
    <div style={styles.container}>
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <Spinner />
        </div>
      )}
      <CodeMirror
        value={value}
        theme={vscodeDark}
        extensions={[
          json(),
          editorThemeExtension,
        ]}
        onChange={onChange}
        editable={false}
        style={styles.editor}
      />
    </div>
  );
};