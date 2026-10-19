import './style.css';
import { api } from './api.js';
import { createEditor } from './editor.js';
import { renderMarkdown } from './preview.js';

const state = {
  config: null,
  actions: [],
  tree: [],
  currentPath: null,
  dirty: false,
  saving: false,
  mode: 'split',
  pane: 'preview',
  selection: { text: '', from: 0, to: 0 },
  aiOutput: '',
  aiBusy: false,
  searchTimer: null,
  saveTimer: null,
};

const app = document.getElementById('app');
app.innerHTML = `
  <div class="jw-app">
  <header class="jw-topbar">
    <div class="jw-brand"><span class="jw-brand-dot"></span>JustWrite</div>
    <div class="jw-filename" id="filename">未打开文档</div>
    <div class="jw-status" id="status"><span class="jw-status-dot"></span><span id="status-text">就绪</span></div>
    <button class="jw-btn" id="btn-settings" title="AI 设置">⚙ 设置</button>
  </header>

  <div class="jw-toolbar">
    <div class="jw-seg" id="mode-seg">
      <button data-mode="edit">编辑</button>
      <button data-mode="split" class="is-active">分屏</button>
      <button data-mode="preview">预览</button>
    </div>
    <button class="jw-btn" id="btn-new">＋ 新建文档</button>
    <button class="jw-btn" id="btn-save">保存</button>
    <div class="jw-spacer"></div>
    <span class="jw-status" id="word-count">0 字</span>
  </div>

  <div class="jw-main" id="main">
    <aside class="jw-sidebar">
      <div class="jw-sidebar-head">
        <input class="jw-search" id="search" placeholder="搜索文档…" autocomplete="off" />
        <button class="jw-btn" id="btn-new-dir" title="新建文件夹">＋</button>
      </div>
      <div class="jw-tree" id="tree"><div class="jw-tree-empty">正在加载…</div></div>
    </aside>

    <section class="jw-editor-pane">
      <div class="jw-editor-host" id="editor-host"></div>
    </section>

    <section class="jw-right-pane">
      <div class="jw-right-tabs">
        <button class="jw-tab is-active" data-pane="preview">预览</button>
        <button class="jw-tab" data-pane="ai">AI 助手</button>
      </div>
      <div class="jw-pane" id="pane-preview"><div class="jw-preview" id="preview"></div></div>
      <div class="jw-pane" id="pane-ai" hidden>
        <div class="jw-ai">
          <div class="jw-ai-head"><span id="ai-selection-info">未选中文本</span></div>
          <div class="jw-ai-actions" id="ai-actions"></div>
          <div class="jw-ai-output is-empty" id="ai-output">选中一段文字，然后点上面的动作按钮。</div>
          <div class="jw-ai-foot">
            <button class="jw-btn is-primary" id="ai-replace" disabled>替换选中</button>
            <button class="jw-btn" id="ai-insert" disabled>插入到光标</button>
            <button class="jw-btn" id="ai-copy" disabled>复制</button>
          </div>
        </div>
      </div>
    </section>
  </div>

  <footer class="jw-statusbar">
    <span id="stat-path">—</span>
    <span id="stat-vault"></span>
    <span id="stat-mode"></span>
  </footer>
  </div>
`;

const els = {
  filename: document.getElementById('filename'),
  status: document.getElementById('status'),
  statusText: document.getElementById('status-text'),
  main: document.getElementById('main'),
  tree: document.getElementById('tree'),
  search: document.getElementById('search'),
  editorHost: document.getElementById('editor-host'),
  preview: document.getElementById('preview'),
  panePreview: document.getElementById('pane-preview'),
  paneAi: document.getElementById('pane-ai'),
  aiActions: document.getElementById('ai-actions'),
  aiOutput: document.getElementById('ai-output'),
  aiSelection: document.getElementById('ai-selection-info'),
  aiReplace: document.getElementById('ai-replace'),
  aiInsert: document.getElementById('ai-insert'),
  aiCopy: document.getElementById('ai-copy'),
  wordCount: document.getElementById('word-count'),
  statPath: document.getElementById('stat-path'),
  statVault: document.getElementById('stat-vault'),
  statMode: document.getElementById('stat-mode'),
};

