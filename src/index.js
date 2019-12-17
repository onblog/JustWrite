const {remote, clipboard, ipcRenderer} = require('electron')
const request = require('request')
const fs = require("fs")
const path = require('path')
const hljs = require('highlight.js')
const DataStore = require('./script/store')
const dataStore = new DataStore()
const Tab = require('./script/tab')
const Toast = require('./script/toast')
const util = require('./script/util')
const htmlTel = require('./script/htmlTel')
const weibo = require('./script/weibo')
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

const segmentfault = require('./blogs/segmentfault')
const cnblogs = require('./blogs/cnblogs')
const csdn = require('./blogs/csdn')
const juejin = require('./blogs/juejin')
const oschina = require('./blogs/oschina')

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
    insertTextareaValue(tab, '![](' + pathSep(src) + ')')
}

//win路径处理
function pathSep(src) {
    if (path.sep === '\\') {
        src = src.replace(/\\/g, "/")
    }
    return src
}

//往输入框的光标处中插入文字
function insertTextareaValue(t, txt) {
    let myCodeMirror = t.getCodeMirror()
    myCodeMirror.doc.replaceSelection(txt)
    changeTextareaValueAfter(t, myCodeMirror.doc.getValue())
}

//往输入框的选中的两侧插入文字
function insertTextareaValueTwo(t, left, right) {
    let myCodeMirror = t.getCodeMirror()
    let selection = myCodeMirror.doc.getSelection()
    myCodeMirror.doc.replaceSelection(left + selection + right, 'around')
    changeTextareaValueAfter(t, myCodeMirror.doc.getValue())
}

//改变输入框的文字
function changeTextareaValue(t, txt) {
    const scrollInfo = t.getCodeMirror().getScrollInfo()
    let cursor = t.getCodeMirror().doc.getCursor()
    t.getCodeMirror().doc.setValue(txt)
    changeTextareaValueAfter(t, txt)
    t.getCodeMirror().doc.setCursor(cursor)
    t.getCodeMirror().scrollTo(scrollInfo.left, scrollInfo.top)
}

// md渲染为html
function changeTextareaValueAfter(t, txt) {
    //处理一些相对路径的图片引用
    let ntxt = txt
    util.readImgLink(txt, (src) => {
        ntxt = ntxt.replace(src, relativePath(src))
    })
    t.getMarked().innerHTML = marked.render(ntxt) // {baseUrl: t.getPath()}
    //是否已保存编辑部分
    t.isEditChangeIco(txt)
    //窗口关闭提醒
    remote.getGlobal('sharedObject').closeAllWindow = t.isEdit()
    //TOC目录去掉*
    const elements = document.getElementsByClassName('markdownIt-TOC')
    for (const element of elements) {
        element.innerHTML = element.innerHTML.replace(/\n\*\n/g, '\n')
    }
    //刷新一下编辑器
    t.getCodeMirror().refresh()
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
    })
    tab1.setCodeMirror(myCodeMirror)
    //填充默认文字
    if (text && text.length > 0) {
        changeTextareaValue(tab1, text)
    }
    // setTimeout(() => {
    //     myCodeMirror.refresh() //刷新字体的会刷新，此处注释掉
    // }, 100)

    //监听页面的输入事件
    let v = text;
    myCodeMirror.on('change', (codeMirror, object) => {
        //实时渲染MD
        if (v !== codeMirror.doc.getValue()) {
            changeTextareaValueAfter(tab1, codeMirror.doc.getValue())
            v = codeMirror.doc.getValue();
        }
    });
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
        changeTextareaValueAfter(tab1, tab1.getTextareaValue())
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

//返回图片的真实路径
function relativePath(str) {
    if (str.indexOf('.') === 0) {
        return tab.getDirname() + str
    }
    return path.normalize(str)
}

