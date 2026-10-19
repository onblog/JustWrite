import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import attrs from 'markdown-it-attrs';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';
import texmath from 'markdown-it-texmath';
import katex from 'katex';

import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import java from 'highlight.js/lib/languages/java';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';

import 'katex/dist/katex.min.css';

/**
 * Register only the languages we actually render. Importing the full
 * highlight.js bundle costs ~1MB and slows the first paint to a crawl.
 */
const LANGS = {
  javascript,
  typescript,
  java,
  python,
  go,
  bash,
  shell: bash,
  json,
  yaml,
  xml,
  html: xml,
  css,
  sql,
  markdown,
};

for (const [name, definition] of Object.entries(LANGS)) {
  hljs.registerLanguage(name, definition);
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code class="language-${lang}">${html}</code></pre>`;
      } catch {
        /* fall through to escaped output */
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`;
  },
});

md.use(anchor, {
  permalink: anchor.permalink.linkInsideHeader({ symbol: '#', placement: 'before' }),
});
md.use(attrs);
md.use(footnote);
md.use(taskLists, { enabled: true, label: true });
md.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { throwOnError: false, output: 'html' },
});

/** Render markdown to HTML. Raw HTML is disabled, so output is safe to inject. */
export function renderMarkdown(source) {
  return md.render(String(source || ''));
}
