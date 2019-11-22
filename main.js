const {app, BrowserWindow, ipcMain, dialog, Menu} = require('electron')
const cMenu = require('./src/script/menu')

let mainWindow

const options = {
    type: 'info',
    buttons: ['退出', '返回保存',],
    defaultId: 1,
    message: '是否保存已编辑的文本？',
    cancelId: 0,
    noLink: true
}

function createWindow() {
    mainWindow = new BrowserWindow({
                                       width: 900,
                                       height: 650,
                                       webPreferences: {devTools: false, nodeIntegration: true},
                                       titleBarStyle: "hidden"
                                   })
    mainWindow.loadFile('./src/index.html').then()
    mainWindow.webContents.openDevTools()
    mainWindow.on('close', (event) => {
        if (global.sharedObject.closeAllWindow) { //询问
            dialog.showMessageBox(options).then(function (result) {
                if (result.response === 1) { //不关闭
                    event.preventDefault()
                } else { //关闭
                    mainWindow = null;
                    global.sharedObject.closeAllWindow = false
                }
            })
        } else {
            //直接关闭
            mainWindow = null;
        }
    })
    //创建菜单栏
    let template = cMenu.createMenuItems(mainWindow, app)
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}

app.on('ready', () => {
    //共享数据
    global.sharedObject = {
        temp: app.getPath("temp"),
        closeAllWindow: false, //是否提示
    }

    //创建窗口
    createWindow()

    //测试版试用时间到期
    // if (dataStore.isOutUseTime()) {
    //     dialog.showMessageBox({
    //                               title: '试用已到期',
    //                               message: '您当前软件是测试体验版，48小时试用时间已到期，如需正式版，请联系邮箱yster@foxmail.com购买',
    //                               buttons: ['确定']
    //                           }).then((result) => {
    //                               app.quit()
    //     })
    // }

    //新建一个文件
    ipcMain.on('new-md-file', (event, id) => {
        dialog.showSaveDialog({
                                  filters: [
                                      {name: 'markdown', extensions: ['md']}
                                  ]
                              })
            .then(files => {
                if (!files.canceled) { //对话框是否被取消
                    mainWindow.send("new-md-file-complete", files.filePath, id)
                }
            })
            .catch(err => {
                console.log(err)
            })
    })

    //提示是否保存这个文件
    ipcMain.on('or-save-md-file', ((event, id) => {
        dialog.showMessageBox(options).then(function (result) {
            if (result.response === 1) {
                mainWindow.send('or-save-md-file-result', true, id)
            } else {
                mainWindow.send('or-save-md-file-result', false, id)
            }
        })
    }))

})

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
    // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，否则绝大部分应用及其菜单栏会保持激活。
    if (process.platform !== 'darwin') {
        app.quit()
    }
    // app.quit()
})

app.on('activate', () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (mainWindow === null) {
        createWindow()
    }
})