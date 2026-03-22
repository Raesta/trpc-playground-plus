import { EditorView } from '@codemirror/view';
import { theme } from './theme';
import { Extension } from '@codemirror/state';

export function createEditorTheme(fontSize = 15): Extension {
  return EditorView.theme({
  '&': {
    backgroundColor: `${theme.colors.bg.root} !important`,
    color: theme.colors.text.primary,
  },
  '.cm-content': {
    caretColor: theme.colors.accent.primary,
    fontFamily: theme.font.mono,
    fontSize: `${fontSize}px`,
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: `${theme.colors.accent.primary} !important`,
  },
  '.cm-gutters': {
    backgroundColor: `${theme.colors.bg.root} !important`,
    color: theme.colors.text.muted,
    borderRight: `1px solid ${theme.colors.border.primary}`,
  },
  '.cm-activeLineGutter': {
    backgroundColor: `${theme.colors.bg.hover} !important`,
    color: `${theme.colors.text.secondary} !important`,
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(22, 27, 34, 0.6) !important',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(56, 139, 253, 0.15) !important',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'rgba(56, 139, 253, 0.1)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(56, 139, 253, 0.25) !important',
    outline: `1px solid ${theme.colors.border.secondary}`,
  },
  '.cm-panels': {
    backgroundColor: theme.colors.bg.primary,
    color: theme.colors.text.primary,
  },
  '.cm-foldPlaceholder': {
    backgroundColor: theme.colors.bg.hover,
    border: `1px solid ${theme.colors.border.primary}`,
    color: theme.colors.text.secondary,
  },
  '.cm-tooltip': {
    backgroundColor: `${theme.colors.bg.secondary} !important`,
    border: `1px solid ${theme.colors.border.primary} !important`,
    borderRadius: `${theme.radius.md} !important`,
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '3ch',
    padding: '0 8px 0 4px',
  },
  '.cm-foldGutter .cm-gutterElement span': {
    fontSize: `${theme.font.size.base} !important`,
    lineHeight: 'inherit',
    verticalAlign: 'middle',
  },
  '.cm-scroller': {
    fontFamily: theme.font.mono,
  },
});
}

export const editorThemeExtension: Extension = createEditorTheme();
