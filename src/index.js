const {remote, clipboard, ipcRenderer} = require('electron')
const fs = require("fs")
const path = require('path')
const hljs = require('highlight.js')
const DataStore = require('./script/store')
const dataStore = new DataStore()
const Tab = require('./script/tab')
const Toast = require('./script/toast')
const util = require('./script/util')
const relativePath = require('./script/util').relativePath
const htmlTel = require('./script/htmlFileTel')
const marked = require('markdown-it')({
                                          html: true,
                                          xhtmlOut: true,
                                          // linkify: true,
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
    .use(require('markdown-it-sub'))
    .use(require('markdown-it-imsize')) //![](1.png =10x10)
    .use(require('@hikerpig/markdown-it-toc-and-anchor').default, {
        tocPattern: /^\[toc\]/im,
        anchorLink: false
    }) // [TOC]
    .use(require('markdown-it-attrs')) //![](1.png){style=width:200px;height:100px}
    .use(require('markdown-it-task-lists')) //- [x] or - [ ]
    .use(require('markdown-it-texmath').use(require('katex'))) // $、$$
    .use(require('markdown-it-plantuml')) //https://plantuml.com/
//HTML转markdown
const html2md = require('html-to-md')

const tempPath = remote.getGlobal('sharedObject').temp

let scrollSync = dataStore.getScrollSync()

let tabs = new Map() //标签页集合
let tab //当前标签页

let myTabs = $('#myTab')
let myTabsContent = $('#myTabContent')
//不断增长的随机数
let num = 0

//恢复上次设置的主题与代码风格
cutCodeStyle(dataStore.getCodeStyle())
cutHTMLStyle(dataStore.getHTMLStyle())
cutEditorStyle(dataStore.getEditorStyle())
cutNightMode(dataStore.getNightMode())
cutPreviewMode(dataStore.getCutPreview())

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
    tab.getCodeMirror().refresh() //更改CSS样式时刷新编辑器
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

//往输入框的光标处中插入图片
function insertPictureToTextarea(tab, src) {
    insertTextareaValue(tab, '![](' + src + ')')
}

//win路径处理
function pathSep(src) {
    if (path.sep === '\\') {
        src = src.replace(/\\/g, "/")
    }
    return src
}

//往输入框的光标处中插入文字
function insertTextareaValue(tab1, txt) {
    let myCodeMirror = tab1.getCodeMirror()
    myCodeMirror.doc.replaceSelection(txt)
    changeMarkedHTMLValue(tab1, myCodeMirror.doc.getValue())
}

//往输入框的选中的两侧插入文字
function insertTextareaValueTwo(tab1, left, right) {
    let myCodeMirror = tab1.getCodeMirror()
    let selection = myCodeMirror.doc.getSelection()
    myCodeMirror.doc.replaceSelection(left + selection + right, 'around')
    changeMarkedHTMLValue(tab1, myCodeMirror.doc.getValue())
}

//改变输入框的文字
function changeTextareaValue(tab1, txt) {
    const scrollInfo = tab1.getCodeMirror().getScrollInfo()
    let cursor = tab1.getCodeMirror().doc.getCursor()
    tab1.getCodeMirror().doc.setValue(txt)
    changeMarkedHTMLValue(tab1, txt)
    tab1.getCodeMirror().doc.setCursor(cursor)
    tab1.getCodeMirror().scrollTo(scrollInfo.left, scrollInfo.top)
    //刷新一下编辑器
    tab1.getCodeMirror().refresh()
}

// md渲染为html
function changeMarkedHTMLValue(tab1, txt) {
    //处理一些相对路径的图片引用或者win平台路径
    let ntxt = txt
    util.readImgLink(txt, (src) => {
        ntxt = ntxt.replace(src, pathSep(relativePath(tab1.getDirname(), src)))
    })
    tab1.getMarked().innerHTML = marked.render(ntxt) // {baseUrl: tab1.getPath()}
    //是否已保存编辑部分
    tab1.isEditChangeIco(txt)
    //窗口关闭提醒
    remote.getGlobal('sharedObject').closeAllWindow = tab1.isEdit()
    //TOC目录去掉*
    const elements = document.getElementsByClassName('markdownIt-TOC')
    for (const element of elements) {
        element.innerHTML = element.innerHTML.replace(/\n\*\n/g, '\n')
    }
}

//新建一个标签页
function createNewTab(...dataAndPath) {
    let text = dataAndPath[0] || ''
    let filePath = dataAndPath[1] || '未命名' + (num === 0 ? '' : num + 1)
    let tab1 = new Tab(num, text, filePath, document);

    myTabs.append(`
<li id="${tab1.getLiId()}">
    <a href="#${tab1.getPageId()}" id="${tab1.getHeaderId()}" data-id="${tab1.getId()}"
       data-toggle="tab" class="header" draggable="false"></a>
    <i class="glyphicon glyphicon-remove close" id="${tab1.getCloseId()}" 
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
    //注册新的标签
    putTab(tab1.getId(), tab1)
    //一直加
    num++;
    //更新当前标签页
    tab = tab1;

    //窗口头部
    if (tab1.getPath() && tab1.getPath().length > 0) {
        tab1.getHeader().innerHTML = path.basename(tab1.getPath())
    }
    //绑定编辑器
    let myCodeMirror = CodeMirror.fromTextArea(tab1.getTextarea(), {
        lineNumbers: true,
        value: '',
        theme: dataStore.getEditorStyle(),
        mode: 'markdown',
        dragDrop: false,
        lineWrapping: true,
        autofocus: true,
        cursorHeight: 0.8,
        matchBrackets: true,
        indentUnit: 4
    })
    tab1.setCodeMirror(myCodeMirror)
    //填充默认文字
    if (text && text.length > 0) {
        changeTextareaValue(tab1, text)
    }

    //监听页面的输入事件
    let v = text;
    myCodeMirror.on('change', (codeMirror, object) => {
        //实时渲染MD
        if (v !== codeMirror.doc.getValue()) {
            changeMarkedHTMLValue(tab1, codeMirror.doc.getValue())
            v = codeMirror.doc.getValue();
        }
    })
    //以空格替换制表符
    myCodeMirror.setOption("extraKeys", {
        Tab: function (cm) {
            const spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
            cm.replaceSelection(spaces);
        }
    })
    //阻止粘贴事件
    myCodeMirror.on('paste', (codeMirror, event) => {
        event.preventDefault()
    })

    //监听编辑器的滚动事件
    //内容栏滑动
    myCodeMirror.on("scroll", () => {
        if (!scrollSync) {
            return
        }
        const scrollInfo = myCodeMirror.getScrollInfo()
        const height = scrollInfo.height - scrollInfo.clientHeight
        const proportion = scrollInfo.top / height
        const markedHeight = tab1.getMarked().scrollHeight - tab1.getMarked().clientHeight
        tab1.getMarked().scrollTop = markedHeight * proportion;
    })

    //通过点击事件先切换标签
    tab1.getHeader().click()

    //默认字体大小
    editorFontSizeAdjust()
    //显示或关闭行号
    disPlayLineNumber(dataStore.getDisplayLineNumber())
    //默认字体
    changeEditorFontFamily(dataStore.getEditorFontFamily())
    //编辑器获取焦点
    myCodeMirror.focus()
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

//查看语法示例
ipcRenderer.on('look-md-example', (event, args) => {
    //如果当前编辑器已有文字
    if (tab.getTextareaValue() && tab.getTextareaValue().length > 0) {
        createNewTab(args)
    } else { //未编辑
        const tabId = tab.getId()
        createNewTab(args)
        deleteTab(tabId)
    }
})

function openMdFiles(files) {
    for (let i = 0; i < files.length; i++) {
        fs.readFile(files[i], function (err, data) {
            if (err) {
                return console.error(err);
            }
            //如果当前编辑器已有文字
            if (tab.getTextareaValue() && tab.getTextareaValue().length > 0) {
                createNewTab(data.toString(), files[i])
            } else { //未编辑
                const tabId = tab.getId()
                createNewTab(data.toString(), files[i])
                deleteTab(tabId)
            }
        });
    }
}

//打开文件
ipcRenderer.on('open-md-file', (event, files) => {
    openMdFiles(files)
})

//保存某标签的文件
function saveFile(id) {
    let tab1 = getTab(id)
    //是否是绝对路径
    if (tab1.hasPath()) {
        //保存文件
        fs.writeFile(tab1.getPath(), tab1.getTextareaValue(), function (err) {
            if (err) {
                return console.error(err);
            }
        });
        //更新已保存部分
        tab1.setText(tab1.getTextareaValue())
        changeMarkedHTMLValue(tab1, tab1.getTextareaValue())
    } else {
        //提示创建新的文件(输入文件名，路径)
        let s = (tab1.getTextareaValue() + '\n').split('\n')[0].trim()
        ipcRenderer.send('new-md-file', id, util.stringDeal(s))
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
    fs.writeFile(filePath, tab1.getTextareaValue(), function (err) {
        if (err) {
            return console.error(err)
        }
    });
    //新建一个标签打开文件，关掉原标签
    let tab2 = tab1
    createNewTab(tab1.getTextareaValue(), filePath)
    deleteTab(tab2.getId())
})

//重命名文件
ipcRenderer.on('rename-md-file', (event) => {
    remote.dialog.showSaveDialog({
                                     title: '重命名',
                                     defaultPath: tab.getTitle(),
                                     filters: [
                                         {name: 'markdown', extensions: ['md']}
                                     ]
                                 })
        .then(file => {
            if (!file.canceled) { //对话框是否被取消
                const filePath = file.filePath
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
                        createNewTab(tab.getTextareaValue(), filePath)
                        deleteTab(tab1.getId())
                    })
                } else { //未保存，暂时存放路径
                    tab.setPath(filePath)
                }
            }
        })
        .catch(err => {
            console.log(err)
        })
})

//拷贝为MD
ipcRenderer.on('copy-to-md', event => {
    clipboard.writeText(tab.getTextareaValue())
})

//拷贝HTML-Style到粘贴板
function copyHtmlStyle() {
    let range = document.createRange();
    range.selectNodeContents(tab.getMarked());
    let selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    let result = document.execCommand("copy")
    if (!result) {
        console.log('copy fail')
    }
    selection.removeAllRanges()
}

//拷贝为HTML-Style
ipcRenderer.on('copy-to-html-style', event => {
    copyHtmlStyle()
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

function cutEditorStyle(name) {
    document.getElementById('editor-style').href =
        '../node_modules/codemirror/theme/' + name + '.css'
    if (tab && tab.getCodeMirror()) {
        tab.getCodeMirror().setOption('theme', name)
    }
}

//改变编辑器主题样式
ipcRenderer.on('cut-editor-style', (event, args) => {
    cutEditorStyle(args)
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

//插入本地图片
ipcRenderer.on('insert-picture-file', (event, filePaths) => {
    for (let i = 0; i < filePaths.length; i++) {
        //不上传图片
        insertPictureToTextarea(tab, filePaths[i])
    }
})

/*
 * 拖拽图片
 */
document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    for (const f of e.dataTransfer.files) {
        // 拖拽的是MD文件
        if (path.extname(f.path).toLocaleLowerCase() === '.md') {
            openMdFiles(Array.of(f.path))
        }// 拖拽的文件直接引用
        else if (util.isLocalPicture(f.path)) {
            insertPictureToTextarea(tab, f.path)
        }
    }
});
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

/*
 * 粘贴图片\HTML
 */
document.addEventListener('paste', function (event) {
    const items = event.clipboardData && event.clipboardData.items;
    if (!items || items.length < 1) {
        return
    }
    const types = {
        image: 'image',
        rtf: 'rtf',
        html: 'html',
        text: 'text'
    }
    let type
    for (let x of items) {
        if (x.type.indexOf(types.image) !== -1) {
            type = types.image
        } else if (x.type.indexOf(types.rtf) !== -1) {
            type = types.rtf
        } else if (x.type.indexOf(types.html) !== -1) {
            type = types.html
        } else if (x.type.indexOf(types.text) !== -1) {
            type = types.text
        }
    }
    // console.log(type)
    if (type === types.image) {
        // 粘贴图片
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
            insertPictureToTextarea(tab, filePath)
        })
    } else if (type === types.rtf) {
        // 粘贴富文本(转text)
        insertTextareaValue(tab, clipboard.readText())
    } else if (type === types.html) {
        // 粘贴HTML
        const html = clipboard.readHTML()
        insertTextareaValue(tab, html2md(html, {
            emptyTags: ['meta']
        }).trim())
    } else if (type === types.text) {
        // 粘贴纯文本
        insertTextareaValue(tab, clipboard.readText())
    }
})

//=================【快捷键】================

ipcRenderer.on('quick-key-insert-txt', (event, args) => {
    switch (args) {
        case 'CmdOrCtrl+Y':
            tab.getCodeMirror().execCommand('redo')
            break
        case 'CmdOrCtrl+1':
            tab.getCodeMirror().execCommand('goLineStart')
            insertTextareaValue(tab, '# ')
            break
        case 'CmdOrCtrl+2':
            tab.getCodeMirror().execCommand('goLineStart')
            insertTextareaValue(tab, '## ')
            break
        case 'CmdOrCtrl+3':
            tab.getCodeMirror().execCommand('goLineStart')
            insertTextareaValue(tab, '### ')
            break
        case 'CmdOrCtrl+4':
            tab.getCodeMirror().execCommand('goLineStart')
            insertTextareaValue(tab, '#### ')
            break
        case 'CmdOrCtrl+5':
            tab.getCodeMirror().execCommand('goLineStart')
            insertTextareaValue(tab, '##### ')
            break
        case 'CmdOrCtrl+6':
            tab.getCodeMirror().execCommand('goLineStart')
            insertTextareaValue(tab, '######')
            break
        case 'Alt+Command+T' || 'Ctrl+Shift+T':
            //弹出询问框。读取行数和列数
            showTableModal()
            break
        case 'Alt+Command+C' || 'Ctrl+Shift+C':
            insertTextareaValueTwo(tab, '```\n', '\n```')
            break
        case 'CmdOrCtrl+P':
            insertTextareaValue(tab, '![]()')
            break
        case 'Alt+Command+Q' || 'Ctrl+Shift+Q':
            tab.getCodeMirror().execCommand('goLineStart')
            insertTextareaValue(tab, '> ')
            break
        case 'Alt+Command+O' || 'Ctrl+Shift+O':
            tab.getCodeMirror().execCommand('goLineStart')
            insertTextareaValue(tab, '1. ')
            break
        case 'Alt+Command+U' || 'Ctrl+Shift+U':
            tab.getCodeMirror().execCommand('goLineStart')
            insertTextareaValue(tab, '- ')
            break
        case 'Alt+Command+X' || 'Ctrl+Shift+X':
            tab.getCodeMirror().execCommand('goLineStart')
            insertTextareaValue(tab, '- [x] ')
            break
        case 'Alt+Command+-' || 'Ctrl+Shift+-':
            insertTextareaValue(tab, '---')
            break
        case 'CmdOrCtrl+B':
            insertTextareaValueTwo(tab, '**', '**')
            break
        case 'CmdOrCtrl+I':
            insertTextareaValueTwo(tab, '*', '*')
            break
        case 'CmdOrCtrl+0':
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

//弹出表格的输入框
function showTableModal() {
    $('body').append(`
<div class="modal fade in" id="myModal" tabindex="-1" role="dialog" aria-labelledby="myModalLabel"
     aria-hidden="true" style="display: block;">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true"> ×
                </button>
                <h4 class="modal-title" id="myModalLabel"> 插入表格 </h4></div>
            <div class="modal-body"> 
 <div class="container">
   <div class="row" >
      <div class="col-xs-6 col-sm-3">
  <div class="input-group">
   <span class="input-group-addon">行</span>
   <input type="text" id='table-row' class="form-control" placeholder="">
  </div>
    </div>
    <div class="col-xs-6 col-sm-3">
   <div class="input-group">
   <span class="input-group-addon">列</span>
   <input type="text" id="table-col" class="form-control" placeholder="">
  </div>
 </div>
 </div>
 </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="dismissTable()" data-dismiss="modal">取消</button>
                <button type="button" class="btn btn-primary" onclick="readTableInfo()" >确定</button>
            </div>
        </div><!-- /.modal-content --> 
    </div><!-- /.modal --> 
</div>
`)
}

function readTableInfo() {
    // 读取行数、列数
    const row = document.getElementById('table-row').value
    const col = document.getElementById('table-col').value
    //插入MD代码
    insertTextareaValue(tab, util.createTableMD(row, col))
    dismissTable()
}

function dismissTable() {
    // 待删除节点
    const self = document.getElementById('myModal')
    // 拿到父节点
    const parent = self.parentElement
    // 删除
    const removed = parent.removeChild(self)
}

function cutNightMode(args) {
    if (args) {
        document.getElementById('night-mode').setAttribute('href', './css/mode/nightMode.css')
    } else {
        document.getElementById('night-mode').setAttribute('href', './css/mode/null.css')
    }
}

// 切换夜间模式
ipcRenderer.on('cut-night-mode', (event, args) => {
    cutNightMode(args)
})

function refresh() {
    if (tab && tab.getCodeMirror()) {
        tab.getCodeMirror().refresh()
    }
}

function cutPreviewMode(args) {
    if (args) {
        document.getElementById('preview-mode').setAttribute('href', './css/mode/null.css')
    } else {
        document.getElementById('preview-mode').setAttribute('href', './css/mode/PreviewMode.css')
    }
    setTimeout(() => {
        refresh()
    }, 100)
}

// 切换实时预览
ipcRenderer.on('cut-preview-mode', (event, args) => {
    cutPreviewMode(args)
})

// 切换同步滑动
ipcRenderer.on('cut-scroll-sync', (event, args) => {
    scrollSync = args
})

// 字体放大缩小
function editorFontSizeAdjust(target) {
    let oldSize = document.getElementById(tab.getLeftId())
                      .getElementsByClassName('CodeMirror')[0].style['font-size']
                  || dataStore.getEditorFontSize()
    let newSize = parseInt(oldSize)
    switch (target) {
        case '+':
            newSize < 30 ? newSize++ : ''
            break
        case '-':
            newSize > 10 ? newSize-- : ''
            break
    }
    newSize += 'px'
    //应用到每一个标签页
    for (let t of tabs.values()) {
        document.getElementById(t.getLeftId())
            .getElementsByClassName('CodeMirror')[0].style['font-size'] = newSize
        t.getCodeMirror().refresh() //更改CSS样式时刷新编辑器
    }
    dataStore.setEditorFontSize(newSize)
    if (target) {
        Toast.toast(newSize, 'success', 1000)
    }
}

ipcRenderer.on('editor-font-size-adjust', (event, args) => {
    editorFontSizeAdjust(args)
})

// 显示/关闭行号
function disPlayLineNumber(args) {
    if (args) {
        document.getElementById('editorPadding').innerHTML =
            `.CodeMirror{padding-left: 0 !important}`
    } else {
        document.getElementById('editorPadding').innerHTML =
            `.CodeMirror{padding-left: 1em !important}`
    }
    for (let t of tabs.values()) {
        t.getCodeMirror().setOption('lineNumbers', args)
        t.getCodeMirror().refresh() //更改CSS样式时刷新编辑器
    }
}

ipcRenderer.on('display-line-number', (event, args) => {
    disPlayLineNumber(args)
})

// 字数统计
ipcRenderer.on('text-word-count', event => {
    let result = util.stringLength(tab.getCodeMirror().doc.getValue())
    let words = util.findStringWords(tab.getCodeMirror().doc.getValue())
    remote.dialog.showMessageBox({
                                     message: `
                                     中文：${result.chinese}
                                     英文：${result.english}
                                     数字：${result.number}
                                     其它：${result.other}
                                     正文字数：${words}`
                                 }).then()
})

// 更改字体
function changeEditorFontFamily(args) {
    document.getElementById('editorFontFamily').innerHTML =
        `.md2html,.CodeMirror{font-family:${args}, sans-serif !important}`
}

ipcRenderer.on('editor-font-family-adjust', (event, args) => {
    changeEditorFontFamily(args)
})

// 格式化代码
ipcRenderer.on('format-md-code', event => {
    let oldText = tab.getCodeMirror().doc.getSelection()
    let newText = ''
    let objReadline = oldText.split('\n')
    let snum = 0
    for (let i = 0; i < objReadline.length; i++) {
        let line = objReadline[i]
        if (i === 0) {
            for (let j = 0; j < line.length; j++) {
                if (line.charAt(j) === ' ') {
                    snum++
                } else {
                    break
                }
            }
        }
        newText += line.substring(snum)
        if (i !== objReadline.length - 1) {
            newText += '\n'
        }
    }
    tab.getCodeMirror().doc.replaceSelection(newText);
})

//导出为 HTML No Style 文件
ipcRenderer.on('export-html-no-style-file', () => {
    if (tab.getMarked().innerHTML.length < 1) {
        remote.dialog.showMessageBox({message: '没有内容可导出'}).then()
        return
    }
    //导出到 HTML 文件
    remote.dialog.showSaveDialog({
                                     defaultPath: tab.getTitle(),
                                     filters: [
                                         {name: 'html', extensions: ['html']}
                                     ]
                                 })
        .then(file => {
            if (!file.canceled) { //对话框是否被取消
                const filePath = file.filePath
                const data = htmlTel.headerNoStyle(tab.getTitle()) + tab.getMarked().innerHTML
                             + htmlTel.footer
                fs.writeFile(filePath, data, function (err) {
                    if (err) {
                        return console.error(err);
                    }
                    Toast.toast('导出成功', 'success', 3000)
                });
            }
        })
        .catch(err => {
            console.log(err)
        })
})

//导出 HTML
ipcRenderer.on('export-html-file', function () {
    exportHtml()
})

function exportHtml() {
    if (tab.getMarked().innerHTML.length < 1) {
        remote.dialog.showMessageBox({message: '没有内容可导出'}).then()
        return
    }
    //循环直到拷贝成功
    do {
        // console.log('copy')
        clipboard.clear()
        copyHtmlStyle()
    } while (!clipboard.readHTML())
    //导出到HTML文件
    remote.dialog.showSaveDialog({
                                     defaultPath: tab.getTitle(),
                                     filters: [
                                         {name: 'html', extensions: ['html']}
                                     ]
                                 })
        .then(file => {
            if (!file.canceled) { //对话框是否被取消
                const filePath = file.filePath
                const data = htmlTel.header(tab.getTitle()) + clipboard.readHTML() + htmlTel.footer
                fs.writeFile(filePath, data, function (err) {
                    if (err) {
                        return console.error(err);
                    }
                    Toast.toast('导出成功', 'success', 3000)
                });
            }
        })
        .catch(err => {
            console.log(err)
        })
}


// 刷新当前文件内容
ipcRenderer.on('flush-md-file',function () {
    fs.readFile(tab.getPath(), {encoding: 'utf8'} ,function (err, data) {
        if (err) {
            return console.error(err);
        }
        const tabId = tab.getId()
        createNewTab(data, tab.getPath())
        deleteTab(tabId)
    });
})