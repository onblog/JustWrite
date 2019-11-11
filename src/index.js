const {remote, shell, clipboard, ipcRenderer} = require('electron')
const https = require('https');
const request = require('request')
const urlEncode = require('urlencode')
const fs = require("fs")
const path = require('path')
const hljs = require('highlight.js')
const DataStore = require('./script/store')
const Tab = require('./script/tab')
const FormData = require('form-data')
const querystring = require('querystring')
const jsdom = require("jsdom")
const Toast = require('./script/toast')

const download = function (uri, filename, callback) {
    request.head(uri, function (err, res, body) {
        console.log('content-type:', res.headers['content-type']);
        console.log('content-length:', res.headers['content-length']);
        if (!fs.existsSync(path.dirname(filename))) {
            fs.mkdirSync(path.dirname(filename))
        }
        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
};

const marked = require('markdown-it')({
                                          html: true,
                                          xhtmlOut: true,
                                          typographer: true,
                                          highlight: function (str, lang) {
                                              if (lang && hljs.getLanguage(lang)) {
                                                  try {
                                                      return '<pre><code class="hljs">' +
                                                             hljs.highlight(lang, str, true).value +
                                                             '</code></pre>';
                                                  } catch (__) {
                                                  }
                                              }
                                              return '<pre><code class="hljs">'
                                                     + marked.utils.escapeHtml(str)
                                                     + '</code></pre>';
                                          },
                                      })
    .use(require('markdown-it-emoji'))
    .use(require('markdown-it-footnote'))
    .use(require('markdown-it-sup'))
    .use(require('markdown-it-abbr'))
    .use(require('markdown-it-deflist'))
    .use(require('markdown-it-ins'))
    .use(require('markdown-it-mark'))

const tempPath = remote.getGlobal('sharedObject').temp

const dataStore = new DataStore()

//恢复上次设置的主题与代码风格
cutCodeStyle(dataStore.getCodeStyle())
cutHTMLStyle(dataStore.getHTMLStyle())
cutNightMode(dataStore.getNightMode())

let tabs = new Map() //标签页集合
let tab //当前标签页

//控制close图标的显示
function closeDisplay() {
    if (tabs.size === 0) {
        return
    }
    const element = tabs.values().next().value.getClose()
    if (tabs.size > 1) {
        element.style.display = 'block'
    } else {
        element.style.display = 'none'
    }
}

//切换标签页
function cutTab(k) {
    tab = tabs.get(k + '')
    tab.getPage().className = 'tab-pane fade in active'
}

//优雅的获取Tab对象
function getTab(k) {
    return tabs.get(k + '')
}

//注册标签页
function putTab(k, v) {
    tabs.set(k + '', v)
    closeDisplay()
}

//删除标签页
function deleteTab(k) {
    //删除DOM
    $('#' + tabs.get(k + '').getLiId()).remove();
    $('#' + tabs.get(k + '').getPageId()).remove();
    //删除对象
    tabs.delete(k + '')
    closeDisplay()
    //删除标签后默认进入当前页面
    if (tab && tab.getId() !== (k + '')) {

    } else {
        tab = tabs.values().next().value
        tab.getHeader().click()
    }
}

let myTabs = $('#myTab')
let myTabsContent = $('#myTabContent')
//不断增长的随机数
let num = 0

//往输入框的光标处中插入图片
function insertPictureToTextarea(tab, src) {
    insertTextareaValue(tab, '\n![](' + pathSep(src) + ')')
}

//win路径处理
function pathSep(src) {
    if (path.sep === '\\') {
        src = src.replace(/\\/g,"/")
    }
    return src
}

//往输入框的光标处中插入文字
function insertTextareaValue(t, txt) {
    let start = t.getTextarea().selectionStart
    const value = t.getTextarea().value
    let newTxt = value.substring(0, start) + txt + value.substring(start)
    changeTextareaValue(t, newTxt)
    t.getTextarea().selectionStart = start + txt.length
    t.getTextarea().selectionEnd = t.getTextarea().selectionStart
}

//往输入框的选中的两侧插入文字
function insertTextareaValueTwo(t, left, right) {
    let start = t.getTextarea().selectionStart
    let end = t.getTextarea().selectionEnd
    const value = t.getTextarea().value
    let newTxt = value.substring(0, start) + left + value.substring(start, end) + right
                 + value.substring(end)
    changeTextareaValue(t, newTxt)
    t.getTextarea().selectionStart = start + left.length
    t.getTextarea().selectionEnd = t.getTextarea().selectionStart + (end - start)
}

//改变输入框的文字
function changeTextareaValue(t, txt) {
    t.getTextarea().value = txt
    t.getMarked().innerHTML = marked.render(txt) // {baseUrl: t.getPath()}
    //是否已保存编辑部分
    t.isEditChangeIco(txt)
    //窗口关闭提醒
    remote.getGlobal('sharedObject').closeAllWindow = t.isEdit()
}

//新建一个标签页
function createNewTab(...dataAndPath) {
    let text = dataAndPath[0] || ''
    let filePath = dataAndPath[1] || '未命名' + (num === 0 ? '' : num + 1)
    let tab1 = new Tab(num, text, filePath, document);

    myTabs.append(`
<li id="${tab1.getLiId()}">
    <a href="#${tab1.getPageId()}" id="${tab1.getHeaderId()}" data-id="${tab1.getId()}"
       data-toggle="tab" class="header"></a>
    <i class="glyphicon glyphicon-remove close" id="${tab1.getCloseId(num)}" 
    data-id="${tab1.getId()}"></i>
</li>
`)

    myTabsContent.append(`
<div class="tab-pane fade" id="${tab1.getPageId()}">
<div class="container page-header">
   <div class="row" >
      <div id="${tab1.getLeftId()}" class="col-xs-6 col-sm-6 col" style="border-right: 1px solid #f5f5f5;">
          <textarea id="${tab1.getTextareaId()}" data-id="${tab1.getId()}" autocapitalize="none" 
          autocomplete="off" autofocus spellcheck="false" class="form-control editor"></textarea>
       </div>
      <div id="${tab1.getRightId()}" class="col-xs-6 col-sm-6 col">
         <div id="${tab1.getMarkedId()}" data-id="${tab1.getId()}" class="md2html"></div>
      </div>
   </div>
</div>
    </div>
`)

    //窗口头部
    if (tab1.getPath() && tab1.getPath().length > 0) {
        tab1.getHeader().innerHTML = path.basename(tab1.getPath())
    }
    //渲染页面
    let textarea = tab1.getTextarea()
    if (text && text.length > 0) {
        changeTextareaValue(tab1, text)
    }
    //监听页面的输入事件
    let v = text;
    textarea.addEventListener('input', evt => {
        //实时渲染MD
        if (v !== evt.target.value) {
            // if (evt.inputType === 'insertLineBreak'){
            //     insertTextareaValue(tab1,'\n')
            // }
            changeTextareaValue(tab1, evt.target.value)
            v = evt.target.value;
        }
    })

    //TAB键代替4个空格
    textarea.addEventListener('keydown', evt => {
        const TAB = 9
        if (evt.keyCode === TAB) {
            evt.preventDefault();
            insertTextareaValue(tab1, '  ')
        }
    })

    //监听编辑器的滚动事件
    //内容栏滑动
    textarea.addEventListener("scroll", () => {
        const height = tab1.getTextarea().scrollHeight - tab1.getTextarea().clientHeight
        const proportion = tab1.getTextarea().scrollTop / height
        const markedHeight = tab1.getMarked().scrollHeight - tab1.getMarked().clientHeight
        tab1.getMarked().scrollTop = markedHeight * proportion;
    })
    //注册新的标签
    putTab(tab1.getId(), tab1)

    //更新当前标签页
    tab = tab1;

    //一直加
    num++;

    //通过点击事件先切换标签
    tab1.getHeader().click()
}

//初始化标签页
createNewTab()

//事件冒泡,监听标签切换
myTabs.get(0).addEventListener('click', function (event) {
    // event.preventDefault()
    const {dataset, classList} = event.target
    const id = dataset && dataset.id
    //切换标签
    if (id && classList.contains('header')) {
        cutTab(id)
    }
    //关闭标签
    if (id && classList.contains('close') && tabs.size !== 1) {
        if (getTab(id).isEdit()) {
            //是否保存这个文件
            ipcRenderer.send('or-save-md-file', id)
        } else {
            deleteTab(id)
        }
    }
})

//阻止内容页的a标签的点击事件
myTabsContent.get(0).addEventListener('click', function (event) {
    if (event.target.tagName === 'A' && !$(event.target).attr('href').startsWith('#')) {
        event.preventDefault()
    }
})

//已获取是否保存文本的结果
ipcRenderer.on('or-save-md-file-result', (event, result, id) => {
    if (!result) {
        deleteTab(id)
    }
})

//新建标签
ipcRenderer.on('new-tab', (() => {
    createNewTab()
}))

//打开文件
ipcRenderer.on('open-md-file', (event, files) => {
    for (let i = 0; i < files.length; i++) {
        fs.readFile(files[i], function (err, data) {
            if (err) {
                return console.error(err);
            }
            //如果当前编辑器已有文字
            if (tab.getTextarea().value && tab.getTextarea().value.length > 0) {
                createNewTab(data.toString(), files[i])
            } else { //未编辑
                const tabId = tab.getId()
                createNewTab(data.toString(), files[i])
                deleteTab(tabId)
            }
        });
    }
})

//保存某标签的文件
function saveFile(id) {
    let tab1 = getTab(id)
    //是否是绝对路径
    if (tab1.hasPath()) {
        //保存文件
        fs.writeFile(tab1.getPath(), tab1.getTextarea().value, function (err) {
            if (err) {
                return console.error(err);
            }
        });
        //更新已保存部分
        tab1.setText(tab1.getTextarea().value)
        changeTextareaValue(tab1, tab1.getTextarea().value)
    } else {
        //提示创建新的文件(输入文件名，路径)
        ipcRenderer.send('new-md-file', id)
    }
}

//保存文件
ipcRenderer.on('save-md-file', () => {
    saveFile(tab.getId())
})

//新建文件的信息填写完
ipcRenderer.on('new-md-file-complete', (event, filePath, id) => {
    let tab1 = getTab(id)
    //在磁盘新建文件
    fs.writeFile(filePath, tab1.getTextarea().value, function (err) {
        if (err) {
            return console.error(err)
        }
    });
    //新建一个标签打开文件，关掉原标签
    let tab2 = tab1
    createNewTab(tab1.getTextarea().value, filePath)
    deleteTab(tab2.getId())
})

//重命名文件
ipcRenderer.on('rename-md-file', (event, filePath) => {
    if (tab.hasPath()) { //原路径有效
        if (tab.isEdit()) {
            saveFile(tab.getId())
        }
        fs.rename(tab.getPath(), filePath, function (err) {
            if (err) {
                return console.error(err)
            }
            //新建一个标签打开文件，关掉原标签
            let tab1 = tab
            createNewTab(tab.getTextarea().value, filePath)
            deleteTab(tab1.getId())
        })
    } else { //未保存，暂时存放路径
        tab.setPath(filePath)
    }
})

//拷贝为MD
ipcRenderer.on('copy-to-md', event => {
    clipboard.writeText(tab.getTextarea().value)
})
//拷贝为HTML-Style
ipcRenderer.on('copy-to-html-style', event => {
    let range = document.createRange();
    range.selectNodeContents(tab.getMarked());
    let selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    let result = document.execCommand("copy");
    if (!result) {
        console.log('copy fail')
    }
})
//拷贝为HTML
ipcRenderer.on('copy-to-html', event => {
    clipboard.writeText(tab.getMarked().innerHTML)
})

function cutCodeStyle(name) {
    document.getElementById('code-style').href =
        '../node_modules/highlight.js/styles/' + name + '.css'
}

//切换Code-CSS样式
ipcRenderer.on('cut-code-style', (event, name) => {
    cutCodeStyle(name)
})

function cutHTMLStyle(name) {
    document.getElementById('html-style').href = './css/' + name + '.css'
}

//切换HTML-CSS样式
ipcRenderer.on('cut-html-style', (event, name) => {
    cutHTMLStyle(name)
})

//标题栏滑动
myTabs.get(0).onwheel = function (event) {
    //禁止事件默认行为（此处禁止鼠标滚轮行为关联到"屏幕滚动条上下移动"行为）
    event.preventDefault();
    //设置鼠标滚轮滚动时屏幕滚动条的移动步长
    let step = 50;
    if (event.deltaY < 0) {
        //向上滚动鼠标滚轮，屏幕滚动条左移
        this.scrollLeft -= step;
    } else {
        //向下滚动鼠标滚轮，屏幕滚动条右移
        this.scrollLeft += step;
    }
}

//==========================【图片处理】===========

function copyValueToClipboard() {
    clipboard.writeText(tab.getTextarea().value) //拷贝原内容
    remote.dialog.showMessageBox({type: 'none', message: '原内容已拷贝到剪贴板', buttons: ['OK']}).then()
}

//图片防盗链md-img
ipcRenderer.on('picture-md-to-img', () => {
    copyValueToClipboard()
    let objReadline = tab.getTextarea().value.split('\n')
    let newValue = ''
    objReadline.forEach(line => {
        const split = line.indexOf('!') !== -1 ? line.split('!') : []
        for (let i = 0; i < split.length; i++) {
            if (split[i].length > 4 && split[i].indexOf('[') !== -1 && split[i].indexOf(']') !== -1
                && split[i].indexOf('(') !== -1 && split[i].indexOf(')') !== -1) {
                const start = split[i].lastIndexOf('(')
                const end = split[i].lastIndexOf(')')
                let s1 = split[i].substring(start + 1, end)
                line =
                    line.replace("!" + split[i], `<img src="${s1}" referrerPolicy="no-referrer"/>`)
            }
        }
        newValue += line + '\n'
    })
    changeTextareaValue(tab, newValue)
})

//切换图片上传的开关
ipcRenderer.on('cut-weiBo-upload', (event, name) => {
    dataStore.setWeiBoUpload(name)
})

//插入本地图片
ipcRenderer.on('insert-picture-file', (event, filePaths) => {
    for (let i = 0; i < filePaths.length; i++) {
        //是否开启图片自动上传功能
        if (dataStore.getWeiBoUpload()) {
            //上传图片
            uploadPictureToWeiBo(filePaths[i], (src) => {
                insertPictureToTextarea(tab, src)
            })
        } else {
            //不上传图片
            insertPictureToTextarea(tab, filePaths[i])
        }
    }
})

/*
 * 拖拽图片
 */
document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    for (const f of e.dataTransfer.files) {
        //是否开启图片自动上传功能
        if (dataStore.getWeiBoUpload()) {
            //上传图片
            uploadPictureToWeiBo(f.path, (src) => {
                insertPictureToTextarea(tab, src)
            })
        } else {
            //不上传图片
            insertPictureToTextarea(tab, f.path)
        }
    }
});
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

