'use strict';

const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('node:path');

const {
  icloudRoot,
  vaultPath,
  isICloudAvailable,
  isVaultReady,
  ensureVault,
} = require('./icloud.cjs');
const { createFileService, PathError } = require('./files.cjs');

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
      buttons: [confirmLabel || '确定', '取消'],
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

function buildMenu() {
  const template = [
    {
      label: '喵喵笔记',
      submenu: [
        { role: 'about', label: '关于喵喵笔记' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏喵喵笔记' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: '退出喵喵笔记' },
      ],
    },
    {
      label: '文件',
      submenu: [
        {
          label: '新建笔记',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new-note'),
        },
        {
          label: '在 Finder 中显示',
          click: () => shell.openPath(vaultPath()),
        },
        { type: 'separator' },
        { role: 'close', label: '关闭窗口' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [{ role: 'minimize', label: '最小化' }, { role: 'zoom', label: '缩放' }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ life */

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
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
  console.error('[main] uncaught exception:', error);
});