const editor = createEditor({
  parent: els.editorHost,
  onDocChange: () => {
    scheduleSave();
    renderPreview();
    updateWordCount();
  },
  onSelectionChange: (info) => {
    state.selection = info;
    updateSelectionInfo();
  },
});

/* ---------------------------------------------------------------- helpers */

function toast(message, isError = false) {
  let host = document.querySelector('.jw-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'jw-toast-host';
    document.body.appendChild(host);
  }
  const node = document.createElement('div');
  node.className = `jw-toast${isError ? ' is-error' : ''}`;
  node.textContent = message;
  host.appendChild(node);
  setTimeout(() => node.remove(), 2600);
}

function setStatus(text, kind = '') {
  els.statusText.textContent = text;
  els.status.className = `jw-status${kind ? ` is-${kind}` : ''}`;
}

function updateWordCount() {
  const value = editor.getValue();
  const chars = value.replace(/\s/g, '').length;
  els.wordCount.textContent = `${chars} 字`;
}

function updateSelectionInfo() {
  const count = state.selection?.text?.length ?? 0;
  els.aiSelection.textContent = count ? `已选中 ${count} 字` : '未选中文本';
  const usable = count > 0 && !state.aiBusy;
  for (const chip of els.aiActions.querySelectorAll('.jw-chip')) chip.disabled = !usable;
}

function renderPreview() {
  els.preview.innerHTML = renderMarkdown(editor.getValue());
}

/* ---------------------------------------------------------------- saving  */

function markDirty() {
  state.dirty = true;
  setStatus('未保存', 'dirty');
}

function scheduleSave() {
  markDirty();
  clearTimeout(state.saveTimer);
  const delay = state.config?.editor?.autoSaveDelay ?? 800;
  state.saveTimer = setTimeout(() => save(), delay);
}

async function save() {
  if (!state.currentPath || !state.dirty || state.saving) return;
  clearTimeout(state.saveTimer);
  state.saving = true;
  setStatus('保存中…', 'saving');
  const snapshot = editor.getValue();
  try {
    await api.write(state.currentPath, snapshot);
    if (editor.getValue() === snapshot) {
      state.dirty = false;
      setStatus('已保存');
    } else {
      scheduleSave();
    }
  } catch (error) {
    setStatus('保存失败', 'error');
    toast(error.message, true);
  } finally {
    state.saving = false;
  }
}

/** Save pending changes before switching documents. */
async function flush() {
  if (state.dirty) {
    clearTimeout(state.saveTimer);
    await save();
  }
}

/* ---------------------------------------------------------------- tree    */

function renderTree(nodes) {
  if (!nodes.length) {
    els.tree.innerHTML = '<div class="jw-tree-empty">还没有文档。<br />点上方「＋」新建，或把 .md 文件放进 vault 目录。</div>';
    return;
  }

  const build = (items) => {
    const ul = document.createElement('div');
    for (const item of items) {
      const node = document.createElement('div');
      node.className = `jw-node${item.type === 'dir' ? ' is-dir' : ''}${
        item.path === state.currentPath ? ' is-active' : ''
      }`;
      node.dataset.path = item.path;
      node.dataset.type = item.type;

      const icon = document.createElement('span');
      icon.className = 'jw-node-icon';
      icon.textContent = item.type === 'dir' ? '▾' : '·';

      const name = document.createElement('span');
      name.className = 'jw-node-name';
      name.textContent = item.type === 'file' ? item.name.replace(/\.(md|markdown|txt)$/i, '') : item.name;

      node.append(icon, name);
      ul.appendChild(node);

      if (item.type === 'dir' && item.children?.length) {
        const children = build(item.children);
        children.className = 'jw-children';
        if (item.collapsed) children.classList.add('is-collapsed');
        ul.appendChild(children);
      }
    }
    return ul;
  };

  els.tree.replaceChildren(build(nodes));
}