/*
 * 粘贴图片
 */
document.addEventListener('paste', function (event) {
    const items = event.clipboardData && event.clipboardData.items;
    if (items && items.length) {
        // 检索剪切板items
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                // file = items[i].getAsFile();
                const image = clipboard.readImage()
                const buffer = image.toPNG();
                let filePath
                if (tab.hasPath()) {
                    filePath = tab.getPictureDir() + Math.floor(Math.random() * 10000000) + '.png'
                } else {
                    filePath = tempPath + Math.floor(Math.random() * 10000000) + '.png'
                }
                fs.writeFile(filePath, buffer, (err) => {
                    if (err) {
                        return console.error(err);
                    }
                    //是否开启图片自动上传功能
                    if (dataStore.getWeiBoUpload()) {
                        //上传图片
                        uploadPictureToWeiBo(filePath, (src) => {
                            insertPictureToTextarea(tab, src)
                        })
                    } else {
                        insertPictureToTextarea(tab, filePath)
                    }
                })
                break;
            }
        }
    }
});

/**
 * 上传图片到新浪微博
 * @param filePath
 * @param callback
 */
function uploadPictureToWeiBo(filePath, callback) {
    let image_url = 'https://picupload.weibo.com/interface/pic_upload.php?mime=image%2Fjpeg&data=base64&url=0&markpos=1&logo=&nick=0&marks=1&app=miniblog'
    fs.readFile(filePath, {encoding: 'base64'}, function (err, data) {
        if (err) {
            return console.error(err)
        }
        const image_data = 'b64_data=' + urlEncode(data)
        let options = {
            host: 'picupload.weibo.com',
            method: 'POST',
            headers: {
                'Accept-Encoding': 'gzip, deflate, br',
                "Accept-Language": "zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3",
                'Referer': 'https://weibo.com/',
                'Accept': '*/*',
                'Origin': 'https://weibo.com',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(image_data),
                'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:45.0) Gecko/20100101 Firefox/45.0',
                'Cookie': dataStore.getWeiBoCookies()
            }
        }

        let req = https.request(image_url, options, function (res) {
            // console.log('STATUS: ' + res.statusCode);
            res.setEncoding('utf8');
            const prefix = 'http://ww3.sinaimg.cn/large/'
            res.on('data', function (chunk) {
                // console.log('BODY: ' + chunk);
                let start = chunk.toString().indexOf('script>') + 'script>'.length
                const text = chunk.toString().substring(start).trim()
                // console.log(text)
                const parse = JSON.parse(text)
                const pid = parse.data.pics.pic_1.pid
                const src = prefix + pid + '.jpg'
                // console.log(src)
                if (pid === undefined || pid === null) {
                    alert('请先登录新浪微博')
                } else {
                    callback(src)
                }
            });
        });

        req.on('error', function (e) {
            console.log('problem with request: ' + e.message);
            alert('problem with request: ' + e.message)
        });

        req.write(image_data)
        req.end()
    })
}

