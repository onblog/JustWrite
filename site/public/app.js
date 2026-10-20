import {
  downloadFile,
  saveBlob,
  pickDestination,
  canStreamToDisk,
  formatBytes,
} from '/download.js';

/**
 * 喵喵笔记官网前端：语言切换 + 版本信息。
 * 零依赖、零第三方请求，所有逻辑都在这个文件里。
 */

const messages = {
  zh: {
    'meta.title': '喵喵笔记 · 本地优先的 Markdown 笔记应用',
    brand: '喵喵笔记',
    'nav.stats': '数据',
    'hero.title': '喵喵笔记',
    'hero.tagline': '一只喵喵的本地 Markdown 笔记应用',
    'hero.desc': '笔记就是 iCloud Drive 里的普通 .md 文件，多台 Mac 自动同步。完全免费，不需要登录。',
    'download.arm64': '下载 Apple Silicon 版',
    'download.x64': '下载 Intel 版',
    'download.hint': 'macOS 12 及以上 · 首次打开请右键点击应用选择「打开」，之后即可正常双击启动',
    'download.latest': '最新版本',
    'download.direct': '直接下载',
    'download.preparing': '准备中…',
    'download.progress': '正在下载',
    'download.done': '下载完成',
    'download.failed': '下载失败，请改用直链',
    'download.cancel': '取消',
    'download.retry': '重试',
    'feature.layout.title': '三栏布局',
    'feature.layout.desc': '文件夹、笔记、内容三列，参考 macOS 备忘录的交互，切换笔记不丢光标位置。',
    'feature.files.title': '笔记就是文件',
    'feature.files.desc': '每条笔记都是普通 Markdown 文件，随时可以用别的编辑器打开、grep、丢进 Git。',
    'feature.icloud.title': 'iCloud 同步',
    'feature.icloud.desc': '不接第三方同步服务，直接把笔记库放在 iCloud Drive，多台 Mac 由系统自动同步。',
    'privacy.title': '关于隐私',
    'privacy.p1': '应用很干净：只发送一条匿名启动信号（随机设备 ID），可在设置里随时关闭。',
    'privacy.p2': '这个官网没有第三方统计、没有广告、没有 Cookie。',
    'privacy.p3': '不记录 IP、不采集设备指纹，代码全部开源，可以自己审计。',
    'footer.license': 'AGPL-3.0 · 商业授权',
    'footer.made': '为 macOS 而做',
  },
  en: {
    'meta.title': 'Miaomiao Notes · A local-first Markdown notes app for macOS',
    brand: 'Miaomiao Notes',
    'nav.stats': 'Stats',
    'hero.title': 'Miaomiao Notes',
    'hero.tagline': 'A local-first Markdown notes app for macOS',
    'hero.desc':
      'Your notes are plain .md files inside iCloud Drive, synced across your Macs by the system. Completely free, no sign-up needed.',
    'download.arm64': 'Download for Apple Silicon',
    'download.x64': 'Download for Intel',
    'download.hint':
      'macOS 12 or later · first launch: right-click the app and choose Open',
    'download.latest': 'Latest',
    'download.direct': 'Direct download',
    'download.preparing': 'Preparing…',
    'download.progress': 'Downloading',
    'download.done': 'Download complete',
    'download.failed': 'Download failed, try the direct link',
    'download.cancel': 'Cancel',
    'download.retry': 'Retry',
    'feature.layout.title': 'Three columns',
    'feature.layout.desc':
      'Folders, notes and content — modelled on Apple Notes, and switching notes keeps your place.',
    'feature.files.title': 'Notes are files',
    'feature.files.desc':
      'Every note is a plain Markdown file you can open, grep or commit with any tool you like.',
    'feature.icloud.title': 'iCloud sync',
    'feature.icloud.desc':
      'No third-party sync service. The vault lives in iCloud Drive and macOS keeps your Macs in sync.',
    'privacy.title': 'Privacy',
    'privacy.p1': 'The app stays clean: one anonymous launch signal (random device id), off-switch in Settings.',
    'privacy.p2': 'This site has no third-party analytics, no ads and no cookies.',
    'privacy.p3': 'No IP logging, no fingerprinting, and the source is open for review.',
    'footer.license': 'AGPL-3.0 · Commercial',
    'footer.made': 'Made for macOS',
  },
};

const STORAGE_KEY = 'miaomiao-site:lang';
let currentLang = 'zh';
let lastRelease = null;

function applyLanguage(lang) {
  currentLang = messages[lang] ? lang : 'zh';
  const dict = messages[currentLang];

  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  document.title = dict['meta.title'];

  for (const node of document.querySelectorAll('[data-i18n]')) {
    const key = node.dataset.i18n;
    const text = dict[key];
    if (text) node.textContent = text;
  }

  const label = document.getElementById('lang-label');
  if (label) label.textContent = currentLang === 'zh' ? 'EN' : '中文';

  renderRelease();

  try {
    localStorage.setItem(STORAGE_KEY, currentLang);
  } catch {
    /* storage can be blocked; not fatal */
  }
}

