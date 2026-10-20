import 'katex/dist/katex.min.css';
import './styles/app.css';
import { createEditor } from './editor.js';
import { renderMarkdown } from './preview.js';
import { createMockApi } from './mock-api.js';

// In a plain browser (Vite dev without Electron) fall back to in-memory data
// so the UI can be iterated on without the desktop shell.
const api = window.miaomiao ?? (import.meta.env.DEV ? createMockApi() : null);

const state = {
  settings: null,
  vault: null,
  notes: [],
  folders: [],
  activeFolder: '',
  activeNote: null,
  query: '',
  dirty: false,
  saving: false,
  previewing: false,
  saveTimer: null,
};

const el = {
  folderNav: document.getElementById('folder-nav'),
  noteList: document.getElementById('note-list'),
  notesTitle: document.getElementById('notes-title'),
  search: document.getElementById('search-input'),
  editorHost: document.getElementById('editor-host'),
  previewHost: document.getElementById('preview-host'),
  contentHeader: document.getElementById('content-header'),
  titleInput: document.getElementById('title-input'),
  contentDate: document.getElementById('content-date'),
  emptyState: document.getElementById('empty-state'),
  conflictBanner: document.getElementById('conflict-banner'),
  syncHint: document.getElementById('sync-hint'),
};

const editor = createEditor({
  parent: el.editorHost,
  onChange: onDocChange,
});

/* ---------------------------------------------------------------- helpers */