async function loadTree() {
  try {
    const data = await api.tree();
    state.tree = data.nodes;
    els.statVault.textContent = `vault: ${data.vault}`;
    renderTree(data.nodes);
  } catch (error) {
    els.tree.innerHTML = `<div class="jw-tree-empty">读取目录失败：${error.message}</div>`;
  }
}

/* ---------------------------------------------------------------- open    */

async function openFile(path) {
  if (path === state.currentPath) return;
  await flush();
  try {
    const file = await api.read(path);
    state.currentPath = path;
    editor.setValue(file.content);
    state.dirty = false;
    setStatus('已保存');
    els.filename.innerHTML = `<strong>${path.split('/').pop().replace(/\.(md|markdown|txt)$/i, '')}</strong> · ${path}`;
    els.statPath.textContent = path;
    renderPreview();
    updateWordCount();
    highlightActive(path);
    editor.focus();
  } catch (error) {
    toast(`打开失败：${error.message}`, true);
  }
}

function highlightActive(path) {
  for (const node of els.tree.querySelectorAll('.jw-node')) {
    node.classList.toggle('is-active', node.dataset.path === path);
  }
}

/* ---------------------------------------------------------------- actions */

els.tree.addEventListener('click', (event) => {
  const node = event.target.closest('.jw-node');
  if (!node) return;
  const { path, type } = node.dataset;
  if (type === 'dir') {
    const children = node.nextElementSibling;
    if (children?.classList.contains('jw-children')) {
      children.classList.toggle('is-collapsed');
      node.querySelector('.jw-node-icon').textContent = children.classList.contains('is-collapsed') ? '▸' : '▾';
    }
    return;
  }
  openFile(path);
});

els.tree.addEventListener('contextmenu', async (event) => {
  const node = event.target.closest('.jw-node');
  if (!node || node.dataset.type !== 'file') return;
  event.preventDefault();
  const path = node.dataset.path;

  const action = window.prompt('输入操作：rename（重命名） / delete（删除）', 'rename');
  if (!action) return;

  if (action === 'delete') {
    if (!window.confirm(`确认删除 ${path}？文件会移到 .trash 目录。`)) return;
    await api.remove(path);
    if (state.currentPath === path) {
      state.currentPath = null;
      els.filename.textContent = '未打开文档';
      editor.setValue('');
    }
    toast('已移入 .trash');
    loadTree();
  } else if (action === 'rename') {
    const next = window.prompt('新文件名（可含子目录）', path);
    if (!next || next === path) return;
    await api.rename(path, next);
    if (state.currentPath === path) state.currentPath = next;
    toast('已重命名');
    loadTree();
  }
});

document.getElementById('btn-new').addEventListener('click', async () => {
  const name = window.prompt('新文档名称（可含子目录，如 notes/idea.md）', '未命名.md');
  if (!name) return;
  const path = name.includes('.') ? name : `${name}.md`;
  try {
    await api.create(path, `# ${path.split('/').pop().replace(/\.md$/, '')}\n\n`);
    await loadTree();
    await openFile(path);
    toast('已创建');
  } catch (error) {
    toast(error.message, true);
  }
});

document.getElementById('btn-new-dir').addEventListener('click', async () => {
  const name = window.prompt('新文件夹路径', 'notes');
  if (!name) return;
  try {
    await api.mkdir(name);
    await loadTree();
    toast('已创建文件夹');
  } catch (error) {
    toast(error.message, true);
  }
});

document.getElementById('btn-save').addEventListener('click', () => save());