//一键网图下载
function downloadNetPicture() {
    if (!tab.hasPath()) {
        remote.dialog.showMessageBox({message: '文件尚未保存至本地'}).then()
        return
    }
    copyValueToClipboard() //拷贝原内容
    let objReadline = tab.getTextarea().value.split('\n')
    for (let i = 0; i < objReadline.length; i++) {
        let line = objReadline[i] + ''
        const split = line.indexOf('!') !== -1 ? line.split('!') : []
        for (let i = 0; i < split.length; i++) {
            let block = split[i]
            if (block.length > 4 && block.indexOf('[') !== -1 && block.indexOf(']') !== -1
                && block.indexOf('(') !== -1 && block.indexOf(')') !== -1) {
                const start = block.lastIndexOf('(')
                const end = block.lastIndexOf(')')
                const src = block.substring(start + 1, end) //图片地址
                if (isWebPicture(src)) {
                    let newSrc = tab.getPictureDir() + path.basename(src)
                    download(src, newSrc, function () {
                        changeTextareaValue(tab, tab.getTextarea().value.replace(src, pathSep(newSrc))) //处理下win系统路径
                        Toast.toast('下载成功+1', 'success', 3000)
                    });
                }
            }
        }
    }
}

ipcRenderer.on('download-net-picture', () => {
    downloadNetPicture()
})

