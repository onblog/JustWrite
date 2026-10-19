import { basicSetup } from 'codemirror';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { indentWithTab } from '@codemirror/commands';

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--jw-editor-size, 15px)',
    color: 'var(--jw-fg)',
    backgroundColor: 'var(--jw-bg)',
  },
  '.cm-content': {
    fontFamily: 'var(--jw-mono)',
    lineHeight: '1.75',
    padding: '24px 0 40vh',
    caretColor: 'var(--jw-accent)',
  },
  '.cm-scroller': { overflow: 'auto' },
  '.cm-gutters': {
    backgroundColor: 'var(--jw-bg)',
    color: 'var(--jw-muted)',
    border: 'none',
    paddingLeft: '8px',
  },
  '.cm-activeLine': { backgroundColor: 'var(--jw-line-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--jw-accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--jw-selection) !important',
  },
  '.cm-line': { padding: '0 16px' },
});

const markdownFolding = [];

/**
 * Create the markdown editor.
 * @param {{ parent: HTMLElement, onDocChange?: (value: string) => void,
 *           onSelectionChange?: (info: { selected: string, from: number, to: number }) => void }} options
 */
export function createEditor({ parent, onDocChange, onSelectionChange }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        markdown({ base: markdownLanguage }),
        editorTheme,
        EditorView.lineWrapping,
        placeholder('开始写点什么…'),
        keymap.of([indentWithTab]),
        ...markdownFolding,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onDocChange?.(update.state.doc.toString());
          if (update.selectionSet || update.docChanged) {
            const range = update.state.selection.main;
            onSelectionChange?.({
              text: update.state.sliceDoc(range.from, range.to),
              from: range.from,
              to: range.to,
            });
          }
        }),
      ],
    }),
  });

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue(value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        selection: { anchor: 0 },
        scrollIntoView: true,
      });
    },
    getSelection() {
      const range = view.state.selection.main;
      return { text: view.state.sliceDoc(range.from, range.to), from: range.from, to: range.to };
    },
    replaceSelection(text) {
      const range = view.state.selection.main;
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: text },
        selection: { anchor: range.from + text.length },
        scrollIntoView: true,
      });
      view.focus();
    },
    insertAtCursor(text) {
      const range = view.state.selection.main;
      view.dispatch({
        changes: { from: range.to, insert: text },
        selection: { anchor: range.to + text.length },
        scrollIntoView: true,
      });
      view.focus();
    },
    focus: () => view.focus(),
  };
}