function toast(message, isError = false) {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const node = document.createElement('div');
  node.className = `toast${isError ? ' is-error' : ''}`;
  node.textContent = message;
  host.appendChild(node);
  setTimeout(() => node.remove(), 2400);
}

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;

  const date = new Date(ms);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function formatDate(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function stemOf(name) {
  return name.replace(/\.(md|markdown|mdown|txt)$/i, '');
}

function folderOf(path) {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

/* ---------------------------------------------------------------- modal */

function askInput({ title, value = '', placeholder = '', confirmLabel = '确定' }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h2 class="modal__title"></h2>
        <input class="modal__input" type="text" spellcheck="false" />
        <div class="modal__actions">
          <button class="modal__cancel" type="button">取消</button>
          <button class="modal__confirm" type="button"></button>
        </div>
      </div>
    `;

    const titleNode = backdrop.querySelector('.modal__title');
    const input = backdrop.querySelector('.modal__input');
    const confirm = backdrop.querySelector('.modal__confirm');

    titleNode.textContent = title;
    input.value = value;
    input.placeholder = placeholder;
    confirm.textContent = confirmLabel;

    const close = (result) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const submit = () => {
      const next = input.value.trim();
      if (!next) return;
      close(next);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') close(null);
      if (event.key === 'Enter') submit();
    };

    backdrop.querySelector('.modal__cancel').addEventListener('click', () => close(null));
    confirm.addEventListener('click', submit);
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) close(null);
    });
    document.addEventListener('keydown', onKey);

    document.body.appendChild(backdrop);
    input.focus();
    input.select();
  });
}

/* ---------------------------------------------------------------- render */

function collectFolders() {
  const set = new Set();
  for (const note of state.notes) {
    if (note.folder) set.add(note.folder);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function renderFolders() {
  state.folders = collectFolders();
  const items = [{ name: '全部笔记', path: '' }, ...state.folders.map((path) => ({ name: path, path }))];

  el.folderNav.replaceChildren();
  for (const item of items) {
    const count =
      item.path === ''
        ? state.notes.length
        : state.notes.filter((note) => note.folder === item.path || note.folder.startsWith(`${item.path}/`)).length;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `folder-item${state.activeFolder === item.path ? ' is-active' : ''}`;
    button.dataset.path = item.path;

    button.innerHTML = `
      <svg class="folder-item__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h5l2 2h9v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" />
      </svg>
      <span class="folder-item__name"></span>
      <span class="folder-item__count"></span>
    `;
    button.querySelector('.folder-item__name').textContent = item.name.split('/').pop();
    button.querySelector('.folder-item__count').textContent = String(count);
    button.addEventListener('click', () => {
      state.activeFolder = item.path;
      renderFolders();
      renderNotes();
    });
    el.folderNav.appendChild(button);
  }
}

function sortNotes(notes) {
  const mode = state.settings?.sortBy ?? 'mtime';
  const sorted = [...notes];
  if (mode === 'title') {
    sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-CN'));
  } else if (mode === 'ctime') {
    sorted.sort((a, b) => (b.ctime || 0) - (a.ctime || 0));
  } else {
    sorted.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  }
  return sorted;
}

function visibleNotes() {
  let notes = state.notes;
  if (state.activeFolder) {
    notes = notes.filter(
      (note) => note.folder === state.activeFolder || note.folder.startsWith(`${state.activeFolder}/`),
    );
  }
  if (state.query) {
    const lower = state.query.toLowerCase();
    notes = notes.filter(
      (note) =>
        note.title.toLowerCase().includes(lower) || note.snippet.toLowerCase().includes(lower),
    );
  }
  return sortNotes(notes);
}

function renderNotes() {
  const notes = visibleNotes();
  el.noteList.classList.toggle('hide-snippet', !state.settings?.showSnippet);
  el.noteList.replaceChildren();

  if (!notes.length) {
    const empty = document.createElement('li');
    empty.className = 'list-empty';
    empty.textContent = state.query ? '没有找到相关笔记' : '这里还没有笔记';
    el.noteList.appendChild(empty);
    return;
  }

  for (const note of notes) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `note-item${state.activeNote === note.path ? ' is-active' : ''}`;
    button.dataset.path = note.path;

    const title = document.createElement('div');
    title.className = 'note-item__title';
    if (state.activeNote === note.path && state.dirty) {
      const dot = document.createElement('span');
      dot.className = 'note-item__dot';
      title.appendChild(dot);
    }
    const titleText = document.createElement('span');
    titleText.textContent = note.title || stemOf(note.name);
    title.appendChild(titleText);

    const meta = document.createElement('div');
    meta.className = 'note-item__meta';
    const time = document.createElement('span');
    time.textContent = relativeTime(note.mtime);
    meta.appendChild(time);

    const snippet = document.createElement('div');
    snippet.className = 'note-item__snippet';
    snippet.textContent = note.snippet || '（空白笔记）';

    button.append(title, meta, snippet);
    button.addEventListener('click', () => openNote(note.path));
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      noteMenu(note.path);
    });
    li.appendChild(button);
    el.noteList.appendChild(li);
  }
}

/* ---------------------------------------------------------------- load */

async function refresh() {
  const result = await api.notes.list();
  if (!result.ok) {
    toast(result.error || '读取笔记失败', true);
    return;
  }
  state.notes = result.data;
  renderFolders();
  renderNotes();
}

async function openNote(path) {
  if (path === state.activeNote) return;
  await flushSave();

  const result = await api.notes.read(path);
  if (!result.ok) {
    toast(result.error || '打开失败', true);
    return;
  }

  state.activeNote = path;
  state.dirty = false;
  try {
    localStorage.setItem('miaomiao:last-note', path);
  } catch {
    /* storage may be unavailable, not fatal */
  }
  editor.reset(result.data.content);

  el.contentHeader.hidden = false;
  el.emptyState.hidden = true;
  el.titleInput.value = stemOf(path.split('/').pop());
  el.contentDate.textContent = `更新于 ${formatDate(result.data.mtime)}`;
  const wantPreview = Boolean(state?.settings?.defaultPreview);
  if (wantPreview) {
    el.previewHost.innerHTML = renderMarkdown(result.data.content);
    el.previewHost.hidden = false;
    el.editorHost.hidden = true;
    state.previewing = true;
    document.getElementById('btn-preview').classList.add('is-on');
  } else {
    el.previewHost.hidden = true;
    el.editorHost.hidden = false;
    state.previewing = false;
    document.getElementById('btn-preview').classList.remove('is-on');
  }
  el.emptyState.hidden = true;

  if (result.data.conflicts?.length) {
    showConflict(result.data.conflicts);
  } else {
    el.conflictBanner.hidden = true;
  }

  renderNotes();
  editor.focus();
}

/* ---------------------------------------------------------------- save */

function onDocChange() {
  if (el.previewHost.hidden === false) {
    el.previewHost.innerHTML = renderMarkdown(editor.getValue());
  }
  if (!state.activeNote) return;
  state.dirty = true;
  renderNotes();
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => save(), state.settings?.autoSaveDelay ?? 700);
}

async function save() {
  if (!state.activeNote || !state.dirty || state.saving) return;
  clearTimeout(state.saveTimer);
  state.saving = true;

  const target = state.activeNote;
  const content = editor.getValue();
  const result = await api.notes.write(target, content);

  state.saving = false;

  if (!result.ok) {
    toast(result.error || '保存失败', true);
    return;
  }

  state.dirty = false;
  const local = state.notes.find((note) => note.path === target);
  if (local) {
    local.mtime = Date.now();
    local.snippet = content
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .join(' ')
      .slice(0, 110);
  }
  renderNotes();

  if (result.data.conflicts?.length) {
    showConflict(result.data.conflicts);
  }
}

async function flushSave() {
  if (state.dirty) {
    clearTimeout(state.saveTimer);
    await save();
  }
}

function showConflict(names) {
  el.conflictBanner.querySelector('span').textContent = `检测到 iCloud 冲突副本：${names.join(
    '、',
  )}。内容不会自动合并，请手动处理。`;
  el.conflictBanner.hidden = false;
}

/* ---------------------------------------------------------------- actions */

async function createNote() {
  const folder = state.activeFolder;
  const name = await askInput({
    title: '新建笔记',
    placeholder: '给笔记起个名字',
    value: '',
    confirmLabel: '创建',
  });
  if (!name) return;

  const safe = name.replace(/[\\/:*?"<>|]/g, '').trim();
  if (!safe) return;

  const path = folder ? `${folder}/${safe}.md` : `${safe}.md`;
  const result = await api.notes.create(path, `# ${safe}\n\n`);
  if (!result.ok) {
    toast(result.error || '创建失败', true);
    return;
  }

  await refresh();
  await openNote(path);
}

async function renameActive() {
  if (!state.activeNote) return;
  const current = stemOf(state.activeNote.split('/').pop());
  const next = await askInput({ title: '重命名笔记', value: current, confirmLabel: '重命名' });
  if (!next || next === current) return;

  const safe = next.replace(/[\\/:*?"<>|]/g, '').trim();
  if (!safe) return;

  const folder = folderOf(state.activeNote);
  const target = folder ? `${folder}/${safe}.md` : `${safe}.md`;
  const result = await api.notes.rename(state.activeNote, target);
  if (!result.ok) {
    toast(result.error || '重命名失败', true);
    return;
  }

  state.activeNote = target;
  el.titleInput.value = safe;
  await refresh();
  renderNotes();
}

async function deleteNote(path = state.activeNote) {
  if (!path) return;
  const confirmed = await api.dialog.confirm({
    title: '删除笔记',
    message: `确定删除「${stemOf(path.split('/').pop())}」吗？`,
    detail: '笔记会被移到 .trash 目录，仍然可以手动找回。',
    confirmLabel: '删除',
  });
  if (!confirmed) return;

  const result = await api.notes.remove(path);
  if (!result.ok) {
    toast(result.error || '删除失败', true);
    return;
  }

  if (path === state.activeNote) {
    state.activeNote = null;
    state.dirty = false;
    editor.reset('');
    el.contentHeader.hidden = true;
    el.editorHost.hidden = true;
    el.emptyState.hidden = false;
  }
  await refresh();
}

/** Right-click menu on a note, rendered by the main process. */
async function noteMenu(path) {
  const result = await api.notes.menu(path);
  if (!result.ok || !result.data) return;

  if (result.data === 'rename') {
    await openNote(path);
    await renameActive();
  } else if (result.data === 'delete') {
    await deleteNote(path);
  }
}

function togglePreview() {
  state.previewing = !state.previewing;
  if (state.previewing) {
    el.previewHost.innerHTML = renderMarkdown(editor.getValue());
    el.previewHost.hidden = false;
    el.editorHost.hidden = true;
  } else {
    el.previewHost.hidden = true;
    el.editorHost.hidden = false;
    editor.focus();
  }
  document.getElementById('btn-preview').classList.toggle('is-on', state.previewing);
}


/* ---------------------------------------------------------------- settings */

/** Apply settings to the live document. Called on boot and after every change. */
function applySettings(next) {
  state.settings = next;
  document.documentElement.dataset.theme = next.theme === 'dark' ? 'dark' : 'cream';
  document.documentElement.style.setProperty('--editor-font-size', `${next.fontSize}px`);
  document.body.classList.toggle('reduce-motion', Boolean(next.reduceMotion));

  // 让列表立即反映排序与摘要设置，而不是等下次刷新
  if (el.noteList && state.notes.length) renderNotes();
}

function openSettings() {
  const original = { ...(state.settings || {}) };
  const draft = { ...original };

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="settings" role="dialog" aria-modal="true">
      <header class="settings__head">
        <h2 class="settings__title">设置</h2>
      </header>
      <div class="settings__body">
        <section class="settings__group">
          <p class="settings__group-title">外观</p>
          <div class="settings__row">
            <div class="settings__label">
              <strong>主题</strong>
              <span>决定界面的明暗样式</span>
            </div>
            <div class="segmented" data-key="theme">
              <button type="button" data-value="light">浅色</button>
              <button type="button" data-value="dark">深色</button>
            </div>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>编辑器字号</strong>
              <span class="js-size-label"></span>
            </div>
            <div class="segmented" data-key="fontSize">
              <button type="button" data-value="13">小</button>
              <button type="button" data-value="15">中</button>
              <button type="button" data-value="17">大</button>
            </div>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>减少动效</strong>
              <span>关闭猫咪漂浮等过渡动画</span>
            </div>
            <button class="switch" type="button" role="switch" data-key="reduceMotion"></button>
          </div>
        </section>

        <section class="settings__group">
          <p class="settings__group-title">列表</p>
          <div class="settings__row">
            <div class="settings__label">
              <strong>排序方式</strong>
              <span>决定笔记列表的排列顺序</span>
            </div>
            <div class="segmented" data-key="sortBy">
              <button type="button" data-value="mtime">修改</button>
              <button type="button" data-value="ctime">创建</button>
              <button type="button" data-value="title">标题</button>
            </div>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>显示摘要</strong>
              <span>在标题下方显示两行正文预览</span>
            </div>
            <button class="switch" type="button" role="switch" data-key="showSnippet"></button>
          </div>
        </section>

        <section class="settings__group">
          <p class="settings__group-title">编辑器</p>
          <div class="settings__row">
            <div class="settings__label">
              <strong>默认打开预览</strong>
              <span>打开笔记时直接显示渲染结果</span>
            </div>
            <button class="switch" type="button" role="switch" data-key="defaultPreview"></button>
          </div>
        </section>

        <section class="settings__group">
          <p class="settings__group-title">行为</p>
          <div class="settings__row">
            <div class="settings__label">
              <strong>关闭所有窗口后退出程序</strong>
              <span>macOS 默认会在后台保留进程</span>
            </div>
            <button class="switch" type="button" role="switch" data-key="quitOnAllWindowsClosed"></button>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>启动时恢复上次笔记</strong>
              <span>关闭后改为打开列表第一条</span>
            </div>
            <button class="switch" type="button" role="switch" data-key="restoreLastNote"></button>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>自动保存延迟</strong>
              <span class="js-delay-label"></span>
            </div>
            <div class="segmented" data-key="autoSaveDelay">
              <button type="button" data-value="300">快</button>
              <button type="button" data-value="700">标准</button>
              <button type="button" data-value="1500">慢</button>
            </div>
          </div>
        </section>
      </div>
      <footer class="settings__foot">
        <button class="link-button" type="button" id="settings-reset">恢复默认</button>
        <div class="settings__actions">
          <button class="modal__cancel" type="button" id="settings-cancel">取消</button>
          <button class="modal__confirm" type="button" id="settings-save">保存</button>
        </div>
      </footer>
    </div>`;

  const sizeLabel = backdrop.querySelector('.js-size-label');
  const delayLabel = backdrop.querySelector('.js-delay-label');

  const paint = () => {
    sizeLabel.textContent = `${draft.fontSize}px`;
    delayLabel.textContent = `${draft.autoSaveDelay}ms`;

    for (const group of backdrop.querySelectorAll('.segmented')) {
      const key = group.dataset.key;
      for (const button of group.querySelectorAll('button')) {
        const raw = button.dataset.value;
        const numeric = key === 'fontSize' || key === 'autoSaveDelay';
        const value = numeric ? Number(raw) : raw;
        button.classList.toggle('is-active', draft[key] === value);
      }
    }
    for (const toggle of backdrop.querySelectorAll('.switch')) {
      toggle.setAttribute('aria-checked', String(Boolean(draft[toggle.dataset.key])));
    }
  };

  const close = (applied) => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (!applied) applySettings(original);
  };

  const onKey = (event) => {
    if (event.key === 'Escape') close(false);
  };

  backdrop.addEventListener('click', (event) => {
    const segment = event.target.closest('.segmented button');
    if (segment) {
      const key = segment.parentElement.dataset.key;
      const raw = segment.dataset.value;
      const numeric = key === 'fontSize' || key === 'autoSaveDelay';
      draft[key] = numeric ? Number(raw) : raw;
      applySettings({ ...original, ...draft });
      paint();
      return;
    }

    const toggle = event.target.closest('.switch');
    if (toggle) {
      const key = toggle.dataset.key;
      draft[key] = !draft[key];
      paint();
    }
  });

  backdrop.querySelector('#settings-cancel').addEventListener('click', () => close(false));
  backdrop.querySelector('#settings-reset').addEventListener('click', async () => {
    const result = await api.settings.reset();
    if (result.ok) {
      Object.assign(draft, result.data);
      applySettings(result.data);
      paint();
      toast('已恢复默认设置');
    }
  });
  backdrop.querySelector('#settings-save').addEventListener('click', async () => {
    const result = await api.settings.set(draft);
    if (!result.ok) {
      toast(result.error || '保存设置失败', true);
      return;
    }
    applySettings(result.data);
    close(true);
    toast('设置已保存');
  });

  document.addEventListener('keydown', onKey);
  document.body.appendChild(backdrop);
  paint();
}

/* ---------------------------------------------------------------- events */

document.getElementById('btn-new-note').addEventListener('click', createNote);
document.getElementById('btn-empty-new').addEventListener('click', createNote);
document.getElementById('btn-preview').addEventListener('click', togglePreview);
document.getElementById('btn-more').addEventListener('click', () => {
  if (state.activeNote) noteMenu(state.activeNote);
});

document.getElementById('btn-settings').addEventListener('click', openSettings);
api.onOpenSettings(openSettings);
api.onSettingsChanged((next) => applySettings(next));
document.getElementById('btn-open-vault').addEventListener('click', () => api.vault.open());
document.getElementById('btn-conflict-dismiss').addEventListener('click', () => {
  el.conflictBanner.hidden = true;
});

el.search.addEventListener('input', () => {
  state.query = el.search.value.trim();
  renderNotes();
});

el.titleInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    el.titleInput.blur();
  }
});
el.titleInput.addEventListener('blur', renameActive);

window.addEventListener('keydown', (event) => {
  const meta = event.metaKey || event.ctrlKey;
  if (!meta) return;
  if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    save();
  } else if (event.key.toLowerCase() === 'e') {
    event.preventDefault();
    togglePreview();
  }
});

api.onMenuNewNote(createNote);

/* ---------------------------------------------------------------- boot */

async function boot() {
  const settingsResult = await api.settings.get();
  applySettings(
    settingsResult.ok
      ? settingsResult.data
      : { theme: 'light', fontSize: 15, autoSaveDelay: 700, restoreLastNote: true },
  );

  const info = await api.vault.info();
  if (info.ok) {
    state.vault = info.data;
    el.syncHint.textContent = info.data.available
      ? `iCloud 同步 · ${info.data.path.split('/').pop()}`
      : '未检测到 iCloud，使用本地目录';
    el.syncHint.title = info.data.path;
  }

  await refresh();

  if (state.notes.length) {
    let target = state.notes[0].path;
    if (state.settings.restoreLastNote) {
      try {
        const last = localStorage.getItem('miaomiao:last-note');
        if (last && state.notes.some((note) => note.path === last)) target = last;
      } catch {
        /* ignore */
      }
    }
    await openNote(target);
  } else {
    el.emptyState.hidden = false;
    el.contentHeader.hidden = true;
    el.editorHost.hidden = true;
  }
}

boot();