//一键图片上传
function uploadAllPictureToWeiBo() {
    copyValueToClipboard() //拷贝原内容
    let objReadline = tab.getTextarea().value.split('\n')
    for (let i = 0; i < objReadline.length; i++) {
        let line = objReadline[i] + ''
        const split = line.indexOf('!') !== -1 ? line.split('!') : []
        for (let i = 0; i < split.length; i++) {
            let block = split[i]
            if (block.length > 4 && block.indexOf('[') !== -1 && block.indexOf(']') !== -1
                && block.indexOf('(') !== -1 && block.indexOf(')') !== -1) {
                const start = block.lastIndexOf('(')
                const end = block.lastIndexOf(')')
                const src = block.substring(start + 1, end) //图片地址
                if (path.isAbsolute(src)) {
                    uploadPictureToWeiBo(src, href => {
                        changeTextareaValue(tab, tab.getTextarea().value.replace(src, href))
                        Toast.toast('上传成功+1', 'success', 3000)
                    })
                }
            }
        }
    }
}

ipcRenderer.on('upload-all-picture-to-weiBo', event => {
    uploadAllPictureToWeiBo()
})

//一键图片整理到picture文件夹
function movePictureToFolder() {
    let objReadline = tab.getTextarea().value.split('\n')
    for (let i = 0; i < objReadline.length; i++) {
        let line = objReadline[i] + ''
        const split = line.indexOf('!') !== -1 ? line.split('!') : []
        for (let i = 0; i < split.length; i++) {
            let block = split[i]
            if (block.length > 4 && block.indexOf('[') !== -1 && block.indexOf(']') !== -1
                && block.indexOf('(') !== -1 && block.indexOf(')') !== -1) {
                const start = block.lastIndexOf('(')
                const end = block.lastIndexOf(')')
                const src = block.substring(start + 1, end) //图片地址
                let newSrc = tab.getPictureDir() + path.basename(src)
                if (path.isAbsolute(src) && src !== newSrc) { //拷贝文件
                    fs.copyFile(src, newSrc, (err) => {
                        if (err) {
                            return console.error(err)
                        }
                        changeTextareaValue(tab,tab.getTextarea().value.replace(src, pathSep(newSrc)))
                        Toast.toast('整理成功+1', 'success', 3000)
                    });
                }
            }
        }
    }
}