function formatSize(bytes) {
  if (!bytes || bytes < 1024) return '';
  const mb = bytes / (1024 * 1024);
  return `${currentLang === 'zh' ? '约 ' : '~'}${mb.toFixed(0)} MB`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

/** Re-render the version line and file sizes for the active language. */
function renderRelease() {
  const line = document.getElementById('version-line');
  if (!lastRelease) {
    if (line) {
      line.textContent = currentLang === 'zh' ? '安装包准备中' : 'Packages coming soon';
    }
    return;
  }

  for (const [arch, file] of Object.entries(lastRelease.files || {})) {
    const size = document.querySelector(`[data-size="${arch}"]`);
    if (size) size.textContent = formatSize(file.size);
    const link = document.querySelector(`[data-arch="${arch}"]`);
    if (link) link.href = file.url;
  }

  if (line) {
    const when = formatDate(lastRelease.released_at);
    const label = messages[currentLang]['download.latest'];
    line.textContent = `${label} v${lastRelease.version}${when ? ` · ${when}` : ''}`;
  }
}

async function loadRelease() {
  const line = document.getElementById('version-line');

  try {
    const response = await fetch('/api/release', { headers: { Accept: 'application/json' } });
    const payload = await response.json();

    if (!payload.ok || !payload.data) {
      lastRelease = null;
      renderRelease();
      return;
    }

    lastRelease = payload.data;
    renderRelease();
  } catch {
    lastRelease = null;
    if (line) line.textContent = '';
  }
}

/* ---------------------------------------------------------------- download */

let downloadController = null;
let retryArch = null;

function dlEl(id) {
  return document.getElementById(id);
}

function closeDownloadPanel() {
  const backdrop = dlEl('dl-backdrop');
  if (backdrop) backdrop.hidden = true;
  downloadController = null;
}

function paintProgress(loaded, total, startedAt) {
  const percent = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const fill = dlEl('dl-fill');
  if (fill) fill.style.width = `${percent}%`;

  dlEl('dl-percent').textContent = `${percent}%`;
  dlEl('dl-bytes').textContent = `${formatBytes(loaded)} / ${formatBytes(total)}`;

  const elapsed = Math.max(0.2, (Date.now() - startedAt) / 1000);
  dlEl('dl-speed').textContent = `${formatBytes(loaded / elapsed)}/s`;
}

async function handleDownload(arch) {
  if (!lastRelease?.files?.[arch]) return;
  const file = lastRelease.files[arch];

  // 必须在点击手势内调用，否则浏览器会拒绝保存对话框
  let destination = null;
  if (canStreamToDisk()) {
    destination = await pickDestination(file.name);
    if (!destination) return; // 用户取消了保存对话框
  }

  const backdrop = dlEl('dl-backdrop');
  backdrop.hidden = false;
  dlEl('dl-title').textContent = messages[currentLang]['download.progress'];
  dlEl('dl-file').textContent = file.name;
  dlEl('dl-direct').href = file.url;
  dlEl('dl-direct').hidden = true;
  dlEl('dl-cancel').textContent = messages[currentLang]['download.cancel'];
  paintProgress(0, file.size, Date.now());

  retryArch = null;
  const controller = new AbortController();
  downloadController = controller;
  const startedAt = Date.now();
  let lastPaint = 0;

  try {
    const blob = await downloadFile(
      file.url,
      file.size,
      (loaded, total) => {
        const now = Date.now();
        if (now - lastPaint > 120) {
          lastPaint = now;
          paintProgress(loaded, total, startedAt);
        }
      },
      controller.signal,
    );

    paintProgress(file.size, file.size, startedAt);

    if (destination) {
      const writable = await destination.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      saveBlob(blob, file.name);
    }

    dlEl('dl-title').textContent = messages[currentLang]['download.done'];
    setTimeout(closeDownloadPanel, 1400);
  } catch (error) {
    if (error.name === 'AbortError') {
      closeDownloadPanel();
      return;
    }
    dlEl('dl-title').textContent = messages[currentLang]['download.failed'];
    dlEl('dl-percent').textContent = '—';
    dlEl('dl-bytes').textContent = '';
    dlEl('dl-speed').textContent = '';
    dlEl('dl-direct').hidden = false;
    dlEl('dl-cancel').textContent = messages[currentLang]['download.retry'];
    retryArch = arch;
  } finally {
    downloadController = null;
  }
}

function init() {
  let saved = 'zh';
  try {
    saved = localStorage.getItem(STORAGE_KEY) || 'zh';
  } catch {
    /* ignore */
  }

  applyLanguage(saved);

  document.getElementById('lang-toggle')?.addEventListener('click', () => {
    applyLanguage(currentLang === 'zh' ? 'en' : 'zh');
  });

  for (const button of document.querySelectorAll('[data-arch]')) {
    button.addEventListener('click', () => handleDownload(button.dataset.arch));
  }

  dlEl('dl-cancel')?.addEventListener('click', () => {
    if (retryArch) {
      const arch = retryArch;
      retryArch = null;
      closeDownloadPanel();
      handleDownload(arch);
      return;
    }
    downloadController?.abort();
    closeDownloadPanel();
  });

  dlEl('dl-backdrop')?.addEventListener('click', (event) => {
    if (event.target.id === 'dl-backdrop') {
      downloadController?.abort();
      closeDownloadPanel();
    }
  });

  loadRelease();
}

init();