for (const button of document.querySelectorAll('#mode-seg button')) {
  button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    for (const peer of document.querySelectorAll('#mode-seg button')) {
      peer.classList.toggle('is-active', peer === button);
    }
    els.main.className = `jw-main is-${state.mode}-only`;
    els.main.classList.toggle('is-edit-only', state.mode === 'edit');
    els.main.classList.toggle('is-preview-only', state.mode === 'preview');
    els.statMode.textContent = `模式: ${state.mode}`;
  });
}

for (const tab of document.querySelectorAll('.jw-tab')) {
  tab.addEventListener('click', () => {
    state.pane = tab.dataset.pane;
    for (const peer of document.querySelectorAll('.jw-tab')) {
      peer.classList.toggle('is-active', peer === tab);
    }
    els.panePreview.hidden = state.pane !== 'preview';
    els.paneAi.hidden = state.pane !== 'ai';
    if (state.pane === 'ai' && state.mode === 'edit') {
      document.querySelector('#mode-seg button[data-mode="split"]').click();
    }
  });
}

els.search.addEventListener('input', () => {
  clearTimeout(state.searchTimer);
  const query = els.search.value.trim();
  if (!query) {
    renderTree(state.tree);
    return;
  }
  state.searchTimer = setTimeout(async () => {
    try {
      const { results } = await api.search(query);
      if (!results.length) {
        els.tree.innerHTML = '<div class="jw-tree-empty">没有匹配结果</div>';
        return;
      }
      const wrapper = document.createElement('div');
      for (const hit of results) {
        const node = document.createElement('div');
        node.className = 'jw-node';
        node.dataset.path = hit.path;
        node.dataset.type = 'file';
        node.innerHTML = '';
        const icon = document.createElement('span');
        icon.className = 'jw-node-icon';
        icon.textContent = '·';
        const name = document.createElement('span');
        name.className = 'jw-node-name';
        name.textContent = `${hit.path}:${hit.line}`;
        node.append(icon, name);
        node.title = hit.text;
        wrapper.appendChild(node);
      }
      els.tree.replaceChildren(wrapper);
      els.tree.dataset.searchMode = '1';
    } catch (error) {
      toast(error.message, true);
    }
  }, 260);
});

els.tree.addEventListener('click', (event) => {
  if (els.tree.dataset.searchMode !== '1') return;
  const node = event.target.closest('.jw-node');
  if (!node) return;
  els.search.value = '';
  delete els.tree.dataset.searchMode;
  renderTree(state.tree);
  openFile(node.dataset.path);
});

/* ---------------------------------------------------------------- AI      */

function renderAiOutput() {
  els.aiOutput.classList.toggle('is-empty', !state.aiOutput);
  els.aiOutput.textContent = state.aiOutput || '选中一段文字，然后点上面的动作按钮。';
  const ready = Boolean(state.aiOutput);
  els.aiReplace.disabled = !ready;
  els.aiInsert.disabled = !ready;
  els.aiCopy.disabled = !ready;
}

async function runAction(actionId) {
  const selected = editor.getSelection().text;
  if (!selected.trim()) {
    toast('请先在编辑器里选中一段文字');
    return;
  }
  state.aiBusy = true;
  state.aiOutput = '';
  renderAiOutput();
  setStatus('AI 生成中…', 'saving');
  updateSelectionInfo();

  try {
    await api.streamAi({
      action: actionId,
      text: selected,
      onDelta: (delta) => {
        state.aiOutput += delta;
        renderAiOutput();
        els.aiOutput.scrollTop = els.aiOutput.scrollHeight;
      },
    });
    setStatus('AI 完成');
  } catch (error) {
    setStatus('AI 失败', 'error');
    toast(`AI 失败：${error.message}`, true);
  } finally {
    state.aiBusy = false;
    updateSelectionInfo();
  }
}

