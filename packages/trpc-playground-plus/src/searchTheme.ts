import { closeSearchPanel, openSearchPanel, searchKeymap, searchPanelOpen } from '@codemirror/search';
import { EditorView, keymap } from '@codemirror/view';
import type { ThemeConfig } from './theme';
import { DEFAULT_SEARCH_KEY } from './utils/keybinding';

/** Toggle the search panel: open it, or close it if it's already open. */
export function toggleSearchPanel(view: EditorView): boolean {
  if (searchPanelOpen(view.state)) {
    closeSearchPanel(view);
  } else {
    openSearchPanel(view);
  }
  return true;
}

/**
 * Search keymap with a user-configurable shortcut that TOGGLES the panel: the given
 * key opens the panel or closes it if already open. The rest of CodeMirror's native
 * search bindings (next/prev/replace…) are kept, minus the default `Mod-f` binding it
 * replaces. Scoped to both the editor and the panel so the toggle also fires while the
 * search field is focused.
 */
export function createSearchKeymap(shortcut: string = DEFAULT_SEARCH_KEY) {
  return keymap.of([
    { key: shortcut, run: toggleSearchPanel, scope: 'editor search-panel', preventDefault: true },
    ...searchKeymap.filter((b) => b.key !== DEFAULT_SEARCH_KEY),
  ]);
}

/**
 * Theme the native `@codemirror/search` panel so it matches the app (the default
 * panel is unstyled and clashes in dark mode). Built from the active theme tokens.
 */
export function createSearchTheme(theme: ThemeConfig) {
  return EditorView.theme({
    '.cm-panels': {
      backgroundColor: theme.colors.bg.secondary,
      color: theme.colors.text.primary,
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: `1px solid ${theme.colors.border.primary}`,
    },
    '.cm-panel.cm-search': {
      padding: '6px 8px',
      fontFamily: theme.font.sans,
      fontSize: theme.font.size.sm,
    },
    '.cm-panel.cm-search label': {
      fontSize: theme.font.size.xs,
      color: theme.colors.text.secondary,
    },
    '.cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search select': {
      backgroundColor: theme.colors.bg.primary,
      color: theme.colors.text.primary,
      border: `1px solid ${theme.colors.border.primary}`,
      borderRadius: theme.radius.sm,
      padding: '2px 6px',
    },
    '.cm-panel.cm-search input:focus': {
      outline: 'none',
      borderColor: theme.colors.border.focus,
    },
    '.cm-panel.cm-search button': {
      cursor: 'pointer',
    },
    '.cm-panel.cm-search button:hover': {
      backgroundColor: theme.colors.bg.hover,
    },
    '.cm-panel.cm-search .cm-button': {
      backgroundImage: 'none',
    },
    '.cm-panel.cm-search [name="close"]': {
      color: theme.colors.text.secondary,
      cursor: 'pointer',
    },
    '.cm-searchMatch': {
      backgroundColor: `${theme.colors.accent.mutation}44`,
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: `${theme.colors.accent.play}66`,
    },
  });
}
