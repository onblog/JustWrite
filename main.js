const {app, BrowserWindow, ipcMain, dialog, Menu, shell} = require('electron')

let mainWindow

function createWindow() {
    mainWindow = new BrowserWindow({
                                             width: 850,
                                             height: 600,
                                             webPreferences: {nodeIntegration: true},
                                             titleBarStyle: "default"
                                         })
    mainWindow.loadFile('./src/index.html')
    mainWindow.webContents.openDevTools()

    mainWindow.on('close',event => {
        mainWindow = null;
    })
}

function extracted() {
    return [
        {
            label: app.getName(),
            submenu: [
                {
                    label: '关于' + app.getName(),
                    click: function (item, focusedWindow) {
                        if (focusedWindow) {
                            const options = {
                                type: 'info',
                                title: app.getName(),
                                buttons: ['好的'],
                                message: '版本：' + app.getVersion()
                            }
                            dialog.showMessageBox(focusedWindow, options, function () {
                            })
                        }
                    }
                },
                {type: 'separator'},
                {role: 'services'},
                {label: '隐藏' + app.getName(), role: 'hide'},
                {label: '隐藏其他应用', role: 'hideothers'},
                {label: '显示全部', role: 'unhide'},
                {type: 'separator'},
                {label: '退出', role: 'quit'}
            ]
        },
        {
            label: '文件',
            submenu: [{
                label: '新建',
                accelerator: 'CmdOrCtrl+N',
                click: function (menuItem, browserWindow, event) {
                    mainWindow.send("new-md-file")
                }
            }, {
                label: '新建标签',
                accelerator: 'CmdOrCtrl+T',
                click: function (menuItem, browserWindow, event) {
                    mainWindow.send("new-tab")
                }
            }, {
                type: 'separator'
            }, {
                label: '打开',
                accelerator: 'CmdOrCtrl+O',
                click: function () {
                    dialog.showOpenDialog({
                                              properties: ['openFile', 'createDirectory',
                                                           'promptToCreate'],
                                              filters: [
                                                  {name: 'markdown', extensions: ['md']}
                                              ]
                                          })
                        .then(files => {
                            if (!files.canceled) { //对话框是否被取消
                                mainWindow.send("open-md-file", files.filePaths)
                            }
                        })
                        .catch(err => {
                            console.log(err)
                        })
                }
            }, {
                label: '保存',
                accelerator: 'CmdOrCtrl+S',
                click: function (menuItem, browserWindow, event) {
                    mainWindow.send("save-md-file")
                }
            }]
        }, {
            label: '编辑',
            submenu: [{
                label: '撤销',
                accelerator: 'CmdOrCtrl+Z',
                role: 'undo'
            }, {
                label: '重做',
                accelerator: 'Shift+CmdOrCtrl+Z',
                role: 'redo'
            }, {
                type: 'separator'
            }, {
                label: '剪切',
                accelerator: 'CmdOrCtrl+X',
                role: 'cut'
            }, {
                label: '复制',
                accelerator: 'CmdOrCtrl+C',
                role: 'copy'
            }, {
                label: '粘贴',
                accelerator: 'CmdOrCtrl+V',
                role: 'paste'
            }, {
                label: '全选',
                accelerator: 'CmdOrCtrl+A',
                role: 'selectall'
            }]
        }, {
            label: '查看',
            submenu: [{
                label: '重载',
                accelerator: 'CmdOrCtrl+R',
                click: function (item, focusedWindow) {
                    if (focusedWindow) {
                        // 重载之后, 刷新并关闭所有的次要窗体
                        if (focusedWindow.id === 1) {
                            BrowserWindow.getAllWindows().forEach(function (win) {
                                if (win.id > 1) {
                                    win.close()
                                }
                            })
                        }
                        focusedWindow.reload()
                    }
                }
            }, {
                label: '切换全屏',
                accelerator: (function () {
                    if (process.platform === 'darwin') {
                        return 'Ctrl+Command+F'
                    } else {
                        return 'F11'
                    }
                })(),
                click: function (item, focusedWindow) {
                    if (focusedWindow) {
                        focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
                    }
                }
            }, {
                label: '切换开发者工具',
                accelerator: (function () {
                    if (process.platform === 'darwin') {
                        return 'Alt+Command+I'
                    } else {
                        return 'Ctrl+Shift+I'
                    }
                })(),
                click: function (item, focusedWindow) {
                    if (focusedWindow) {
                        focusedWindow.toggleDevTools()
                    }
                }
            }, {
                type: 'separator'
            }, {
                label: '应用程序菜单演示',
                click: function (item, focusedWindow) {
                    if (focusedWindow) {
                        const options = {
                            type: 'info',
                            title: '应用程序菜单演示',
                            buttons: ['好的'],
                            message: '此演示用于 "菜单" 部分, 展示如何在应用程序菜单中创建可点击的菜单项.'
                        }
                        dialog.showMessageBox(focusedWindow, options, function () {
                        })
                    }
                }
            }]
        }, {
            label: '窗口',
            role: 'window',
            submenu: [{
                label: '最小化',
                accelerator: 'CmdOrCtrl+M',
                role: 'minimize'
            }, {
                label: '关闭',
                accelerator: 'CmdOrCtrl+W',
                role: 'close'
            }, {
                type: 'separator'
            }, {
                label: '重新打开窗口',
                accelerator: 'CmdOrCtrl+Shift+T',
                enabled: false,
                key: 'reopenMenuItem',
                click: function () {
                    app.emit('activate')
                }
            }]
        }, {
            label: '帮助',
            role: 'help',
            submenu: [{
                label: '学习更多',
                click: function () {
                    shell.openExternal('http://electron.atom.io')
                }
            }]
        }]
}

app.on('ready', () => {
    //创建窗口
    createWindow()
    //创建菜单栏
    let template = extracted()
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
    //共享数据
    global.sharedObject = {
        temp: app.getPath("temp"),
        appName: app.getName()
    }
})

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
    // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
    // 否则绝大部分应用及其菜单栏会保持激活。
    if (process.platform !== 'darwin') {
        app.quit()
    }
    app.quit()
})

app.on('activate', () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (mainWindow === null) {
        createWindow()
    }
})