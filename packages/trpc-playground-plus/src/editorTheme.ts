import { EditorView } from '@codemirror/view';
import { theme as t } from './theme';
import { Extension } from '@codemirror/state';

export const editorThemeExtension: Extension = EditorView.theme({
  '&': {
    backgroundColor: `${t.colors.bg.root} !important`,
    color: t.colors.text.primary,
  },
  '.cm-content': {
    caretColor: t.colors.accent.primary,
    fontFamily: t.font.mono,
    fontSize: t.font.size.base,
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
  },
});