ipcRenderer.on('move-picture-to-folder', event => {
    movePictureToFolder()
})

//导出打印pdf
ipcRenderer.on('export-pdf-file', function () {
    $(tab.getMarked()).print({
                                 addGlobalStyles: true,
                                 stylesheet: null,
                                 rejectWindow: true,
                                 noPrintSelector: ".no-print",
                                 iframe: true,
                                 append: null,
                                 prepend: null,
                                 deferred: $.Deferred().done(() => {
                                     //回调
                                 })
                             });
})

//快捷键
ipcRenderer.on('quick-key-insert-txt', (event, args) => {
    switch (args) {
        case 'CmdOrCtrl+1':
            insertTextareaValue(tab, '# ')
            break
        case 'CmdOrCtrl+2':
            insertTextareaValue(tab, '## ')
            break
        case 'CmdOrCtrl+3':
            insertTextareaValue(tab, '### ')
            break
        case 'CmdOrCtrl+4':
            insertTextareaValue(tab, '#### ')
            break
        case 'CmdOrCtrl+5':
            insertTextareaValue(tab, '##### ')
            break
        case 'CmdOrCtrl+6':
            insertTextareaValue(tab, '######')
            break
        case 'Alt+Command+T' || 'Ctrl+Shift+T':
            insertTextareaValue(tab, '\n|   -   |      |\n'
                                     + '| ---- | ---- |\n'
                                     + '|   -   |      |\n')
            break
        case 'Alt+Command+C' || 'Ctrl+Shift+C':
            insertTextareaValue(tab, '\n```\n\n```')
            break
        case 'CmdOrCtrl+P':
            insertTextareaValue(tab, '![]()')
            break
        case 'Alt+Command+Q' || 'Ctrl+Shift+Q':
            insertTextareaValue(tab, '> ')
            break
        case 'Alt+Command+O' || 'Ctrl+Shift+O':
            insertTextareaValue(tab, '1. ')
            break
        case 'Alt+Command+U' || 'Ctrl+Shift+U':
            insertTextareaValue(tab, '- ')
            break
        case 'Alt+Command+X' || 'Ctrl+Shift+X':
            insertTextareaValue(tab,
                                '- <input type="checkbox" disabled checked> \n- <input type="checkbox" disabled>')
            break
        case 'Alt+Command+-' || 'Ctrl+Shift+-':
            insertTextareaValue(tab, '\n---')
            break
        case 'CmdOrCtrl+B':
            insertTextareaValueTwo(tab, '**', '**')
            break
        case 'CmdOrCtrl+I':
            insertTextareaValueTwo(tab, '*', '*')
            break
        case 'CmdOrCtrl+U':
            insertTextareaValueTwo(tab, '<u>', '</u>')
            break
        case 'Ctrl+`':
            insertTextareaValueTwo(tab, '`', '`')
            break
        case 'Shift+Ctrl+`':
            insertTextareaValueTwo(tab, '~~', '~~')
            break
        case 'Ctrl+-':
            insertTextareaValueTwo(tab, '<!--', '-->')
            break
        case 'CmdOrCtrl+K':
            insertTextareaValue(tab, '[]()')
            break
    }
})

