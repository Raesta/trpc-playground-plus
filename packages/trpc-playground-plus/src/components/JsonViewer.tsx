import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { json } from "@codemirror/lang-json"

interface JsonViewerProps {
  value: string;
  onChange: (value: string) => void;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    border: '1px solid #333',
    borderRadius: '4px',
    overflow: 'hidden',
    backgroundColor: '#1e1e1e',
    height: '100%',
    width: '100%'
  },
  editor: {
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  }
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ value, onChange }) => {
  return (
    <div style={styles.container}>
      <CodeMirror
        value={value}
        theme={vscodeDark}
        extensions={[
          json(),
        ]}
        onChange={onChange}
        editable={false}
        style={styles.editor}
      />
    </div>
  );
};