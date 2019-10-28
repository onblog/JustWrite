const {remote, clipboard, ipcRenderer} = require('electron')
const fs = require("fs")
const path = require('path')
const home = remote.getGlobal('sharedObject').temp
const appName = remote.getGlobal('sharedObject').appName
document.title = path.basename(appName) //窗口标题

let editorArr = [] //编辑器引用
let num = 0; //不断增长的随机数
let editor; //当前编辑器
let header; //当前标题

//更新标签页
function updateTab(e, h) {
    editor = e
    header = h
    //close图标
    if (editorArr.length > 1) {
        document.getElementById(getCloseId(getOneId())).style.display = 'block'
    }else if (editorArr.length===1) {
        document.getElementById(getCloseId(getOneId())).style.display = 'none'
    }
}

function getOneId() {
    return editorArr[0].id.replace(/[^0-9]/ig, "")
}

function getPageId(num) {
    return 'pageId' + num
}

function getEditorId(num) {
    return 'editorId' + num
}

function getAId(num) {
    return 'aId' + num
}

function getLiId(num) {
    return 'liId' + num
}

function getCloseId(num) {
    return 'closeId' + num
}

//新建一个标签页
function createNewTab() {
    //新建一个编辑器
    const pageId = getPageId(num)
    const editorId = getEditorId(num)
    const aId = getAId(num)
    const liId = getLiId(num)
    $('#myTab').append(`<li id="${liId}">
        <a href="#${pageId}" id="${aId}" data-id="${num}" data-toggle="tab" class="header" data-path="">
          未命名${num === 0 ? '' : num + 1}
          <i class="fa fa-times-circle close" id="${getCloseId(num)}" data-id="${num}" aria-hidden="true"></i>
        </a>
    </li>`)
    $('#myTabContent').append(`<div class="tab-pane fade" id="${pageId}">
        <div id="${editorId}" class="editor"></div>
    </div>`)
    $('#myTab a:last').click()
    //新建一个编辑器
    let editorOnce = editormd(editorId, {
        width: "100%",
        height: "100%",
        htmlDecode: true,
        markdown: "",
        path: "../node_modules/editor.md/lib/",
        toolbarIcons: function () {
            return ["undo", "redo", "|",
                    "bold", "del", "italic", "quote", "uppercase", "lowercase", "|",
                    "h1", "h2", "h3", "h4", "h5", "h6", "|",
                    "list-ul", "list-ol", "hr", "|",
                    "watch", "preview", "|",
                    "help", "testIcon"]
        },
        toolbarIconsClass: {
            testIcon: "fa-info-circle"  // 指定一个FontAawsome的图标类
        },
        toolbarHandlers: {
            testIcon: function (cm, icon, cursor, selection) {
                alert('用于指示当前文件是否保存')
            }
        },
        onchange: function () {
            if (editor.getMarkdown().length > 0) {
                console.log('已编辑')
            } else {
                console.log('空编辑')
            }
        }
    });
    //末尾添加新的元素
    editorArr.push(editorOnce)
    updateTab(editorOnce, document.getElementById(aId))
    //一直加
    num++;
}

//初始化标签页
createNewTab()

//新建tab
ipcRenderer.on('new-tab', ((event) => {
    createNewTab()
}))

//事件冒泡监听Tab切换
document.getElementById('myTab').addEventListener('click', (event) => {
    event.preventDefault()
    const {dataset, classList} = event.target
    const id = dataset && dataset.id
    //切换tab
    if (id && classList.contains('header')) {
        for (let i = 0; i < editorArr.length; i++) {
            if (editorArr[i].id===getEditorId(id)){
                updateTab(editorArr[i], event.target)
                break
            }
        }
    }
    //关闭tab
    if (id && classList.contains('close')) {
        if (id === '0' && editorArr.length === 1) {
            //默认不存在关闭按钮
        } else {
            //删除引用，id是DOM的ID，不是数组的索引
            for (let i = 0; i < editorArr.length; i++) {
                if (editorArr[i].id===getEditorId(id)){
                    editorArr[i].editor.remove()
                    editorArr.splice(i, 1)
                    break
                }
            }
            //删除DOM
            document.getElementById('myTab').removeChild(document.getElementById(getLiId(id)))
            document.getElementById('myTabContent')
                .removeChild(document.getElementById(getPageId(id)))
            //更新Tab
            updateTab(editorArr[0],
                      document.getElementById(getAId(getOneId())))
            header.click()
        }
    }
})

//标题栏滑动
document.getElementById('myTab').onwheel = function(event) {
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

/*
//打开文件
ipcRenderer.on('selected-file', (event, file) => {
    if (editor.getMarkdown().length > 0) {
        // 当前窗口有文字，是否创建新的窗口还是在原窗口打开文件
        // ipcRenderer.send('oped-md-file',file)
        console.log("已经有了内容")
        // return
    }
    header.dataset.path = file[0] //窗口头部
    fs.readFile(file[0], function (err, data) {
        if (err) {
            return console.error(err);
        }
        editor.clear();
        editor.setMarkdown(data.toString())
    });
})

//保存文件
ipcRenderer.on('save-md-file', () => {
    const bool = path.isAbsolute(header.dataset.path) //是否是绝对路径
    if (bool) {
        //保存已打开的文件
        fs.writeFile(header.dataset.path, editor.getMarkdown(), function (err) {
            if (err) {
                return console.error(err);
            }
            editIco.style.color = '#666'
        });
    } else {
        //提示创建新的文件(输入文件名，路径)
        console.log("save...");
    }
})

/!**
 * 拖拽图片
 * @type {HTMLElement}
 *!/
document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();

    for (const f of e.dataTransfer.files) {
        editor.insertValue('![](' + f.path + ')');
    }
});
document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

/!**
 * 粘贴图片
 *!/
document.addEventListener('paste', function (event) {
    const items = event.clipboardData && event.clipboardData.items;
    if (items && items.length) {
        // 检索剪切板items
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                // file = items[i].getAsFile();
                const image = clipboard.readImage()
                const buffer = image.toPNG();
                let path = home + '/' + Math.floor(Math.random() * 10000000) + '.png'
                fs.writeFile(path, buffer, (err) => {
                    if (err) {
                        return console.error(err);
                    }
                    editor.insertValue('![已保存到临时文件夹](' + path + ')');
                })
                break;
            }
        }
    }
});*/
