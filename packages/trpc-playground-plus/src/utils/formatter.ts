import { EditorSelection } from '@codemirror/state';
import { type EditorView, keymap } from '@codemirror/view';
import { js_beautify } from 'js-beautify';

export function formatDocument(view: EditorView): void {
  const code = view.state.doc.toString();
  const cursorPos = view.state.selection.main.head;

  const formatted = js_beautify(code, {
    indent_size: 2,
    indent_char: ' ',
    max_preserve_newlines: 2,
    preserve_newlines: true,
    end_with_newline: true,
    wrap_line_length: 80,
    e4x: true,
  });

  if (formatted !== code) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: formatted },
      selection: EditorSelection.create([EditorSelection.cursor(Math.min(cursorPos, formatted.length))]),
    });
  }
}

export const formatKeymap = keymap.of([
  {
    key: 'Shift-Alt-f',
    run: (view) => {
      formatDocument(view);
      return true;
    },
  },
]);