function cutNightMode(args) {
    if (args) {
        document.getElementById('night-mode').setAttribute('href', './css/nightMode.css')
    } else {
        document.getElementById('night-mode').setAttribute('href', '')
    }
}

//切换夜间模式
ipcRenderer.on('cut-night-mode', (event, args) => {
    cutNightMode(args)
})

//是否是网络图片
function isWebPicture(src) {
    return src.startsWith('http') && (src.endsWith('png') || src.endsWith('jpg')
                                      || src.endsWith('png') || src.endsWith('jpeg')
                                      || src.endsWith('gif') || src.endsWith('bmp'));
}

//==========================发布【博客园】===========

//上传图片到博客园
function uploadPictureToCnBlog(filePath) {
    let formData = new FormData()
    formData.append('imageFile', fs.createReadStream(filePath)) //'file'是服务器接受的key
    formData.append("host", 'www.cnblogs.com')
    formData.append("uploadType", 'Paste')

    let headers = formData.getHeaders() //这个不能少
    headers.Cookie = dataStore.getCnBlogCookies()
    //自己的headers属性在这里追加
    return new Promise((resolve, reject) => {
        let request = https.request({
                                        host: 'upload.cnblogs.com',
                                        method: 'POST',
                                        path: '/imageuploader/CorsUpload',
                                        headers: headers
                                    }, function (res) {
            let str = '';
            res.on('data', function (buffer) {
                       str += buffer;//用字符串拼接
                   }
            );
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const result = JSON.parse(str);
                    //上传之后result就是返回的结果
                    // console.log(result)
                    if (result.success) {
                        resolve(result.message)
                    } else {
                        remote.dialog.showMessageBox({message: result.message}).then()
                    }
                }
            });
        });
        formData.pipe(request)
    })
}

const cnBlog_url = 'https://i.cnblogs.com/EditPosts.aspx?opt=1'

//发布文章到博客园
function publishArticleToCnBlog(title, content) {
    https.get(cnBlog_url, {
        headers: {
            'Cookie': dataStore.getCnBlogCookies()
        }
    }, res => {
        let str = '';
        res.on('data', function (buffer) {
            str += buffer;//用字符串拼接
        })
        res.on('end', () => {
            //上传之后result就是返回的结果
            const dom = new jsdom.JSDOM(str);
            const input = dom.window.document.body.querySelector('#__VIEWSTATE')
            if (!input.value) {
                remote.dialog.showMessageBox({message: '请先登录博客园'}).then()
                return
            }
            //真正发布文章
            publishArticleToCnBlogFact(title, content, input.value)
        });
    })
}

