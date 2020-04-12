//菜单栏功能开发
//按钮初始化 && 功能的初始化（remote） => 改变后通信
const {BrowserWindow, dialog, shell} = require('electron')
const DataStore = require('./store')
const items = require('./items')
const https = require('https')
const jsdom = require("jsdom")
const util = require('./util')
const constant = require('./constant')

const dataStore = new DataStore()

exports.createMenuItems = (mainWindow, app) => {
    //初始化本地配置
    dataStore.initCodeStyle(items.codeStyleItems[0])
    dataStore.initHTMLStyle(items.HTMlStyleItems[0])
    dataStore.initEditorStyle(items.editorStyleItems[0])
    dataStore.initEditorFontFamily(items.fontFamilyItems[0])
    //编辑器主题风格
    const editorStyleItems = items.editorStyleItems
    let editorMenuItems = []
    for (let i = 0; i < editorStyleItems.length; i++) {
        editorMenuItems.push({
                                 label: editorStyleItems[i],
                                 type: 'radio', //多选一
                                 checked: dataStore.isChecked(dataStore.editorStyleKey,
                                                              editorStyleItems[i]),
                                 click: function (menuItem) {
                                     if (menuItem.checked) {
                                         dataStore.set(dataStore.editorStyleKey, menuItem.label)
                                         mainWindow.send('cut-editor-style', menuItem.label)
                                     }
                                 }
                             })
    }
    //排版主题风格
    const htMlStyleItems = items.HTMlStyleItems
    let htmlMenuItems = []
    for (let i = 0; i < htMlStyleItems.length; i++) {
        htmlMenuItems.push({
                               label: htMlStyleItems[i],
                               type: 'radio', //多选一
                               checked: dataStore.isChecked(dataStore.htmlStyleKey,
                                                            htMlStyleItems[i]),
                               click: function (menuItem) {
                                   if (menuItem.checked) {
                                       dataStore.set(dataStore.htmlStyleKey, menuItem.label)
                                       mainWindow.send('cut-html-style', menuItem.label)
                                   }
                               }
                           })
    }
    //代码风格
    const codeStyleItems = items.codeStyleItems
    let codeMenuItems = []
    for (let i = 0; i < codeStyleItems.length; i++) {
        codeMenuItems.push({
                               label: codeStyleItems[i],
                               type: 'radio', //多选一
                               checked: dataStore.isChecked(dataStore.codeStyleKey,
                                                            codeStyleItems[i]),
                               click: function (menuItem) {
                                   if (menuItem.checked) {
                                       dataStore.set(dataStore.codeStyleKey, menuItem.label)
                                       mainWindow.send('cut-code-style', menuItem.label)
                                   }
                               }
                           })
    }
    //字体切换
    const fontFamilyItems = items.fontFamilyItems
    let fontFamilyMenus = []
    for (const fontFamily of fontFamilyItems) {
        fontFamilyMenus.push({
                                 label: fontFamily.name,
                                 type: 'radio', //多选一
                                 checked: dataStore.isChecked(dataStore.editorFontFamilyKey,
                                                              fontFamily.family),
                                 click: () => {
                                     dataStore.setEditorFontFamily(fontFamily.family)
                                     mainWindow.send('editor-font-family-adjust', fontFamily.family)
                                 }
                             })
    }

    //检查更新
    const updateApp = (bool) => {
        const url = constant.releases
        const req = https.request(url, {}, function (req) {
            let result = '';
            req.on('data', function (data) {
                result += data;
            });
            req.on('end', function () {
                parseHtml(result);
            });

            //解析html获取内容
            function parseHtml(result) {
                const dom = new jsdom.JSDOM(result);
                const element = dom.window.document.body.querySelector(
                    'div.release-header > ul> li > a[title]')
                if (!(element && element.getAttribute('title'))) {
                    if (bool) {
                        dialog.showMessageBox({message: '检查更新失败, 请前去官网查看'}).then()
                        shell.openExternal(url).then()
                    }
                    return
                }
                const version = element.getAttribute('title')
                if (util.CompareVersion(version, app.getVersion()) > 0) {
                    //发现更新
                    dialog.showMessageBox({
                                              type: 'info',
                                              buttons: ['取消', '更新'],
                                              message: `当前版本：${app.getVersion()}\n发现新版本：${version}`
                                          }
                    ).then(function (res) {
                        if (res.response === 1) {
                            shell.openExternal(url).then()
                        }
                    })
                } else if (bool) {
                    dialog.showMessageBox({message: '已经是最新版本！'}).then()
                }
            }

        })
        req.on('error', (e) => {
            console.error(e);
        });
        req.end();
    }
    //启动时自动检查更新
    updateApp(false)
    return [
        {
            label: app.getName(),
            submenu: [
                {
                    label: '关于',
                    click: function (item, focusedWindow) {
                        if (focusedWindow) {
                            const options = {
                                type: 'info',
                                title: app.getName(),
                                buttons: ['好的'],
                                message: `\n版本号：${app.getVersion()}\nCopyright © 2019 薛勤. All rights reserved.`
                            }
                            dialog.showMessageBox(focusedWindow, options).then()
                        }
                    }
                },
                {type: 'separator'},
                {
                    label: '检查更新',
                    click: () => {
                        updateApp(true)
                    }
                },
                {type: 'separator'},
                {label: '服务', role: 'services'},
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
                accelerator: 'CmdOrCtrl+T',
                click: function () {
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
                                                           'promptToCreate', 'multiSelections'],
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
            }, {
                label: '刷新',
                accelerator: 'CmdOrCtrl+L',
                click: function (menuItem, browserWindow, event) {
                    mainWindow.send("flush-md-file")
                }
            }, {
                label: '重命名',
                click: function (menuItem, browserWindow, event) {
                    mainWindow.send('rename-md-file')
                }
            }, {
                type: 'separator'
            }, {
                label: '导出',
                submenu: [
                    {
                        label: 'HTML',
                        click: function () {
                            mainWindow.send("export-html-file")
                        }
                    },
                    {
                        label: 'HTML No Style',
                        click: function () {
                            mainWindow.send("export-html-no-style-file")
                        }
                    }
                ]
            }]
        },
        {
            label: '编辑',
            submenu: [{
                label: '撤销',
                accelerator: 'CmdOrCtrl+Z',
                role: 'undo'
            }, {
                label: '重做',
                accelerator: 'CmdOrCtrl+Y',
                click: (item) => {
                    mainWindow.send('quick-key-insert-txt', item.accelerator)
                }
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
                role: 'selectAll'
            }, {
                type: 'separator'
            }, {
                label: '插入本地图片',
                click: function (menuItem, browserWindow, event) {
                    dialog.showOpenDialog({
                                              properties: ['openFile', 'multiSelections'],
                                              filters: [
                                                  {
                                                      name: 'Images',
                                                      extensions: ['jpg', 'png', 'gif', 'bmp',
                                                                   'jpeg']
                                                  },
                                              ]
                                          })
                        .then(files => {
                            if (!files.canceled) { //对话框是否被取消
                                mainWindow.send('insert-picture-file', files.filePaths)
                            }
                        })
                        .catch(err => {
                            console.log(err)
                        })
                }
            }, {
                label: '代码对齐',
                click: function (item, focusedWindow, event) {
                    mainWindow.send('format-md-code')
                }
            }, {
                type: 'separator'
            }, {
                label: '复制为 Markdown',
                click: function (item, focusedWindow, event) {
                    mainWindow.send('copy-to-md')
                }
            }, {
                label: '复制为 HTML 网页',
                click: function (item, focusedWindow, event) {
                    mainWindow.send('copy-to-html-style')
                }
            }, {
                label: '复制为 HTML 代码',
                click: function (item, focusedWindow, event) {
                    mainWindow.send('copy-to-html')
                }
            }]
        },
        {
            label: '段落',
            submenu: [
                {
                    label: '一级标题',
                    accelerator: 'CmdOrCtrl+1',
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    label: '二级标题',
                    accelerator: 'CmdOrCtrl+2',
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    label: '三级标题',
                    accelerator: 'CmdOrCtrl+3',
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    label: '四级标题',
                    accelerator: 'CmdOrCtrl+4',
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    label: '五级标题',
                    accelerator: 'CmdOrCtrl+5',
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    label: '六级标题',
                    accelerator: 'CmdOrCtrl+6',
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    type: 'separator'
                }, {
                    label: '表格',
                    accelerator: (function () {
                        if (process.platform === 'darwin') {
                            return 'Alt+Command+T'
                        } else {
                            return 'Ctrl+Shift+T'
                        }
                    })(),
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    label: '代码块',
                    accelerator: (function () {
                        if (process.platform === 'darwin') {
                            return 'Alt+Command+C'
                        } else {
                            return 'Ctrl+Shift+C'
                        }
                    })(),
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    label: '引用',
                    accelerator: (function () {
                        if (process.platform === 'darwin') {
                            return 'Alt+Command+Q'
                        } else {
                            return 'Ctrl+Shift+Q'
                        }
                    })(),
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    type: 'separator'
                }, {
                    label: '有序列表',
                    accelerator: (function () {
                        if (process.platform === 'darwin') {
                            return 'Alt+Command+O'
                        } else {
                            return 'Ctrl+Shift+O'
                        }
                    })(),
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    label: '无序列表',
                    accelerator: (function () {
                        if (process.platform === 'darwin') {
                            return 'Alt+Command+U'
                        } else {
                            return 'Ctrl+Shift+U'
                        }
                    })(),
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    label: '任务列表',
                    accelerator: (function () {
                        if (process.platform === 'darwin') {
                            return 'Alt+Command+X'
                        } else {
                            return 'Ctrl+Shift+X'
                        }
                    })(),
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }, {
                    type: 'separator'
                }, {
                    label: '水平分割线',
                    accelerator: (function () {
                        if (process.platform === 'darwin') {
                            return 'Alt+Command+-'
                        } else {
                            return 'Ctrl+Shift+-'
                        }
                    })(),
                    click: (item, focusedWindow, event) => {
                        mainWindow.send('quick-key-insert-txt', item.accelerator)
                    }
                }
            ]
        },
        {
            label: '格式',
            submenu: [{
                label: '加粗',
                accelerator: 'CmdOrCtrl+B',
                click: (item, focusedWindow, event) => {
                    mainWindow.send('quick-key-insert-txt', item.accelerator)
                }
            }, {
                label: '斜体',
                accelerator: 'CmdOrCtrl+I',
                click: (item, focusedWindow, event) => {
                    mainWindow.send('quick-key-insert-txt', item.accelerator)
                }
            }, {
                label: '下划线',
                accelerator: 'CmdOrCtrl+0',
                click: (item, focusedWindow, event) => {
                    mainWindow.send('quick-key-insert-txt', item.accelerator)
                }
            }, {
                type: 'separator'
            }, {
                label: '代码',
                accelerator: 'Ctrl+`',
                click: (item, focusedWindow, event) => {
                    mainWindow.send('quick-key-insert-txt', item.accelerator)
                }
            }, {
                type: 'separator'
            }, {
                label: '删除线',
                accelerator: 'Shift+Ctrl+`',
                click: (item, focusedWindow, event) => {
                    mainWindow.send('quick-key-insert-txt', item.accelerator)
                }
            }, {
                label: '注释',
                accelerator: 'Ctrl+-',
                click: (item, focusedWindow, event) => {
                    mainWindow.send('quick-key-insert-txt', item.accelerator)
                }
            }, {
                label: '超链接',
                accelerator: 'CmdOrCtrl+K',
                click: (item, focusedWindow, event) => {
                    mainWindow.send('quick-key-insert-txt', item.accelerator)
                }
            }, {
                label: '图片',
                accelerator: 'CmdOrCtrl+P',
                click: (item, focusedWindow, event) => {
                    mainWindow.send('quick-key-insert-txt', item.accelerator)
                }
            }
            ]
        },
        {
            label: '编辑器',
            submenu:
            editorMenuItems
        },
        {
            label: '主题',
            submenu:
            htmlMenuItems
        },
        {
            label: '代码',
            submenu:
            codeMenuItems
        },
        {
            label: '查看',
            submenu: [{
                label: '重载',
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
                click: function (item, focusedWindow) {
                    if (focusedWindow) {
                        focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
                    }
                }
            }, {
                label: '切换开发者工具',
                visible: false,
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
                label: '字体',
                submenu: fontFamilyMenus
            }, {
                label: '字号',
                submenu: [
                    {
                        label: '放大',
                        accelerator: 'CmdOrCtrl+Plus',
                        click: () => {
                            mainWindow.send('editor-font-size-adjust', '+')
                        }
                    },
                    {
                        label: '缩小',
                        accelerator: 'CmdOrCtrl+-',
                        click: () => {
                            mainWindow.send('editor-font-size-adjust', '-')
                        }
                    }
                ]
            }, {
                type: 'separator'
            }, {
                label: '字数统计',
                click: () => {
                    mainWindow.send('text-word-count')
                }
            }, {
                label: '显示行号',
                type: 'checkbox',
                checked: dataStore.getDisplayLineNumber(),
                click: (menuItem => {
                    if (menuItem.checked) {
                        dataStore.setDisplayLineNumber(true)
                        mainWindow.send('display-line-number', true)
                    } else {
                        dataStore.setDisplayLineNumber(false)
                        mainWindow.send('display-line-number', false)
                    }
                })
            }, {
                type: 'separator'
            }, {
                label: '实时预览',
                type: 'checkbox',
                accelerator: 'CmdOrCtrl+/',
                checked: dataStore.getCutPreview(),
                click: (menuItem => {
                    if (menuItem.checked) {
                        dataStore.set(dataStore.cutPreviewKey, true)
                        mainWindow.send('cut-preview-mode', true)
                    } else {
                        dataStore.set(dataStore.cutPreviewKey, false)
                        mainWindow.send('cut-preview-mode', false)
                    }
                })
            }, {
                label: '同步滑动',
                type: 'checkbox',
                checked: dataStore.getScrollSync(),
                click: (menuItem => {
                    if (menuItem.checked) {
                        dataStore.set(dataStore.scrollSyncKey, true)
                        mainWindow.send('cut-scroll-sync', true)
                    } else {
                        dataStore.set(dataStore.scrollSyncKey, false)
                        mainWindow.send('cut-scroll-sync', false)
                    }
                })
            }, {
                type: 'separator'
            }, {
                label: '夜间模式',
                type: 'checkbox',
                checked: dataStore.getNightMode(),
                click: (menuItem => {
                    if (menuItem.checked) {
                        dataStore.set(dataStore.nightModeKey, true)
                        mainWindow.send('cut-night-mode', true)
                    } else {
                        dataStore.set(dataStore.nightModeKey, false)
                        mainWindow.send('cut-night-mode', false)
                    }
                })
            }
            ]
        },
        {
            label: '窗口',
            role:
                'window',
            submenu:
                [{
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
        },
        {
            label: '帮助',
            role:
                'help',
            submenu:
                [{
                    label: '学习语法',
                    click: () => {
                        shell.openExternal(constant.studymd).then()
                    }
                }, {
                    label: '功能示例',
                    click: () => {
                        mainWindow.send('look-md-example', require('./example').example)
                    }
                }, {
                    label: '简历模版',
                    click: () => {
                        mainWindow.send('look-md-example', require('./example').jianLi)
                    }
                }, {
                    type: 'separator'
                }, {
                    label: '软件主页',
                    click: function () {
                        shell.openExternal(constant.page).then()
                    }
                }, {
                    label: '我要反馈',
                    click: () => {
                        shell.openExternal(constant.issues).then()
                    }
                }, {
                    label: '联系作者',
                    click: () => {
                        shell.openExternal(constant.mail).then()
                    }
                }]
        }
    ]
}