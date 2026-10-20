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
  breaks: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const html = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        return `<pre class="hljs"><code class="language-${lang}">${html}</code></pre>`;
      } catch {
        /* fall through */
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(code)}</code></pre>`;
  },
});

md.use(anchor, { permalink: false });
md.use(attrs);
md.use(footnote);
md.use(taskLists, { enabled: true, label: true });
md.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { throwOnError: false, output: 'html' },
});

/**
 * Render markdown to HTML. Raw HTML is disabled, so output is safe to inject.
 * `baseDir` (absolute) rewrites relative image paths to file:// URLs so pasted
 * screenshots render inside the preview.
 */
export function renderMarkdown(source, baseDir) {
  const html = md.render(String(source || ''));
  if (!baseDir) return html;

  const root = baseDir.replace(/\/+$/, '');
  return html.replace(/<img\s+([^>]*?)src="([^"]+)"/g, (match, attrs, src) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) return match;
    // markdown-it already URL-encodes the link target; encoding again would
    // turn %E4%BB%A3 into %25E4%25BB and break the file:// lookup.
    return `<img ${attrs}src="file://${encodeURI(root)}/${src}"`;
  });
}
