import { EditorView, keymap, placeholder, drawSelection, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
  indentOnInput,
} from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { tags } from '@lezer/highlight';

/**
 * 暖色语法高亮。CodeMirror 默认的蓝色语法色和奶油底色冲突，
 * 所以这里整套替换掉，保持「纸感」的统一。
 */
const warmHighlight = HighlightStyle.define([
  { tag: tags.heading1, color: '#3b3530', fontWeight: '700', fontSize: '1.32em' },
  { tag: tags.heading2, color: '#3b3530', fontWeight: '700', fontSize: '1.18em' },
  { tag: tags.heading3, color: '#4a433c', fontWeight: '650', fontSize: '1.08em' },
  { tag: tags.strong, color: '#3b3530', fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#5b524b' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#b3a89f' },
  { tag: tags.link, color: '#e76f51' },
  { tag: tags.url, color: '#b3a89f' },
  { tag: tags.monospace, color: '#c2603f', fontFamily: 'var(--font-mono)' },
  { tag: tags.quote, color: '#8b8079', fontStyle: 'italic' },
  { tag: tags.list, color: '#f08a5d' },
  { tag: tags.processingInstruction, color: '#f0a882' },
  { tag: tags.contentSeparator, color: '#e5d5c5' },
  { tag: tags.comment, color: '#b3a89f' },
]);

function extensionsFor(onChange) {
  return [
    history(),
    drawSelection(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    bracketMatching(),
    closeBrackets(),
    indentOnInput(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(warmHighlight),
    placeholder('写点什么吧，喵～'),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...closeBracketsKeymap,
      ...searchKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange?.(update.state.doc.toString());
    }),
  ];
}

export function createEditor({ parent, onChange }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc: '', extensions: extensionsFor(onChange) }),
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
    /** Reset the document without emitting a change event when loading a note. */
    reset(value) {
      view.setState(EditorState.create({ doc: value, extensions: extensionsFor(onChange) }));
    },
    focus: () => view.focus(),
    insertAtCursor(text) {
      const range = view.state.selection.main;
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: text },
        selection: { anchor: range.from + text.length },
        scrollIntoView: true,
      });
      view.focus();
    },
  };
}
