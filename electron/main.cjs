'use strict';

const { app, BrowserWindow, ipcMain, Menu, shell, dialog, nativeTheme } = require('electron');
const path = require('node:path');

const {
  icloudRoot,
  vaultPath,
  isICloudAvailable,
  isVaultReady,
  ensureVault,
} = require('./icloud.cjs');
const { createFileService } = require('./files.cjs');
const settings = require('./settings.cjs');

// Load the Vite dev server only when explicitly asked, otherwise use dist/.
const DEV_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow = null;
let files = null;

function bootServices() {
  const vault = vaultPath();
  const created = ensureVault();
  files = createFileService(vault);
  return { vault, created, icloud: isICloudAvailable() };
}

function createWindow() {
  const current = settings.read();
  nativeTheme.themeSource = current.theme;

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 560,
    title: '喵喵笔记',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 20 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ------------------------------------------------------------------ ipc */

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) console.error(`[ipc:${channel}]`, error);
      return { ok: false, error: error.message || 'unknown error', status };
    }
  });
}

function registerIpc() {
  handle('vault:info', () => ({
    path: vaultPath(),
    icloudRoot: icloudRoot(),
    available: isICloudAvailable(),
    ready: isVaultReady(),
  }));

  handle('vault:open', () => shell.openPath(vaultPath()));

  handle('settings:get', () => settings.read());
  handle('settings:set', (patch) => {
    const previous = settings.read().language;
    const next = settings.write(patch || {});
    nativeTheme.themeSource = next.theme;
    if (next.language !== previous) buildMenu();
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('settings:changed', next);
    }
    return next;
  });
  handle('settings:reset', () => {
    const next = settings.reset();
    nativeTheme.themeSource = next.theme;
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('settings:changed', next);
    }
    return next;
  });

  handle('notes:tree', () => files.tree());
  handle('notes:list', () => files.list());
  handle('notes:read', (relative) => files.read(relative));
  handle('notes:write', (relative, content) => files.write(relative, content));
  handle('notes:create', (relative, content) => files.create(relative, content));
  handle('notes:mkdir', (relative) => files.mkdir(relative));
  handle('notes:rename', (from, to) => files.rename(from, to));
  handle('notes:remove', (relative) => files.remove(relative));
  handle('notes:search', (query) => files.search(query));

  handle('notes:reveal', (relative) => {
    const target = path.join(files.root, relative);
    shell.showItemInFolder(target);
    return true;
  });

  handle('notes:menu', (relative) => {
    const target = path.join(files.root, relative);
    return new Promise((resolve) => {
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const menu = Menu.buildFromTemplate([
        { label: '重命名', click: () => done('rename') },
        {
          label: '在 Finder 中显示',
          click: () => {
            shell.showItemInFolder(target);
            done(null);
          },
        },
        { type: 'separator' },
        { label: '删除', click: () => done('delete') },
      ]);

      menu.popup({ window: mainWindow, callback: () => done(null) });
    });
  });

  handle('dialog:confirm', async ({ title, message, detail, confirmLabel }) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: [confirmLabel || currentMenuText().ok, currentMenuText().cancel],
      defaultId: 0,
      cancelId: 1,
      title: title || '喵喵笔记',
      message: message || '',
      detail: detail || '',
    });
    return result.response === 0;
  });
}

/* ------------------------------------------------------------------ menu */

const MENU_TEXT = {
  zh: {
    app: '喵喵笔记',
    about: '关于喵喵笔记',
    prefs: '偏好设置…',
    hide: '隐藏喵喵笔记',
    hideOthers: '隐藏其他',
    unhide: '全部显示',
    quit: '退出喵喵笔记',
    file: '文件',
    newNote: '新建笔记',
    reveal: '在 Finder 中显示',
    close: '关闭窗口',
    edit: '编辑',
    undo: '撤销',
    redo: '重做',
    cut: '剪切',
    copy: '复制',
    paste: '粘贴',
    selectAll: '全选',
    view: '视图',
    reload: '重新加载',
    devtools: '开发者工具',
    actualSize: '实际大小',
    zoomIn: '放大',
    zoomOut: '缩小',
    fullscreen: '全屏',
    window: '窗口',
    minimize: '最小化',
    zoom: '缩放',
    ok: '确定',
    cancel: '取消',
  },
  en: {
    app: 'Miaomiao Notes',
    about: 'About Miaomiao Notes',
    prefs: 'Settings…',
    hide: 'Hide Miaomiao Notes',
    hideOthers: 'Hide Others',
    unhide: 'Show All',
    quit: 'Quit Miaomiao Notes',
    file: 'File',
    newNote: 'New Note',
    reveal: 'Show in Finder',
    close: 'Close Window',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    view: 'View',
    reload: 'Reload',
    devtools: 'Toggle Developer Tools',
    actualSize: 'Actual Size',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    fullscreen: 'Toggle Full Screen',
    window: 'Window',
    minimize: 'Minimize',
    zoom: 'Zoom',
    ok: 'OK',
    cancel: 'Cancel',
  },
};

function currentMenuText() {
  return MENU_TEXT[settings.read().language === 'en' ? 'en' : 'zh'];
}

function buildMenu() {
  const m = currentMenuText();

  const template = [
    {
      label: m.app,
      submenu: [
        { role: 'about', label: m.about },
        { type: 'separator' },
        {
          label: m.prefs,
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('menu:open-settings'),
        },
        { type: 'separator' },
        { role: 'hide', label: m.hide },
        { role: 'hideOthers', label: m.hideOthers },
        { role: 'unhide', label: m.unhide },
        { type: 'separator' },
        { role: 'quit', label: m.quit },
      ],
    },
    {
      label: m.file,
      submenu: [
        {
          label: m.newNote,
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new-note'),
        },
        {
          label: m.reveal,
          click: () => shell.openPath(vaultPath()),
        },
        { type: 'separator' },
        { role: 'close', label: m.close },
      ],
    },
    {
      label: m.edit,
      submenu: [
        { role: 'undo', label: m.undo },
        { role: 'redo', label: m.redo },
        { type: 'separator' },
        { role: 'cut', label: m.cut },
        { role: 'copy', label: m.copy },
        { role: 'paste', label: m.paste },
        { role: 'selectAll', label: m.selectAll },
      ],
    },
    {
      label: m.view,
      submenu: [
        { role: 'reload', label: m.reload },
        { role: 'toggleDevTools', label: m.devtools },
        { type: 'separator' },
        { role: 'resetZoom', label: m.actualSize },
        { role: 'zoomIn', label: m.zoomIn },
        { role: 'zoomOut', label: m.zoomOut },
        { type: 'separator' },
        { role: 'togglefullscreen', label: m.fullscreen },
      ],
    },
    {
      label: m.window,
      submenu: [
        { role: 'minimize', label: m.minimize },
        { role: 'zoom', label: m.zoom },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName('喵喵笔记');

app.whenReady().then(() => {
  bootServices();
  registerIpc();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS 默认保留进程；只有用户在设置里勾选后才退出。
  if (process.platform !== 'darwin' || settings.read().quitOnAllWindowsClosed) {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  console.error('[main] uncaught exception:', error);
});
