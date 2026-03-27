import { EditorView } from '@codemirror/view';
import { ThemeConfig, getTheme } from './theme';
import { Extension } from '@codemirror/state';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';

export function getCodeMirrorTheme(theme: ThemeConfig): Extension {
  // Compare bg.root to determine if it's a light or dark theme
  return theme.colors.bg.root === '#ffffff' ? vscodeLight : vscodeDark;
}

export function createEditorTheme(fontSize = 15, theme?: ThemeConfig): Extension {
  const t = theme || getTheme('dark');
  return EditorView.theme({
  '&': {
    backgroundColor: `${t.colors.bg.root} !important`,
    color: t.colors.text.primary,
  },
  '.cm-content': {
    caretColor: t.colors.accent.primary,
    fontFamily: t.font.mono,
    fontSize: `${fontSize}px`,
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: `${t.colors.accent.primary} !important`,
  },
  '.cm-gutters': {
    backgroundColor: `${t.colors.bg.root} !important`,
    color: t.colors.text.muted,
    borderRight: `1px solid ${t.colors.border.primary}`,
  },
  '.cm-activeLineGutter': {
    backgroundColor: `${t.colors.bg.hover} !important`,
    color: `${t.colors.text.secondary} !important`,
  },
  '.cm-activeLine': {
    backgroundColor: `${t.colors.bg.hover}99 !important`,
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: `${t.colors.accent.primary}26 !important`,
  },
  '.cm-selectionMatch': {
    backgroundColor: `${t.colors.accent.primary}1a`,
  },
  '.cm-matchingBracket': {
    backgroundColor: `${t.colors.accent.primary}40 !important`,
    outline: `1px solid ${t.colors.border.secondary}`,
  },
  '.cm-panels': {
    backgroundColor: t.colors.bg.primary,
    color: t.colors.text.primary,
  },
  '.cm-foldPlaceholder': {
    backgroundColor: t.colors.bg.hover,
    border: `1px solid ${t.colors.border.primary}`,
    color: t.colors.text.secondary,
  },
  '.cm-tooltip': {
    backgroundColor: `${t.colors.bg.secondary} !important`,
    border: `1px solid ${t.colors.border.primary} !important`,
    borderRadius: `${t.radius.md} !important`,
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '3ch',
    padding: '0 8px 0 4px',
  },
  '.cm-foldGutter .cm-gutterElement span': {
    fontSize: `${t.font.size.base} !important`,
    lineHeight: 'inherit',
    verticalAlign: 'middle',
  },
  '.cm-scroller': {
    fontFamily: t.font.mono,
    scrollbarColor: `${t.colors.border.secondary} ${t.colors.bg.root}`,
    scrollbarWidth: 'thin',
  },
  '.cm-scroller::-webkit-scrollbar': {
    width: '8px',
    height: '8px',
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    backgroundColor: t.colors.bg.root,
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: t.colors.border.secondary,
    borderRadius: '4px',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: t.colors.text.muted,
  },
});
}

export const editorThemeExtension: Extension = createEditorTheme();
