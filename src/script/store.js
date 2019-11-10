const Store = require('electron-store')

class DataStore extends Store {
    //页面主题代码风格切换
    codeStyleKey = 'code-style-key'
    htmlStyleKey = 'html-style-key'

    //夜间模式
    nightModeKey = 'night-mode-key'

    //新浪微博图床设置
    weiBoCookiesKey = 'wei-Bo-cookies-key'
    weiBoUploadKey = 'wei-Bo-upload-key'

    //博客园Cookie
    cnBlogsCookieKey = 'cn-blogs-cookie-key'

    constructor(settings) {
        const baseConfig = {name: 'md-html-style'}
        const finalConfig = {...baseConfig, ...settings};
        super(finalConfig)
    }

    initStore(defaultCodeStyle, defaultHtmlStyle) {
        this.defaultCodeStyle = defaultCodeStyle
        this.defaultHtmlStyle = defaultHtmlStyle
    }

    isChecked(k, v) {
        return this.has(k) && this.get(k) === v;
    }

    getCodeStyle() {
        return this.get(this.codeStyleKey, this.defaultCodeStyle)
    }

    getHTMLStyle() {
        return this.get(this.htmlStyleKey, this.defaultHtmlStyle)
    }

    getNightMode() {
        return this.get(this.nightModeKey, false)
    }

    getWeiBoUpload() {
        return this.get(this.weiBoUploadKey, false)
    }

    setWeiBoUpload(v) {
        return this.set(this.weiBoUploadKey, v)
    }

    getWeiBoCookies() {
        if (this.has(this.weiBoCookiesKey)){
            return this.get(this.weiBoCookiesKey)
        }
        return null
    }

    setWeiBoCookies(v) {
        return this.set(this.weiBoCookiesKey, v)
    }

    getCnBlogsCookies() {
        if (this.has(this.cnBlogsCookieKey)){
            return this.get(this.cnBlogsCookieKey)
        }
        return null
    }

    setCnBlogsCookie(v) {
        return this.set(this.cnBlogsCookieKey, v)
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