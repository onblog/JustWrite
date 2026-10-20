import 'katex/dist/katex.min.css';
import './styles/app.css';
import { createEditor } from './editor.js';
import { renderMarkdown } from './preview.js';
import { createMockApi } from './mock-api.js';
import { t, setLanguage, getLanguage, applyI18n } from './i18n.js';

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
  currentMtime: 0,
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

  if (diff < minute) return t('time.justNow');
  if (diff < hour) return t('time.minutes', { n: Math.floor(diff / minute) });
  if (diff < day) return t('time.hours', { n: Math.floor(diff / hour) });
  if (diff < 7 * day) return t('time.days', { n: Math.floor(diff / day) });

  const date = new Date(ms);
  return t('time.date', { m: date.getMonth() + 1, d: date.getDate() });
}

function formatDate(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');

  if (getLanguage() === 'en') {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

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

function askInput({ title, value = '', placeholder = '', confirmLabel = t('dialog.confirm') }) {
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
  const items = [{ name: t('list.all'), path: '' }, ...state.folders.map((path) => ({ name: path, path }))];

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
      el.notesTitle.textContent = item.path ? item.path.split('/').pop() : t('list.all');
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
    empty.textContent = state.query ? t('list.noResults') : t('list.empty');
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
    snippet.textContent = note.snippet || t('list.blank');

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

function updateSyncHint() {
  if (!state.vault) return;
  const name = state.vault.path.split('/').pop();
  el.syncHint.textContent = state.vault.available
    ? t('sync.icloud', { name })
    : t('sync.local');
}

/* ---------------------------------------------------------------- load */

async function refresh() {
  const result = await api.notes.list();
  if (!result.ok) {
    toast(result.error || t('toast.loadFailed'), true);
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
    toast(result.error || t('toast.openFailed'), true);
    return;
  }

  state.activeNote = path;
  state.currentMtime = result.data.mtime;
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
  el.contentDate.textContent = t('note.updated', { time: formatDate(result.data.mtime) });
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
    toast(result.error || t('toast.saveFailed'), true);
    return;
  }

  state.dirty = false;
  state.currentMtime = Date.now();
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
  el.conflictBanner.querySelector('span').textContent = `${t('conflict.message')} ${names.join(
    ', ',
  )}`;
  el.conflictBanner.hidden = false;
}

/* ---------------------------------------------------------------- actions */

async function createNote() {
  const folder = state.activeFolder;
  const name = await askInput({
    title: t('dialog.newNote.title'),
    placeholder: t('dialog.newNote.placeholder'),
    value: '',
    confirmLabel: t('action.create'),
  });
  if (!name) return;

  const safe = name.replace(/[\\/:*?"<>|]/g, '').trim();
  if (!safe) return;

  const path = folder ? `${folder}/${safe}.md` : `${safe}.md`;
  const result = await api.notes.create(path, `# ${safe}\n\n`);
  if (!result.ok) {
    toast(result.error || t('toast.createFailed'), true);
    return;
  }

  await refresh();
  await openNote(path);
}

async function renameActive() {
  if (!state.activeNote) return;
  const current = stemOf(state.activeNote.split('/').pop());
  const next = await askInput({ title: t('dialog.rename.title'), value: current, confirmLabel: t('action.rename') });
  if (!next || next === current) return;

  const safe = next.replace(/[\\/:*?"<>|]/g, '').trim();
  if (!safe) return;

  const folder = folderOf(state.activeNote);
  const target = folder ? `${folder}/${safe}.md` : `${safe}.md`;
  const result = await api.notes.rename(state.activeNote, target);
  if (!result.ok) {
    toast(result.error || t('toast.renameFailed'), true);
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
    title: t('dialog.delete.title'),
    message: t('dialog.delete.message', { name: stemOf(path.split('/').pop()) }),
    detail: t('dialog.delete.detail'),
    confirmLabel: t('action.delete'),
  });
  if (!confirmed) return;

  const result = await api.notes.remove(path);
  if (!result.ok) {
    toast(result.error || t('toast.deleteFailed'), true);
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

  if (next.language) setLanguage(next.language);
  applyI18n();
  updateSyncHint();

  // 让列表与文件夹栏立即反映排序、摘要和语言设置
  if (el.noteList && state.notes.length) {
    renderFolders();
    renderNotes();
  }

  if (el.notesTitle) {
    el.notesTitle.textContent = state.activeFolder
      ? state.activeFolder.split('/').pop()
      : t('list.all');
  }

  if (state.activeNote && state.currentMtime) {
    el.contentDate.textContent = t('note.updated', { time: formatDate(state.currentMtime) });
  }
}

function openSettings() {
  const original = { ...(state.settings || {}) };
  const draft = { ...original };

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="settings" role="dialog" aria-modal="true">
      <header class="settings__head">
        <h2 class="settings__title">${t('settings.title')}</h2>
      </header>
      <div class="settings__body">
        <section class="settings__group">
          <p class="settings__group-title">${t('settings.appearance')}</p>
          <div class="settings__row">
            <div class="settings__label">
              <strong>${t('settings.theme')}</strong>
              <span>${t('settings.theme.desc')}</span>
            </div>
            <div class="segmented" data-key="theme">
              <button type="button" data-value="light">${t('settings.theme.light')}</button>
              <button type="button" data-value="dark">${t('settings.theme.dark')}</button>
            </div>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>${t('settings.fontSize')}</strong>
              <span class="js-size-label"></span>
            </div>
            <div class="segmented" data-key="fontSize">
              <button type="button" data-value="13">${t('settings.fontSize.small')}</button>
              <button type="button" data-value="15">${t('settings.fontSize.medium')}</button>
              <button type="button" data-value="17">${t('settings.fontSize.large')}</button>
            </div>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>${t('settings.reduceMotion')}</strong>
              <span>${t('settings.reduceMotion.desc')}</span>
            </div>
            <button class="switch" type="button" role="switch" data-key="reduceMotion"></button>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>${t('settings.language')}</strong>
              <span>${t('settings.language.desc')}</span>
            </div>
            <div class="segmented" data-key="language">
              <button type="button" data-value="zh">${t('settings.language.zh')}</button>
              <button type="button" data-value="en">${t('settings.language.en')}</button>
            </div>
          </div>
        </section>

        <section class="settings__group">
          <p class="settings__group-title">${t('settings.list')}</p>
          <div class="settings__row">
            <div class="settings__label">
              <strong>${t('settings.sortBy')}</strong>
              <span>${t('settings.sortBy.desc')}</span>
            </div>
            <div class="segmented" data-key="sortBy">
              <button type="button" data-value="mtime">${t('settings.sort.mtime')}</button>
              <button type="button" data-value="ctime">${t('settings.sort.ctime')}</button>
              <button type="button" data-value="title">${t('settings.sort.title')}</button>
            </div>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>${t('settings.showSnippet')}</strong>
              <span>${t('settings.showSnippet.desc')}</span>
            </div>
            <button class="switch" type="button" role="switch" data-key="showSnippet"></button>
          </div>
        </section>

        <section class="settings__group">
          <p class="settings__group-title">${t('settings.editor')}</p>
          <div class="settings__row">
            <div class="settings__label">
              <strong>${t('settings.defaultPreview')}</strong>
              <span>${t('settings.defaultPreview.desc')}</span>
            </div>
            <button class="switch" type="button" role="switch" data-key="defaultPreview"></button>
          </div>
        </section>

        <section class="settings__group">
          <p class="settings__group-title">${t('settings.behavior')}</p>
          <div class="settings__row">
            <div class="settings__label">
              <strong>${t('settings.quit')}</strong>
              <span>${t('settings.quit.desc')}</span>
            </div>
            <button class="switch" type="button" role="switch" data-key="quitOnAllWindowsClosed"></button>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>${t('settings.restore')}</strong>
              <span>${t('settings.restore.desc')}</span>
            </div>
            <button class="switch" type="button" role="switch" data-key="restoreLastNote"></button>
          </div>
          <div class="settings__row">
            <div class="settings__label">
              <strong>${t('settings.autoSave')}</strong>
              <span class="js-delay-label"></span>
            </div>
            <div class="segmented" data-key="autoSaveDelay">
              <button type="button" data-value="300">${t('settings.autoSave.fast')}</button>
              <button type="button" data-value="700">${t('settings.autoSave.normal')}</button>
              <button type="button" data-value="1500">${t('settings.autoSave.slow')}</button>
            </div>
          </div>
        </section>
      </div>
      <footer class="settings__foot">
        <button class="link-button" type="button" id="settings-reset">${t('settings.reset')}</button>
        <div class="settings__actions">
          <button class="modal__cancel" type="button" id="settings-cancel">${t('settings.cancel')}</button>
          <button class="modal__confirm" type="button" id="settings-save">${t('settings.save')}</button>
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
    updateSyncHint();
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
