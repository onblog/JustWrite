//菜单栏功能开发
//按钮初始化 && 功能的初始化（remote） => 改变后通信
const {BrowserWindow, dialog, shell, session} = require('electron')
const DataStore = require('./store')
const items = require('./items')
const https = require('https')
const jsdom = require("jsdom")

const dataStore = new DataStore()

let codeStyleItems = items.codeStyleItems
let htMlStyleItems = items.HTMlStyleItems
let editorStyleItems = items.editorStyleItems

exports.createMenuItems = (mainWindow, app) => {
    //初始化本地配置
    dataStore.setCodeStyle(items.codeStyleItems[0])
    dataStore.setHTMLStyle(items.HTMlStyleItems[0])
    dataStore.setEditorStyle(items.editorStyleItems[0])
    //编辑器主题风格
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
    for (let i = 0; i < fontFamilyItems.length; i++) {
        fontFamilyMenus.push({
                                 label: fontFamilyItems[i],
                                 type: 'radio', //多选一
                                 checked: dataStore.isChecked(dataStore.editorFontFamilyKey,
                                                              fontFamilyItems[i]),
                                 click: (item) => {
                                     mainWindow.send('editor-font-family-adjust', item.label)
                                 }
                             })
    }

    //登录某网站获取Cookie通用方法
    function getSiteCookie(url, callback) {
        let win = new BrowserWindow({width: 800, height: 600, title: '【登陆成功后关闭窗口即可完成设置】'})
        win.loadURL(url).then()
        win.on('close', () => {
            win = null
            // 查询所有与设置的 URL 相关的所有 cookies.
            session.defaultSession.cookies.get({url: url})
                .then((cookies) => {
                    let cookieString = ''
                    for (let cookie of cookies) {
                        cookieString += cookie.name + '=' + cookie.value + '; '
                    }
                    callback(cookieString.trim())
                }).catch((error) => {
                console.log(error)
            })
        })
        win.on('page-title-updated', (e) => {
            //阻止窗口标题更改
            e.preventDefault()
        })
    }

    //登录新浪图床
    const setWebBoPicture = function (item, focusedWindow, event) {
        getSiteCookie('https://www.weibo.com/', (cookie) => {
            dataStore.setWeiBoCookies(cookie)
        })
    }
    //登录博客园
    const loginCnBlog = function (item, focusedWindow, event) {
        getSiteCookie('https://www.cnblogs.com/', (cookie) => {
            dataStore.setCnBlogCookie(cookie)
        })
    }
    //登录CSDN
    const loginCSDN = function (item, focusedWindow, event) {
        getSiteCookie('https://blog.csdn.net/', (cookie) => {
            dataStore.setCSDNCookie(cookie)
        })
    }
    //登录掘金
    const loginJueJin = function (item, focusedWindow, event) {
        getSiteCookie('https://juejin.im/', (cookie) => {
            dataStore.setJueJinCookie(cookie)
        })
    }
    //登录开源中国
    const loginOsChina = function (item, focusedWindow, event) {
        getSiteCookie('https://my.oschina.net/', (cookie) => {
            dataStore.setOsChinaCookie(cookie)
            getOsChinaUserInfo()
        })
    }

    //获取开源中国的g_user_code，获取g_user_id
    function getOsChinaUserInfo() {
        https.get('https://www.oschina.net/', {
            headers: {
                'Cookie': dataStore.getOsChinaCookies()
            }
        }, res => {
            let str = '';
            res.on('data', function (buffer) {
                str += buffer;//用字符串拼接
            })
            res.on('end', () => {
                const dom = new jsdom.JSDOM(str);
                const g_user_code = dom.window.document.body.querySelector(
                    'body > val[data-name=g_user_code]').dataset.value
                const g_user_id = dom.window.document.body.querySelector(
                    'body > val[data-name=g_user_id]').dataset.value
                if (g_user_code && g_user_id) {
                    dataStore.setOsChinaUserCode(g_user_code)
                    dataStore.setOsChinaUserId(g_user_id)
                    dialog.showMessageBox({message: '已登录开源中国'}).then()
                }
            });
        })
    }

    //登录思否
    const loginSegmentFault = function (item, focusedWindow, event) {
        getSiteCookie('https://segmentfault.com', (cookie) => {
            dataStore.setSegmentFaultCookie(cookie)
        })
    }
    //一键发布思否的必要认证
    const preparePublishArticleToSegmentFault = function () {
        let win = new BrowserWindow({width: 1, height: 1})
        win.loadURL('https://segmentfault.com/howtowrite').then()
        //页面加载完
        win.webContents.on('did-finish-load', (event, result) => {
            if (win.webContents.getURL() === 'https://segmentfault.com/howtowrite') {
                // 点击按钮，开始导航到新地址
                win.webContents.executeJavaScript(
                    `document.querySelector("body > div > div > div > div > div > div > div > a").click()`)
                    .then()
            } else if (win.webContents.getURL() === 'https://segmentfault.com/write?freshman=1') {
                // 读取token
                win.webContents.executeJavaScript(`window.SF.token`).then((result) => {
                    dataStore.setSegmentFaultToken(result)
                    // 关闭窗口
                    win.destroy()
                })
            } else {
                // 关闭窗口
                win.destroy()
            }
        })
        //页面关闭后
        win.on('closed', () => {
            win = null
            // 查询所有与设置的 URL 相关的所有 cookies.
            session.defaultSession.cookies.get({url: 'https://segmentfault.com/'})
                .then((cookies) => {
                    let cookieString = ''
                    for (let cookie of cookies) {
                        cookieString += cookie.name + '=' + cookie.value + '; '
                    }
                    dataStore.setSegmentFaultCookie(cookieString.trim())
                }).catch((error) => {
                console.error(error)
            })
            // 发出通知
            mainWindow.send('publish-article-to-SegmentFault')
        })
    }

    //检查更新
    const updateApp = (bool) => {
        const releases = 'https://github.com/yueshutong/JustWrite/releases'
        const req = https.request(releases, {}, function (req) {
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
                        dialog.showMessageBox({message: '已经是最新版本！'}).then()
                    }
                    return
                }
                const version = element.getAttribute('title')
                if (CompareVersion(version, app.getVersion()) > 0) {
                    //发现更新
                    dialog.showMessageBox({
                                              type: 'info',
                                              buttons: ['取消', '更新'],
                                              message: `当前版本：${app.getVersion()}\n发现新版本：${version}`
                                          }
                    ).then(function (res) {
                        if (res.response === 1) {
                            shell.openExternal(releases).then()
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
                                message: `\n版本号：${app.getVersion()}\nCopyright © 2019 yueshutong. All rights reserved.`
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
                label: '重命名',
                click: function (menuItem, browserWindow, event) {
                    dialog.showSaveDialog({
                                              title: '重命名为',
                                              nameFieldLabel: '重命名',
                                              filters: [
                                                  {name: 'markdown', extensions: ['md']}
                                              ]
                                          })
                        .then(file => {
                            if (!file.canceled) { //对话框是否被取消
                                mainWindow.send('rename-md-file', file.filePath)
                            }
                        })
                        .catch(err => {
                            console.log(err)
                        })
                }
            }, {
                type: 'separator'
            }, {
                label: '打印PDF',
                click: function () {
                    mainWindow.send("export-pdf-file")
                }
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
                click: (item, focusedWindow, event) => {
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
                    visible: false,
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
                accelerator: 'CmdOrCtrl+U',
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
            label: '图片',
            submenu: [
                {
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
                },
                {
                    label: '新浪微博图床',
                    type: 'submenu',
                    submenu: [{
                        label: '登录新浪微博',
                        click: setWebBoPicture
                    }, {
                        label: '图片自动上传',
                        type: 'checkbox',
                        checked: dataStore.isChecked(dataStore.weiBoUploadKey, true),
                        click: function (menuItem) {
                            dataStore.setWeiBoUpload(menuItem.checked)
                            mainWindow.send('cut-weiBo-upload', menuItem.checked)
                        }
                    }, {
                        type: 'separator'
                    }, {
                        label: '一键图片上传',
                        click: function (menuItem, browserWindow, event) {
                            mainWindow.send('upload-all-picture-to-weiBo')
                        }
                    }, {
                        label: '解决图床防盗链',
                        click: function (menuItem, browserWindow, event) {
                            mainWindow.send('picture-md-to-img')
                        }
                    }]
                }, {
                    type: 'separator'
                }, {
                    label: '网络图片下载',
                    click: () => {
                        mainWindow.send('download-net-picture')
                    }
                }, {
                    label: '本地图片整理',
                    click: () => {
                        mainWindow.send('move-picture-to-folder')
                    }
                }
            ]
        },
        {
            label: '发布',
            submenu: [
                {
                    label: '博客园',
                    submenu: [{
                        label: '登录博客园',
                        click: loginCnBlog
                    }, {
                        label: '一键发布',
                        click: () => {
                            mainWindow.send('publish-article-to-cnblogs')
                        }
                    }]
                }, {
                    label: 'CSDN',
                    submenu: [{
                        label: '登录CSDN',
                        click: loginCSDN
                    }, {
                        label: '一键发布',
                        click: () => {
                            mainWindow.send('publish-article-to-csdn')
                        }
                    }]
                }, {
                    label: '掘金',
                    submenu: [{
                        label: '登录掘金',
                        click: loginJueJin
                    }, {
                        label: '一键发布',
                        click: () => {
                            mainWindow.send('publish-article-to-jueJin')
                        }
                    }]
                }, {
                    label: '开源中国',
                    submenu: [{
                        label: '登录开源中国',
                        click: loginOsChina
                    }, {
                        label: '一键发布',
                        click: () => {
                            mainWindow.send('publish-article-to-OsChina')
                        }
                    }]
                }, {
                    label: '思否',
                    submenu: [{
                        label: '登录思否',
                        click: loginSegmentFault
                    }, {
                        label: '一键发布',
                        click: () => {
                            preparePublishArticleToSegmentFault()
                        }
                    }]
                }
            ]
        },
        {
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
                        dataStore.set(dataStore.displayLineNumber, true)
                        mainWindow.send('display-line-number', true)
                    } else {
                        dataStore.set(dataStore.displayLineNumber, false)
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
                    label: 'Markdown语法',
                    click: () => {
                        shell.openExternal('http://www.markdown.cn/').then()
                    }
                }, {
                    type: 'separator'
                }, {
                    label: '软件主页',
                    click: function () {
                        shell.openExternal('https://github.com/yueshutong/JustWrite/')
                            .then()
                    }
                }, {
                    label: '我要反馈',
                    click: () => {
                        shell.openExternal('https://github.com/yueshutong/JustWrite/issues')
                            .then()
                    }
                }, {
                    label: '联系作者',
                    click: () => {
                        dialog.showMessageBox(
                            {type: 'info', message: '邮箱：yster@foxmail.com'})
                            .then()
                    }
                }, {
                    label: '加入群聊',
                    click: () => {
                        shell.openExternal(
                            'https://shang.qq.com/wpa/qunwpa?idkey=d0756ea301050e3f093124a97ba19f7b5e40d5e03b6a849e7ca1748421eb193b')
                            .then()
                    }
                }]
        }
    ]
}

/**
 * 版本号比较
 * @return {number}
 */
function CompareVersion(v1, v2) {
    const vv1 = v1.split('.')
    const vv2 = v2.split('.')
    const length = vv1.length >= vv2.length ? vv1.length : vv2.length
    for (let i = 0; i < length; i++) {
        if (!vv1[i]) {
            vv1[i] = 0
        }
        if (!vv2[i]) {
            vv2[i] = 0
        }
        if (vv1[i] > vv2[i]) {
            return 1
        } else if (vv1[i] < vv2[i]) {
            return -1
        }
    }
    return 0
}