const {remote, clipboard, ipcRenderer} = require('electron')
const https = require('https');
const urlEncode = require('urlencode')
const fs = require("fs")
const path = require('path')
const hljs = require('highlight.js')
const DataStore = require('./script/store')
const Tab = require('./script/Tab')
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
    insertTextareaValue(tab, '\n![](' + src + ')')
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
        //更新已保存部分与编辑标识
        tab1.setText(tab1.getTextarea().value)
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

//图片防盗链md-img
ipcRenderer.on('picture-md-to-img', () => {
    clipboard.writeText(tab.getTextarea().value) //拷贝原内容
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
            uploadPictureToWeiBo(filePaths[i])
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
            uploadPictureToWeiBo(f.path)
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
                    filePath = tab.getDirname() + Math.floor(Math.random() * 10000000) + '.png'
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
                        uploadPictureToWeiBo(filePath)
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
 */
function uploadPictureToWeiBo(filePath) {
    let image_url = 'https://picupload.weibo.com/interface/pic_upload.php?mime=image%2Fjpeg&data=base64&url=0&markpos=1&logo=&nick=0&marks=1&app=miniblog'
    fs.readFile(filePath, {encoding: 'base64'}, function (err, data) {
        if (err) {
            return console.error(err)
        }

        req.on('error', function (e) {
            console.log('problem with request: ' + e.message);
            alert('problem with request: ' + e.message)
        });

        req.write(image_data)
        req.end()
    })
}

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
        case 'Alt+Command+Q' || 'Ctrl+Shift+Q':
            insertTextareaValue(tab, '\n> ')
            break
        case 'Alt+Command+O' || 'Ctrl+Shift+O':
            insertTextareaValue(tab, '\n1. ')
            break
        case 'Alt+Command+U' || 'Ctrl+Shift+U':
            insertTextareaValue(tab, '\n- ')
            break
        case 'Alt+Command+X' || 'Ctrl+Shift+X':
            insertTextareaValue(tab,
                                '\n- <input type="checkbox" disabled checked> \n- <input type="checkbox" disabled>')
            break
        case 'Alt+Command+-' || 'Ctrl+Shift+-':
            insertTextareaValue(tab, '\n---')
            break
        case 'CmdOrCtrl+B':
            insertTextareaValue(tab, '** **')
            break
        case 'CmdOrCtrl+I':
            insertTextareaValue(tab, '* *')
            break
        case 'CmdOrCtrl+U':
            insertTextareaValue(tab, '<u> </u>')
            break
        case 'Ctrl+`':
            insertTextareaValue(tab, '` `')
            break
        case 'Shift+Ctrl+`':
            insertTextareaValue(tab, '~~ ~~')
            break
        case 'Ctrl+-':
            insertTextareaValue(tab, '<!-- -->')
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
