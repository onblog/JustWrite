const Store = require('electron-store')

class DataStore extends Store {
    //页面主题代码风格切换
    codeStyleKey = 'code-style-key'
    htmlStyleKey = 'html-style-key'
    editorStyleKey = 'editor-style-key'

    //夜间模式
    nightModeKey = 'night-mode-key'

    //实时预览
    cutPreviewKey = 'cut-preview-key'
    //滑动同步
    scrollSyncKey = 'scroll-sync-key'

    //显示行号
    displayLineNumber = 'display-line-number'

    //编辑器字体大小
    editorFontSizeKey = 'editor-font-size-key'
    //字体名称
    editorFontFamilyKey = 'editor-font-family-key'

    //最近打开的文件列表
    recentlyOpenedListKey = 'recently-opened-list-key'

    constructor(settings) {
        const baseConfig = {name: 'md-html-style-5-6'}
        const finalConfig = {...baseConfig, ...settings};
        super(finalConfig)
    }

    getRecentlyOpenedList() {
        if (this.has(this.recentlyOpenedListKey)) {
            return this.get(this.recentlyOpenedListKey)
        } else {
            return []
        }
    }

    addRecentlyOpenedList(line) {
        if (this.has(this.recentlyOpenedListKey)) {
            let list = this.get(this.recentlyOpenedListKey)
            let set = new Set()
            for (let x of list) {
                set.add(x.toString())
            }
            set.add(line)
            this.set(this.recentlyOpenedListKey, Array.from(set))
        } else {
            let list = []
            list.push(line)
            this.set(this.recentlyOpenedListKey, list)
        }
    }

    clearRecentlyOpenedList() {
        this.delete(this.recentlyOpenedListKey)
    }

    isChecked(k, v) {
        return this.has(k) && this.get(k) === v;
    }

    initCodeStyle(defaultCodeStyle) {
        if (!this.has(this.codeStyleKey)) {
            this.set(this.codeStyleKey, defaultCodeStyle)
        }
    }

    getCodeStyle() {
        return this.get(this.codeStyleKey)
    }

    initHTMLStyle(defaultHtmlStyle) {
        if (!this.has(this.htmlStyleKey)) {
            this.set(this.htmlStyleKey, defaultHtmlStyle)
        }
    }

    getHTMLStyle() {
        return this.get(this.htmlStyleKey)
    }

    initEditorStyle(defaultEditorStyle) {
        if (!this.has(this.editorStyleKey)) {
            this.set(this.editorStyleKey, defaultEditorStyle)
        }
    }

    getEditorStyle() {
        return this.get(this.editorStyleKey)
    }

    getNightMode() {
        if (this.has(this.nightModeKey)) {
            return this.get(this.nightModeKey)
        }
        return false
    }

    getCutPreview() {
        if (this.has(this.cutPreviewKey)) {
            return this.get(this.cutPreviewKey)
        }
        return true
    }

    getScrollSync() {
        if (this.has(this.scrollSyncKey)) {
            return this.get(this.scrollSyncKey)
        }
        return true
    }

    getDisplayLineNumber() {
        if (this.has(this.displayLineNumber)) {
            return this.get(this.displayLineNumber)
        }
        return true
    }

    setDisplayLineNumber(a) {
        this.set(this.displayLineNumber, a)
    }

    getEditorFontSize() {
        if (this.has(this.editorFontSizeKey)) {
            return this.get(this.editorFontSizeKey)
        }
        return '16px'
    }

    setEditorFontSize(v) {
        this.set(this.editorFontSizeKey, v)
    }

    getEditorFontFamily() {
        return this.get(this.editorFontFamilyKey)
    }

    initEditorFontFamily(v) {
        if (!this.has(this.editorFontFamilyKey)) {
            this.set(this.editorFontFamilyKey, v)
        }
    }

    setEditorFontFamily(v) {
        this.set(this.editorFontFamilyKey, v)
    }

}

module.exports = DataStore