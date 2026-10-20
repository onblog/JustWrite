/**
 * 界面文案字典。只有渲染进程使用；主进程的菜单有自己的一份精简字典。
 * 新增文案时两边都要加，否则菜单会回落成中文。
 */

const messages = {
  zh: {
    'app.name': '喵喵笔记',
    'list.all': '全部笔记',
    'list.search': '搜索笔记',
    'list.empty': '这里还没有笔记',
    'list.noResults': '没有找到相关笔记',
    'list.blank': '（空白笔记）',

    'action.newNote': '新建笔记 (⌘N)',
    'action.preview': '预览 (⌘E)',
    'action.more': '更多操作',
    'action.settings': '设置',
    'action.reveal': '在 Finder 中显示',
    'action.save': '保存',
    'action.create': '创建',
    'action.cancel': '取消',
    'action.delete': '删除',
    'action.rename': '重命名',

    'empty.title': '喵～还没有笔记',
    'empty.desc': '点右上角「＋」新建一条，或者把 .md 文件拖进 iCloud 文件夹',
    'empty.cta': '新建第一条笔记',

    'conflict.message': '检测到 iCloud 冲突副本，内容不会自动合并。',
    'conflict.dismiss': '知道了',

    'note.updated': '更新于 {time}',

    'time.justNow': '刚刚',
    'time.minutes': '{n} 分钟前',
    'time.hours': '{n} 小时前',
    'time.days': '{n} 天前',

    'toast.loadFailed': '读取笔记失败',
    'toast.openFailed': '打开失败',
    'toast.saveFailed': '保存失败',
    'toast.createFailed': '创建失败',
    'toast.renameFailed': '重命名失败',
    'toast.deleteFailed': '删除失败',
    'toast.settingsSaved': '设置已保存',
    'toast.settingsReset': '已恢复默认设置',
    'toast.copied': '已复制',
    'toast.inserted': '已插入',
    'toast.replaced': '已替换选中内容',

    'dialog.newNote.title': '新建笔记',
    'dialog.newNote.placeholder': '给笔记起个名字',
    'dialog.rename.title': '重命名笔记',
    'dialog.delete.title': '删除笔记',
    'dialog.delete.message': '确定删除「{name}」吗？',
    'dialog.delete.detail': '笔记会被移到 .trash 目录，仍然可以手动找回。',
    'dialog.confirm': '确定',

    'settings.title': '设置',
    'settings.appearance': '外观',
    'settings.theme': '主题',
    'settings.theme.desc': '决定界面的明暗样式',
    'settings.theme.light': '浅色',
    'settings.theme.dark': '深色',
    'settings.fontSize': '编辑器字号',
    'settings.fontSize.desc': '{size}px',
    'settings.fontSize.small': '小',
    'settings.fontSize.medium': '中',
    'settings.fontSize.large': '大',
    'time.date': '{m} 月 {d} 日',
    'status.saved': '已保存',
    'status.unsaved': '未保存',
    'status.saving': '保存中…',
    'status.saveFailed': '保存失败',
    'status.ready': '就绪',
    'settings.reduceMotion': '减少动效',
    'settings.reduceMotion.desc': '关闭猫咪漂浮等过渡动画',

    'settings.list': '列表',
    'settings.sortBy': '排序方式',
    'settings.sortBy.desc': '决定笔记列表的排列顺序',
    'settings.sort.mtime': '修改',
    'settings.sort.ctime': '创建',
    'settings.sort.title': '标题',
    'settings.showSnippet': '显示摘要',
    'settings.showSnippet.desc': '在标题下方显示两行正文预览',

    'settings.editor': '编辑器',
    'settings.defaultPreview': '默认打开预览',
    'settings.defaultPreview.desc': '打开笔记时直接显示渲染结果',

    'settings.behavior': '行为',
    'settings.quit': '关闭所有窗口后退出程序',
    'settings.quit.desc': 'macOS 默认会在后台保留进程',
    'settings.restore': '启动时恢复上次笔记',
    'settings.restore.desc': '关闭后改为打开列表第一条',
    'settings.autoSave': '自动保存延迟',
    'settings.autoSave.desc': '{ms}ms',
    'settings.autoSave.fast': '快',
    'settings.autoSave.normal': '标准',
    'settings.autoSave.slow': '慢',

    'settings.language': '语言',
    'settings.language.desc': '界面显示语言',
    'settings.language.zh': '中文',
    'settings.language.en': 'English',

    'settings.reset': '恢复默认',
    'settings.save': '保存',
    'settings.cancel': '取消',

    'sync.icloud': 'iCloud 同步 · {name}',
    'sync.local': '未检测到 iCloud，使用本地目录',
  },

  en: {
    'app.name': 'Miaomiao Notes',
    'list.all': 'All Notes',
    'list.search': 'Search notes',
    'list.empty': 'No notes here yet',
    'list.noResults': 'No matching notes',
    'list.blank': '(Empty note)',

    'action.newNote': 'New note (⌘N)',
    'action.preview': 'Preview (⌘E)',
    'action.more': 'More',
    'action.settings': 'Settings',
    'action.reveal': 'Show in Finder',
    'action.save': 'Save',
    'action.create': 'Create',
    'action.cancel': 'Cancel',
    'action.delete': 'Delete',
    'action.rename': 'Rename',

    'empty.title': 'Meow — no notes yet',
    'empty.desc': 'Click + to create one, or drop .md files into your iCloud folder',
    'empty.cta': 'Create your first note',

    'conflict.message': 'iCloud conflict copies detected. Nothing is merged automatically.',
    'conflict.dismiss': 'Got it',

    'note.updated': 'Updated {time}',

    'time.justNow': 'just now',
    'time.minutes': '{n} min ago',
    'time.hours': '{n} h ago',
    'time.days': '{n} d ago',

    'toast.loadFailed': 'Could not load notes',
    'toast.openFailed': 'Could not open the note',
    'toast.saveFailed': 'Could not save',
    'toast.createFailed': 'Could not create the note',
    'toast.renameFailed': 'Could not rename',
    'toast.deleteFailed': 'Could not delete',
    'toast.settingsSaved': 'Settings saved',
    'toast.settingsReset': 'Settings reset to defaults',
    'toast.copied': 'Copied',
    'toast.inserted': 'Inserted',
    'toast.replaced': 'Replaced the selection',

    'dialog.newNote.title': 'New note',
    'dialog.newNote.placeholder': 'Name your note',
    'dialog.rename.title': 'Rename note',
    'dialog.delete.title': 'Delete note',
    'dialog.delete.message': 'Delete “{name}”?',
    'dialog.delete.detail': 'The note moves to .trash and can still be recovered.',
    'dialog.confirm': 'OK',

    'settings.title': 'Settings',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.theme.desc': 'Light or dark interface',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.fontSize': 'Editor font size',
    'settings.fontSize.desc': '{size}px',
    'settings.fontSize.small': 'Small',
    'settings.fontSize.medium': 'Medium',
    'settings.fontSize.large': 'Large',
    'time.date': '{m}/{d}',
    'status.saved': 'Saved',
    'status.unsaved': 'Unsaved',
    'status.saving': 'Saving…',
    'status.saveFailed': 'Save failed',
    'status.ready': 'Ready',
    'settings.reduceMotion': 'Reduce motion',
    'settings.reduceMotion.desc': 'Disable the cat float and other transitions',

    'settings.list': 'List',
    'settings.sortBy': 'Sort by',
    'settings.sortBy.desc': 'Order of the note list',
    'settings.sort.mtime': 'Modified',
    'settings.sort.ctime': 'Created',
    'settings.sort.title': 'Title',
    'settings.showSnippet': 'Show snippet',
    'settings.showSnippet.desc': 'Two-line preview under each title',

    'settings.editor': 'Editor',
    'settings.defaultPreview': 'Open in preview',
    'settings.defaultPreview.desc': 'Show the rendered note instead of the editor',

    'settings.behavior': 'Behaviour',
    'settings.quit': 'Quit when all windows close',
    'settings.quit.desc': 'macOS keeps the app running by default',
    'settings.restore': 'Reopen last note',
    'settings.restore.desc': 'Otherwise open the first note in the list',
    'settings.autoSave': 'Autosave delay',
    'settings.autoSave.desc': '{ms}ms',
    'settings.autoSave.fast': 'Fast',
    'settings.autoSave.normal': 'Normal',
    'settings.autoSave.slow': 'Slow',

    'settings.language': 'Language',
    'settings.language.desc': 'Interface language',
    'settings.language.zh': '中文',
    'settings.language.en': 'English',

    'settings.reset': 'Reset',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',

    'sync.icloud': 'iCloud · {name}',
    'sync.local': 'iCloud unavailable — using a local folder',
  },
};

let current = 'zh';

export function setLanguage(lang) {
  current = lang === 'en' ? 'en' : 'zh';
  document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';
}

export function getLanguage() {
  return current;
}

export function isEnglish() {
  return current === 'en';
}

/** Translate a key, with optional {placeholder} interpolation. */
export function t(key, vars) {
  let text = messages[current][key] ?? messages.zh[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

/** Fill every element carrying a data-i18n* attribute. */
export function applyI18n(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    if (node.dataset.i18n) node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-i18n-title]')) {
    if (node.dataset.i18nTitle) node.title = t(node.dataset.i18nTitle);
  }
  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) {
    if (node.dataset.i18nPlaceholder) node.placeholder = t(node.dataset.i18nPlaceholder);
  }
  for (const node of root.querySelectorAll('[data-i18n-aria]')) {
    if (node.dataset.i18nAria) node.setAttribute('aria-label', t(node.dataset.i18nAria));
  }
}