//图片防盗链md-img
ipcRenderer.on('picture-md-to-img', () => {
    let objReadline = tab.getTextareaValue().split('\n')
    let newValue = ''
    objReadline.forEach(line => {
        const split = line.indexOf('!') !== -1 ? line.split('!') : []
        for (let i = 0; i < split.length; i++) {
            if (split[i].length > 4 && split[i].indexOf('[') !== -1 && split[i].indexOf(']') !== -1
                && split[i].indexOf('(') !== -1 && split[i].indexOf(')') !== -1) {
                const start = split[i].lastIndexOf('(')
                const end = split[i].lastIndexOf(')')
                let s1 = split[i].substring(start + 1, end) //图片的真实地址
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
            weibo.uploadPictureToWeiBo(filePaths[i], (src) => {
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
        if (path.extname(f.path) === '.md') {
            openMdFiles(Array.of(f.path))
            continue
        }
        //是否开启图片自动上传功能
        if (dataStore.getWeiBoUpload()) {
            //上传图片
            weibo.uploadPictureToWeiBo(f.path, (src) => {
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
            //是否开启图片自动上传功能
            if (dataStore.getWeiBoUpload()) {
                //上传图片
                weibo.uploadPictureToWeiBo(filePath, (src) => {
                    insertPictureToTextarea(tab, src)
                })
            } else {
                insertPictureToTextarea(tab, filePath)
            }
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

const download = function (uri, filename, callback) {
    request.head(uri, function (err, res, body) {
        if (err) {
            Toast.toast(err, 'danger', 3000)
        }
        if (!fs.existsSync(path.dirname(filename))) {
            fs.mkdirSync(path.dirname(filename))
        }
        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    });
};

//一键网图下载
function downloadNetPicture() {
    if (!tab.hasPath()) {
        remote.dialog.showMessageBox({message: '文件尚未保存至本地'}).then()
        return
    }
    util.readImgLink(tab.getTextareaValue(), (src) => {
        if (util.isWebPicture(src)) {
            let newSrc = tab.getPictureDir() + path.basename(src)
            download(src, newSrc, function () {
                changeTextareaValue(tab,
                                    tab.getTextareaValue().replace(src, pathSep(newSrc))) //处理下win系统路径
                Toast.toast('下载成功+1', 'success', 3000)
            });
        }
    })
}

ipcRenderer.on('download-net-picture', () => {
    downloadNetPicture()
})

//一键图片上传
function uploadAllPictureToWeiBo() {
    let tip = {up: true}
    util.readImgLink(tab.getTextareaValue(), (src) => {
        const all_src = relativePath(src) //图片的真实路径
        if (path.isAbsolute(all_src)) {
            weibo.uploadPictureToWeiBo(all_src, href => {
                                           changeTextareaValue(tab, tab.getTextareaValue().replace(src, href))
                                           Toast.toast('上传成功+1', 'success', 3000)
                                       }, () => {
                                           if (tip.up) {
                                               remote.dialog.showMessageBox({message: '请先登录新浪微博'}).then()
                                               tip.up = false
                                           }
                                       }
            )
        }
    })
}

ipcRenderer.on('upload-all-picture-to-weiBo', event => {
    uploadAllPictureToWeiBo()
})

//一键图片整理到picture文件夹
function movePictureToFolder() {
    util.readImgLink(tab.getTextareaValue(), (src) => {
        const all_src = relativePath(src) //图片的真实路径
        const new_src = relativePath(tab.getPictureDir() + path.basename(src)) //新的图片路径
        const relativeSrc = tab.getPictureDirRelative() + path.basename(src) //相对路径
        if (path.isAbsolute(all_src)) { //拷贝文件
            if (all_src !== new_src) {
                fs.copyFile(all_src, new_src, (err) => {
                    if (err) {
                        return console.error(err)
                    }
                    changeTextareaValue(tab,
                                        tab.getTextareaValue().replace(src, pathSep(relativeSrc)))
                    Toast.toast('整理成功+1', 'success', 3000)
                });
            } else {
                changeTextareaValue(tab,
                                    tab.getTextareaValue().replace(src, pathSep(relativeSrc)))
                Toast.toast('整理成功+1', 'success', 3000)
            }
        }
    })
}

ipcRenderer.on('move-picture-to-folder', event => {
    movePictureToFolder()
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
            insertTextareaValue(tab, '\n|   -   |      |\n'
                                     + '| ---- | ---- |\n'
                                     + '|   -   |      |\n')
            break
        case 'Alt+Command+C' || 'Ctrl+Shift+C':
            insertTextareaValue(tab, '```\n\n```')
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

// 切换夜间模式
ipcRenderer.on('cut-night-mode', (event, args) => {
    cutNightMode(args)
})

function cutPreviewMode(args) {
    if (args) {
        document.getElementById('preview-mode').setAttribute('href', '')
    } else {
        document.getElementById('preview-mode').setAttribute('href', './css/PreviewMode.css')
    }
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
            `.CodeMirror{padding: 1em 1em 1em 0 !important}`
    } else {
        document.getElementById('editorPadding').innerHTML =
            `.CodeMirror{padding: 1em !important}`
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

//关注微信公众号回复验证码解锁APP
$(function () {
    if (!dataStore.isLogin()) {
        $('body').append(`
<div id="gzh" style="position: fixed;align-content: center;text-align: center;width: 40%;height: 60%;z-index: 9;left: 30%;bottom: 20%;">
    <p style="margin: 0;">扫码关注微信公众号回复<span style="color: red;">VIP</span>获取验证码</p>
    <input type="text" id="key"/>
    <input type="submit" value="提交" onclick="loginApp()"/>
    <img src="./image/gzh.png" style="padding: 0 50px;" />
</div>`)
    }
})

function loginApp() {
    const key = $('input[id=key]').val()
    $.ajax({
               url: `http://www.onblogs.cn/authcode?code=${key}&group=justwrite`,
               type: 'POST',
               dataType: 'text',
               success: function (result) { //成功响应的结果
                   if (result === 'true') {
                       dataStore.login()
                       $('#gzh').remove()
                       Toast.toast('验证成功', 'success', 3000)
                   } else {
                       Toast.toast('验证失败', 'success', 3000)
                   }
               },
               error: function (xhr, status, error) {
                   alert('网络错误，进入试用')
                   $('#gzh').remove()
               }
           })
}

//发布文章到平台
ipcRenderer.on('publish-article-to-', (event, site) => {
    if (!tab.hasPath()) {
        remote.dialog.showMessageBox({message: '文章尚未保存至本地'}).then()
        return
    }
    switch (site) {
        case 'cnblogs':
            if (!dataStore.getCnBlogCookies()) {
                remote.dialog.showMessageBox({message: '请先登录博客园'}).then()
                return
            }
            break
        case 'csdn':
            if (!dataStore.getCSDNCookies()) {
                remote.dialog.showMessageBox({message: '请先登录CSDN'}).then()
                return
            }
            break
        case 'juejin':
            if (!dataStore.getJueJinCookies()) {
                remote.dialog.showMessageBox({message: '请先登录掘金'}).then()
                return
            }
            break
        case 'oschina':
            if (!dataStore.getOsChinaCookies()) {
                remote.dialog.showMessageBox({message: '请先登录开源中国'}).then()
                return
            }
            break
        case 'segmentfault':
            if (!dataStore.getSegmentFaultCookie()) {
                remote.dialog.showMessageBox({message: '请先登录思否'}).then()
                return
            }
            break
    }

    Toast.toast('准备上传', 'info', 3000);

    (async () => {
        //第一步：将所有本地图片上传至思否
        let list = []
        util.readImgLink(tab.getTextareaValue(), (src) => {
            list.push(src)
        })
        let value = tab.getTextareaValue()
        let next = true
        for (let src of list) {
            if (util.isLocalPicture(src) && next) {
                const all_src = relativePath(src) //图片的真实路径
                switch (site) {
                    case 'cnblogs':
                        await cnblogs.uploadPictureToCnBlog(all_src).then(v => { //上传图片
                            value = value.replace(src, v)
                            Toast.toast('上传图片+1', 'success', 3000)
                        }).catch(value => {
                            remote.dialog.showMessageBox({message: value}).then()
                            next = false
                        })
                        break
                    case 'csdn':
                        await csdn.uploadPictureToCSDN(all_src).then(v => { //上传图片
                            value = value.replace(src, v)
                            Toast.toast('上传图片+1', 'success', 3000)
                        }).catch(value => {
                            remote.dialog.showMessageBox({message: value}).then()
                            next = false
                        })
                        break
                    case 'juejin':
                        await juejin.uploadPictureToJueJin(all_src).then(v => { //上传图片
                            value = value.replace(src, v)
                            Toast.toast('上传图片+1', 'success', 3000)
                        }).catch(value => {
                            remote.dialog.showMessageBox({message: value}).then()
                            next = false
                        })
                        break
                    case 'oschina':
                        await oschina.uploadPictureToOsChina(all_src).then(v => { //上传图片
                            value = value.replace(src, v)
                            Toast.toast('上传图片+1', 'success', 3000)
                        }).catch(value => {
                            remote.dialog.showMessageBox({message: value}).then()
                            next = false
                        })
                        break
                    case 'segmentfault':
                        await segmentfault.uploadPictureToSegmentFault(all_src).then(v => { //上传图片
                            value = value.replace(src, v)
                            Toast.toast('上传图片+1', 'success', 3000)
                        }).catch(value => {
                            remote.dialog.showMessageBox({message: value}).then()
                            next = false
                        })
                        break
                }
            }
        }
        if (!next) {
            return
        }
        //第二步：将最终的文本+标题发布到思否
        switch (site) {
            case 'cnblogs':
                cnblogs.publishArticleToCnBlog(tab.getTitle(), value)
                break
            case 'csdn':
                csdn.publishArticleToCSDN(tab.getTitle(), value, marked.render(value))
                break
            case 'juejin':
                juejin.publishArticleToJueJin(tab.getTitle(), value, marked.render(value))
                break
            case 'oschina':
                oschina.publishArticleToOsChina(tab.getTitle(), value)
                break
            case 'segmentfault':
                segmentfault.publishArticleToSegmentFault(tab.getTitle(), value)
                break
        }
    })();
})


//导出打印pdf
ipcRenderer.on('export-html-file', function () {
    exportHtml()
})

function exportHtml() {
    if (tab.getMarked().innerHTML.length<1){
        remote.dialog.showMessageBox({message: '没有内容可导出'}).then()
        return
    }
    //循环直到拷贝成功
    do {
        console.log('copy')
        clipboard.clear()
        copyHtmlStyle()
    }while (!clipboard.readHTML())
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
                fs.writeFile(filePath, htmlTel.header(tab.getTitle())+clipboard.readHTML()+htmlTel.footer, function (err) {
                    if (err) {
                        return console.error(err);
                    }
                    Toast.toast('导出成功','success',3000)
                });
            }
        })
        .catch(err => {
            console.log(err)
        })
}