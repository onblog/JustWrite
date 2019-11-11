const path = require('path')

class Tab {
    //text：已保存部分的文字内容
    constructor(id, text, filePath, document) {
        this.id = id + ''
        this.text = text
        this.filePath = filePath
        this.edit = false
        this.document = document
    }

    getId() {
        return this.id
    }

    getPath() {
        return this.filePath || ''
    }

    getTitle() {
        return path.basename(this.getPath())
    }

    getPage() {
        return this.document.getElementById(this.getPageId())
    }

    getPageId() {
        return 'pageId' + this.id
    }

    getMarkedId() {
        return 'markedId' + this.id
    }

    getHeaderId() {
        return 'aId' + this.id
    }

    getLiId() {
        return 'liId' + this.id
    }

    getLeftId() {
        return 'leftId' + this.id
    }

    getRightId() {
        return 'rightId' + this.id
    }

    getCloseId() {
        return 'closeId' + this.id
    }

    getTextareaId() {
        return 'textareaId' + this.id
    }

    getTextarea() {
        return this.document.getElementById(this.getTextareaId())
    }

    getClose() {
        return this.document.getElementById(this.getCloseId())
    }

    getMarked() {
        return this.document.getElementById(this.getMarkedId())
    }

    getHeader() {
        return this.document.getElementById(this.getHeaderId())
    }

    getDirname() {
        return this.hasPath() ? path.dirname(this.getPath()) + '/' : null
    }

    getPictureDir() {
        return this.getDirname() + 'picture/'
    }

    setPath(p) {
        this.filePath = p;
        this.getHeader().innerHTML = path.basename(this.getPath())
    }

    hasPath() {
        return path.isAbsolute(this.filePath)
    }

    getText() {
        return this.text || ''
    }

    setText(txt) {
        this.text = txt
        this.edit = false
    }

    isEdit() {
        return this.edit
    }

    isEditChangeIco(txt) {
        if (this.getText() !== txt) {
            //已编辑
            this.getHeader().innerHTML =
                path.basename(this.getPath()) + '<span class="tip"> - 已编辑</span>'
            this.edit = true
        } else {
            //未编辑
            this.getHeader().innerHTML = path.basename(this.getPath())
            this.edit = false
        }
    }
}

module.exports = Tab