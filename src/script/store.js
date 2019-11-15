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
    cnBlogCookieKey = 'cn-blog-cookie-key'
    //CSDN
    CSDNCookieKey = 'csdn-cookie-key'
    //掘金
    JueJinCookieKey = 'jueJin-cookie-key'
    //开源中国
    OsChinaCookieKey = 'OsChina-cookie-key'
    OsChinaUserCodeKey = 'osChina-user-code-key'
    OsChinaUserIdKey = 'osChina-user-id-key'

    constructor(settings) {
        const baseConfig = {name: 'md-html-style'}
        const finalConfig = {...baseConfig, ...settings};
        super(finalConfig)
    }

    initStore(defaultCodeStyle, defaultHtmlStyle) {
        if (!this.has(this.codeStyleKey)){
            this.set(this.codeStyleKey,defaultCodeStyle)
        }
        if (!this.has(this.htmlStyleKey)){
            this.set(this.htmlStyleKey,defaultHtmlStyle)
        }
    }

    isChecked(k, v) {
        return this.has(k) && this.get(k) === v;
    }

    getCodeStyle() {
        return this.get(this.codeStyleKey)
    }

    getHTMLStyle() {
        return this.get(this.htmlStyleKey)
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

    getCnBlogCookies() {
        if (this.has(this.cnBlogCookieKey)){
            return this.get(this.cnBlogCookieKey)
        }
        return null
    }

    setCnBlogCookie(v) {
        return this.set(this.cnBlogCookieKey, v)
    }

    getCSDNCookies() {
        if (this.has(this.CSDNCookieKey)){
            return this.get(this.CSDNCookieKey)
        }
        return null
    }

    setCSDNCookie(v) {
        return this.set(this.CSDNCookieKey, v)
    }

    getJueJinCookies() {
        if (this.has(this.JueJinCookieKey)){
            return this.get(this.JueJinCookieKey)
        }
        return null
    }

    setJueJinCookie(v) {
        return this.set(this.JueJinCookieKey, v)
    }

    getOsChinaCookies() {
        if (this.has(this.OsChinaCookieKey)){
            return this.get(this.OsChinaCookieKey)
        }
        return null
    }

    setOsChinaCookie(v) {
        return this.set(this.OsChinaCookieKey, v)
    }

    getOsChinaUserCode() {
        if (this.has(this.OsChinaUserCodeKey)){
            return this.get(this.OsChinaUserCodeKey)
        }
        return null
    }

    setOsChinaUserCode(v) {
        return this.set(this.OsChinaUserCodeKey, v)
    }

    getOsChinaUserId() {
        if (this.has(this.OsChinaUserIdKey)){
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