async function loadAiPresets() {
  try {
    const actions = await api.actions();
    state.actions = actions;
    els.aiActions.replaceChildren();
    for (const action of actions) {
      const chip = document.createElement('button');
      chip.className = 'jw-chip';
      chip.textContent = action.label;
      chip.disabled = true;
      chip.addEventListener('click', () => runAction(action.id));
      els.aiActions.appendChild(chip);
    }
    updateSelectionInfo();
  } catch (error) {
    toast(`加载 AI 动作失败：${error.message}`, true);
  }
}

els.aiReplace.addEventListener('click', () => {
  if (!state.aiOutput) return;
  editor.replaceSelection(state.aiOutput);
  toast('已替换选中内容');
});

els.aiInsert.addEventListener('click', () => {
  if (!state.aiOutput) return;
  editor.insertAtCursor(`\n${state.aiOutput}\n`);
  toast('已插入');
});

els.aiCopy.addEventListener('click', async () => {
  if (!state.aiOutput) return;
  await navigator.clipboard.writeText(state.aiOutput);
  toast('已复制');
});

/* ---------------------------------------------------------------- settings */

function openSettings() {
  const config = state.config;
  const backdrop = document.createElement('div');
  backdrop.className = 'jw-modal-backdrop';
  backdrop.innerHTML = `
    <div class="jw-modal">
      <h3>AI 配置</h3>
      <label class="jw-field">接口地址（OpenAI 兼容）
        <input id="cfg-base" value="${config.ai.baseUrl}" />
      </label>
      <label class="jw-field">API Key ${config.ai.hasApiKey ? `（已保存 ${config.ai.apiKeyHint}，留空则不修改）` : ''}
        <input id="cfg-key" type="password" placeholder="sk-…" autocomplete="off" />
      </label>
      <label class="jw-field">模型
        <input id="cfg-model" value="${config.ai.model}" />
      </label>
      <div class="jw-modal-foot">
        <button class="jw-btn" id="cfg-cancel">取消</button>
        <button class="jw-btn is-primary" id="cfg-save">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector('#cfg-cancel').addEventListener('click', close);
  backdrop.querySelector('#cfg-save').addEventListener('click', async () => {
    const patch = {
      ai: {
        baseUrl: backdrop.querySelector('#cfg-base').value.trim(),
        model: backdrop.querySelector('#cfg-model').value.trim(),
      },
    };
    const key = backdrop.querySelector('#cfg-key').value.trim();
    if (key) patch.ai.apiKey = key;
    try {
      state.config = { ...state.config, ...(await api.saveConfig(patch)) };
      toast('配置已保存');
      close();
    } catch (error) {
      toast(error.message, true);
    }
  });
}

document.getElementById('btn-settings').addEventListener('click', openSettings);

/* ---------------------------------------------------------------- shortcuts */

window.addEventListener('keydown', (event) => {
  const meta = event.metaKey || event.ctrlKey;
  if (!meta) return;
  if (event.key === 's') {
    event.preventDefault();
    save();
  } else if (event.key === 'p') {
    event.preventDefault();
    els.search.focus();
    els.search.select();
  }
});

window.addEventListener('beforeunload', (event) => {
  if (state.dirty) {
    event.preventDefault();
    event.returnValue = '';
  }
});

/* ---------------------------------------------------------------- boot    */

async function boot() {
  try {
    state.config = await api.config();
    document.documentElement.style.setProperty(
      '--jw-editor-size',
      `${state.config.editor?.fontSize ?? 15}px`,
    );
  } catch (error) {
    toast(`读取配置失败：${error.message}`, true);
  }

  await loadAiPresets();
  await loadTree();
  renderAiOutput();
  setStatus('就绪');
  els.statMode.textContent = '模式: split';

  const first = findFirstFile(state.tree);
  if (first) await openFile(first);
}

function findFirstFile(nodes) {
  for (const node of nodes) {
    if (node.type === 'file') return node.path;
    if (node.type === 'dir' && node.children?.length) {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

boot();