function publishArticleToCnBlogFact(title, content, VIEWSTATE) {
    const data = querystring.stringify({
                                           '__VIEWSTATE': VIEWSTATE,
                                           '__VIEWSTATEGENERATOR': 'FE27D343',
                                           'Editor$Edit$txbTitle': title,
                                           'Editor$Edit$EditorBody': content,
                                           'Editor$Edit$Advanced$chkDisplayHomePage': 'on',
                                           'Editor$Edit$Advanced$chkComments': 'on',
                                           'Editor$Edit$Advanced$chkMainSyndication': 'ob',
                                           'Editor$Edit$Advanced$rblPostType': '1',
                                           'Editor$Edit$Advanced$txbEntryName': '',
                                           'Editor$Edit$Advanced$txbExcerpt': '',
                                           'Editor$Edit$Advanced$txbTag': '',
                                           'Editor$Edit$Advanced$tbEnryPassword': '',
                                           'Editor$Edit$lkbDraft': '存为草稿'
                                       })

    let options = {
        method: 'POST',
        headers: {
            'Accept-Encoding': 'gzip, deflate, br',
            "Accept-Language": "zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3",
            'Referer': 'https://i.cnblogs.com',
            'Accept': '*/*',
            'Origin': 'https://i.cnblogs.com',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length,
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:45.0) Gecko/20100101 Firefox/45.0',
            'Cookie': '_ga=GA1.2.378664483.1573036607; .Cnblogs.AspNetCore.Cookies=CfDJ8DeHXSeUWr9KtnvAGu7_dX95wlHde__jqJcU4QExtpAJ0423pUAjL3oXOeInKS5Y3dsBdo_lJD0QHRS9s_FBTrhZ10QzgKXVUtaEs0HMqM1j6WFat4EL7btfAtI55t72N2VkqNF8zX_84oV4Hp1lNULZdOrIOyCt-naLpk_frT53m0l3AvQIvthq41E8iaXxR7YwBA60w4dLB_9yKeuLFomAYR1nro5BuecBqM3R7IQO95P_spaiR2yZU41qjhXC9C2cMxd4wci4HBqg6INTVNDX0pK3pzSqM_CBWBpPDNNsnuLkZ80aaqNxqRAHnYwDUiIiVVLijscUd6TNk5HwbRYAgvYySnKe5D0K6N2bAqLTII7ZTJp5LZyn7EqejLRk_cRddzEbaaQ4Do2y1HDKKdaJAwRz-XGSv90pUFrQzVVaOoyyEaDDiQrJpArL6SsvbI8dA-2iRyro8PKWXzpQQQw5tnGrDKTG8Z1Eg_NM9OnX13hw-UqZNc3N9MBn1VxCCWZZqXKlJhHyVxJNZs1yCw33Iwi-RjbdT1lNyaL2GwmrfbRj3AUisXa0ksSUpAlkfg; .CNBlogsCookie=C0D9E892081F47229EAB3DAF4C600DB0B83FA832B7B8F0DA3860C09713F92A907B3284EFF6B78D2EC4AB7390B7EEF35183355CCE26C42C3C12FF7BC00E44752ABF71E475612875440AB2B275DDBE57A02655B6CB; _gid=GA1.2.1771240809.1573179746'

        }
    }

    let req = https.request(cnBlog_url, options, function (res) {
        console.log('STATUS: ' + res.statusCode);
        if (res.statusCode === 302) {
            //发布成功
            res.setEncoding('utf-8')
            let str = ''
            res.on('data', function (chunk) {
                str += chunk
            });
            res.on('end', () => {
                const dom = new jsdom.JSDOM(str);
                const a = dom.window.document.body.getElementsByTagName('a')[0]
                // console.log('BODY: ' + a.href)
                shell.openExternal('https://i.cnblogs.com' + a.href).then()
            });
        } else {
            //发布失败
            remote.dialog.showMessageBox({message: '发布失败！\n原因可能是：未登录博客园账号或者发布的标题重复'}).then()
        }
    })

    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
        alert('problem with request: ' + e.message)
    });

    req.write(data)
    req.end()
}

//将当前文章内容发布到博客园
ipcRenderer.on('publish-article-to-cnblogs', () => {
    if (!tab.hasPath()) {
        remote.dialog.showMessageBox({message: '文章尚未保存至本地'}).then()
        return
    }
    if (!dataStore.getCnBlogCookies()) {
        remote.dialog.showMessageBox({message: '请先登录博客园'}).then()
        return
    }
    (async () => {
        //第一步：将所有本地图片上传至博客园
        let objReadline = tab.getTextarea().value.split('\n')
        let newValue = ''
        for (let i = 0; i < objReadline.length; i++) {
            let line = objReadline[i] + ''
            const split = line.indexOf('!') !== -1 ? line.split('!') : []
            for (let i = 0; i < split.length; i++) {
                let block = split[i]
                if (block.length > 4 && block.indexOf('[') !== -1 && block.indexOf(']') !== -1
                    && block.indexOf('(') !== -1 && block.indexOf(')') !== -1) {
                    const start = block.lastIndexOf('(')
                    const end = block.lastIndexOf(')')
                    const src = block.substring(start + 1, end) //图片地址
                    if (!isWebPicture(src)) {
                        await uploadPictureToCnBlog(src).then(value => { //上传图片
                            line = line.replace(src, value)
                        })
                    }
                }
            }
            newValue += line + '\n'
        }
        //第二步：将最终的文本+标题发布到博客园
        publishArticleToCnBlog(tab.getTitle(), newValue)
    })();
})

