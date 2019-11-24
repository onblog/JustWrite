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

    //显示行号
    displayLineNumber = 'display-line-number'

    //编辑器字体大小
    editorFontSizeKey = 'editor-font-size-key'
    //字体名称
    editorFontFamilyKey = 'editor-font-family-key'

    //新浪微博图床设置
    weiBoCookiesKey = 'wei-Bo-cookies-key'
    weiBoUploadKey = 'wei-Bo-upload-key'

    //博客园Cookie
    cnBlogCookieKey = 'cn-blog-cookie-key'
    //CSDN
    CSDNCookieKey = 'csdn-cookie-key'
    //掘金
    JueJinCookieKey = 'jueJin-cookie-key'
    //开源中国
    OsChinaCookieKey = 'OsChina-cookie-key'
    OsChinaUserCodeKey = 'osChina-user-code-key'
    OsChinaUserIdKey = 'osChina-user-id-key'
    //思否
    SegmentFaultCookieKey = 'segmentFault-cookie-key'
    SegmentFaultTokenKey = 'segmentFault-token-key'

    constructor(settings) {
        const baseConfig = {name: 'md-html-style'}
        const finalConfig = {...baseConfig, ...settings};
        super(finalConfig)
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

    getWeiBoUpload() {
        return this.get(this.weiBoUploadKey, false)
    }

    setWeiBoUpload(v) {
        return this.set(this.weiBoUploadKey, v)
    }

    getWeiBoCookies() {
        if (this.has(this.weiBoCookiesKey)) {
            return this.get(this.weiBoCookiesKey)
        }
        return null
    }

    setWeiBoCookies(v) {
        return this.set(this.weiBoCookiesKey, v)
    }

    getCnBlogCookies() {
        if (this.has(this.cnBlogCookieKey)) {
            return this.get(this.cnBlogCookieKey)
        }
        return null
    }

    setCnBlogCookie(v) {
        return this.set(this.cnBlogCookieKey, v)
    }

    getCSDNCookies() {
        if (this.has(this.CSDNCookieKey)) {
            return this.get(this.CSDNCookieKey)
        }
        return null
    }

    setCSDNCookie(v) {
        return this.set(this.CSDNCookieKey, v)
    }

    getJueJinCookies() {
        if (this.has(this.JueJinCookieKey)) {
            return this.get(this.JueJinCookieKey)
        }
        return null
    }

    setJueJinCookie(v) {
        return this.set(this.JueJinCookieKey, v)
    }

    getOsChinaCookies() {
        if (this.has(this.OsChinaCookieKey)) {
            return this.get(this.OsChinaCookieKey)
        }
        return null
    }

    setOsChinaCookie(v) {
        return this.set(this.OsChinaCookieKey, v)
    }

    getOsChinaUserCode() {
        if (this.has(this.OsChinaUserCodeKey)) {
            return this.get(this.OsChinaUserCodeKey)
        }
        return null
    }

    setOsChinaUserCode(v) {
        return this.set(this.OsChinaUserCodeKey, v)
    }

    getSegmentFaultCookie() {
        if (this.has(this.SegmentFaultCookieKey)) {
            return this.get(this.SegmentFaultCookieKey)
        }
        return null
    }

    setSegmentFaultCookie(v) {
        return this.set(this.SegmentFaultCookieKey, v)
    }

    getSegmentFaultToken() {
        if (this.has(this.SegmentFaultTokenKey)) {
            return this.get(this.SegmentFaultTokenKey)
        }
        return null
    }

    setSegmentFaultToken(v) {
        return this.set(this.SegmentFaultTokenKey, v)
    }

    getOsChinaUserId() {
        if (this.has(this.OsChinaUserIdKey)) {
            return this.get(this.OsChinaUserIdKey)
        }
        return null
    }

    setOsChinaUserId(v) {
        return this.set(this.OsChinaUserIdKey, v)
    }

    // isOutUseTime(){
    //     const key = 'out-time'
    //     const timestamp = new Date().getTime()
    //     if (this.has(key)){
    //         if (timestamp - parseInt(this.get(key))>172800000){
    //             return true
    //         }
    //     }else {
    //         this.set(key,timestamp)
    //     }
    //     return false
    // }

}

module.exports = DataStore