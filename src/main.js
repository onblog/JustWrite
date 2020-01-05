const {app, BrowserWindow, ipcMain, dialog, Menu} = require('electron')
const cMenu = require('./script/menu')
const iconPath = require('./icon').iconFile //窗口图标

let mainWindow

const options = {
    type: 'info',
    buttons: ['不了,谢谢', '返回保存',],
    defaultId: 1,
    message: '是否保存已编辑的文本？',
    cancelId: 0,
    noLink: true
}

function createWindow() {
    mainWindow = new BrowserWindow({
                                       width: 800,
                                       height: 600,
                                       icon: iconPath,
                                       webPreferences: {devTools: true, nodeIntegration: true},
                                       titleBarStyle: "hidden"
                                   })
    mainWindow.loadFile('./src/index.html').then()
    // mainWindow.webContents.openDevTools()
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

//直接拖拽文件到应用程序，或者在程序运行时使用该程序打开文件
app.on('open-file', (event, path) => {
    if (mainWindow) {
        mainWindow.send("open-md-file", Array.of(path))
    }
})

app.on('ready', () => {
    //共享数据
    global.sharedObject = {
        temp: app.getPath("temp"),
        closeAllWindow: false, //是否提示
    }

    //创建窗口
    createWindow()

    //新建一个文件
    ipcMain.on('new-md-file', (event, id, defaultPath) => {
        dialog.showSaveDialog({
                                  defaultPath: defaultPath,
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