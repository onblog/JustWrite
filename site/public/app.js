/**
 * 喵喵笔记官网前端：语言切换 + 版本信息。
 * 零依赖、零第三方请求，所有逻辑都在这个文件里。
 */

const messages = {
  zh: {
    'meta.title': '喵喵笔记 · 本地优先的 Markdown 笔记应用',
    brand: '喵喵笔记',
    'hero.title': '喵喵笔记',
    'hero.tagline': '一只喵喵的本地 Markdown 笔记应用',
    'hero.desc': '笔记就是 iCloud Drive 里的普通 .md 文件，多台 Mac 自动同步。没有账号，没有服务器，没有订阅。',
    'download.arm64': '下载 Apple Silicon 版',
    'download.x64': '下载 Intel 版',
    'download.hint': 'macOS 12 及以上 · 未签名构建，首次打开需在「系统设置 → 隐私与安全性」中允许',
    'download.latest': '最新版本',
    'feature.layout.title': '三栏布局',
    'feature.layout.desc': '文件夹、笔记、内容三列，参考 macOS 备忘录的交互，切换笔记不丢光标位置。',
    'feature.files.title': '笔记就是文件',
    'feature.files.desc': '每条笔记都是普通 Markdown 文件，随时可以用别的编辑器打开、grep、丢进 Git。',
    'feature.icloud.title': 'iCloud 同步',
    'feature.icloud.desc': '不接第三方同步服务，直接把笔记库放在 iCloud Drive，多台 Mac 由系统自动同步。',
    'privacy.title': '关于隐私',
    'privacy.p1': '应用不联网，不收集任何使用数据。',
    'privacy.p2': '这个官网没有第三方统计、没有广告、没有 Cookie。',
    'privacy.p3': '下载不记录 IP，代码全部开源，可以自己审计。',
    'footer.license': 'GPL-3.0 开源协议',
    'footer.made': '为 macOS 而做',
  },
  en: {
    'meta.title': 'Miaomiao Notes · A local-first Markdown notes app for macOS',
    brand: 'Miaomiao Notes',
    'hero.title': 'Miaomiao Notes',
    'hero.tagline': 'A local-first Markdown notes app for macOS',
    'hero.desc':
      'Your notes are plain .md files inside iCloud Drive, synced across your Macs by the system. No account, no server, no subscription.',
    'download.arm64': 'Download for Apple Silicon',
    'download.x64': 'Download for Intel',
    'download.hint':
      'macOS 12 or later · unsigned build, allow it once in System Settings → Privacy & Security',
    'download.latest': 'Latest',
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
    'privacy.p1': 'The app makes no network requests and collects no usage data.',
    'privacy.p2': 'This site has no third-party analytics, no ads and no cookies.',
    'privacy.p3': 'Downloads are not logged by IP, and the source is open for review.',
    'footer.license': 'GPL-3.0 licensed',
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

  loadRelease();
}

init();