//==========================发布【CSDN】===========

//上传图片到CSDN
function uploadPictureToCSDN(filePath) {
    let formData = new FormData();
    formData.append('file', fs.createReadStream(filePath))

    let headers = formData.getHeaders()
    headers.Cookie = dataStore.getCSDNCookies()
    //自己的headers属性在这里追加
    return new Promise((resolve, reject) => {
        let request = https.request({
                                        host: 'mp.csdn.net',
                                        method: 'POST',
                                        path: '/UploadImage?shuiyin=2',
                                        headers: headers
                                    }, function (res) {
            let str = '';
            res.on('data', function (buffer) {
                       str += buffer;
                   }
            );
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const result = JSON.parse(str);
                    //上传之后result就是返回的结果
                    console.log(result)
                    if (result.result === 1) {
                        resolve(result.url.substring(0, result.url.indexOf('?')))
                    } else {
                        remote.dialog.showMessageBox({message: result.content}).then()
                    }
                }
            });
        });
        formData.pipe(request)
    })
}

//上传文章到CSDN
function publishArticleToCSDN(title, markdowncontent, content) {
    let formData = new FormData();
    formData.append('title', title)
    formData.append('markdowncontent', markdowncontent)
    formData.append('content', content)
    formData.append('id', '')
    formData.append('readType', 'public')
    formData.append('tags', '')
    formData.append('status', 2)
    formData.append('categories', '')
    formData.append('type', '')
    formData.append('original_link', '')
    formData.append('authorized_status', 'undefined')
    formData.append('articleedittype', 1)
    formData.append('Description', '')
    formData.append('resource_url', '')
    formData.append('csrf_token', '')

    let headers = formData.getHeaders()
    headers.Cookie = dataStore.getCSDNCookies()
    //自己的headers属性在这里追加
    let request = https.request({
                                    host: 'mp.csdn.net',
                                    method: 'POST',
                                    path: '/mdeditor/saveArticle',
                                    headers: headers
                                }, function (res) {
        let str = '';
        res.on('data', function (buffer) {
                   str += buffer;
               }
        );
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log(str)
                const result = JSON.parse(str);
                //上传之后result就是返回的结果
                console.log(result)
                if (result.status) {
                    shell.openExternal(result.data.url).then()
                } else {
                    remote.dialog.showMessageBox({message: result.content}).then()
                }
            }
        });
    });
    formData.pipe(request)
}

//将当前文章内容发布到CSDN
ipcRenderer.on('publish-article-to-csdn', () => {
    if (!tab.hasPath()) {
        remote.dialog.showMessageBox({message: '文章尚未保存至本地'}).then()
        return
    }
    if (!dataStore.getCSDNCookies()) {
        remote.dialog.showMessageBox({message: '请先登录CSDN'}).then()
        return
    }
    (async () => {
        //第一步：将所有本地图片上传至CSDN
        let objReadline = tab.getTextarea().value.split('\n')
        let newValue = ''
        for (let i = 0; i < objReadline.length; i++) {
            let line = objReadline[i] + ''
            const split = line.indexOf('!') !== -1 ? line.split('!') : []
            for (let i = 0; i < split.length; i++) {
                let block = split[i]
                if (block.length > 4 && block.indexOf('[') !== -1 && block.indexOf(']') !== -1
                    && block.indexOf('(') !== -1 && block.indexOf(')') !== -1) {
                    const start = block.lastIndexOf('(')
                    const end = block.lastIndexOf(')')
                    const src = block.substring(start + 1, end) //图片地址
                    if (!isWebPicture(src)) {
                        await uploadPictureToCSDN(src).then(value => { //上传图片
                            line = line.replace(src, value)
                        })
                    }
                }
            }
            newValue += line + '\n'
        }
        //第二步：将最终的文本+标题发布到CSDN
        publishArticleToCSDN(tab.getTitle(), newValue, marked.render(newValue))
    })();
})

//==========================发布【知乎】===========

//==========================发布【掘金】===========