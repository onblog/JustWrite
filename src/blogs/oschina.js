const {remote, shell} = require('electron')
const https = require('https');
const DataStore = require('../script/store')
const dataStore = new DataStore()
const querystring = require('querystring')

function getOsChinaUserCode() {
    return dataStore.getOsChinaUserCode()
}

function getOsChinaUserId() {
    return dataStore.getOsChinaUserId()
}

function getCsrfToken() {
    let e, t, n, i = ''
    if (!i || 40 !== i.length) {
        if (i = [], e = "",
        window.crypto && window.crypto.getRandomValues) {
            i = new Uint8Array(40),
                window.crypto.getRandomValues(i);
        } else {
            for (t = 0; t < 40; t++) {
                i.push(Math.floor(256 * Math.random()));
            }
        }
        for (t = 0; t < i.length; t++) {
            n = "abcdefghijklmnopqrstuvwxyz0123456789".charAt(i[t] % 36),
                e += .5 < Math.random() ? n.toUpperCase() : n;
        }
        i = e
    }
    return i
}

//上传图片至开源中国
function uploadPictureToOsChina(filePath) {
    let formData = new FormData();
    formData.append('upload', fs.createReadStream(filePath))
    formData.append('ckCsrfToken', getCsrfToken())

    let headers = formData.getHeaders()
    headers.Cookie = dataStore.getOsChinaCookies() //获取Cookie
    //自己的headers属性在这里追加
    return new Promise((resolve, reject) => {
        let request = https.request({
                                        host: 'my.oschina.net',
                                        method: 'POST',
                                        path: '/u/' + getOsChinaUserId()
                                              + '/space/ckeditor_dialog_img_upload',
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
                    if (result.uploaded === 1) {
                        resolve(result.url)
                    } else {
                        reject(result.error.message)
                    }
                } else {
                    reject('上传图片失败，状态码' + res.statusCode)
                }
            });
        });
        formData.pipe(request)
    })
}

//发布文章到开源中国
function publishArticleToOsChina(title, content) {
    const data = querystring.stringify({
                                           'draft': 0,
                                           'id': '',
                                           'user_code': getOsChinaUserCode(),
                                           'title': title,
                                           'content': content,
                                           'content_type': 3,
                                           'catalog': 5906778,
                                           'classification': '',
                                           'type': 4,
                                           'origin_url': '',
                                           'privacy': 0,
                                           'deny_comment': 0,
                                           'as_top': 0,
                                           'downloadImg': 0,
                                           'isRecommend': 0,
                                       })
    let options = {
        method: 'POST',
        headers: {
            'Accept-Encoding': 'gzip, deflate, br',
            "Accept-Language": "zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3",
            'Accept': '*/*',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length,
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:45.0) Gecko/20100101 Firefox/45.0',
            'Cookie': dataStore.getOsChinaCookies()
        }
    }
    const url = 'https://my.oschina.net/u/' + getOsChinaUserId() + '/blog/save_draft'

    let req = https.request(url, options, function (res) {
            //发布成功
            res.setEncoding('utf-8')
            let str = ''
            res.on('data', function (chunk) {
                str += chunk
            });
            res.on('end', () => {
                const result = JSON.parse(str);
                if (result.code === 1) {
                    remote.dialog.showMessageBox({message: '发布成功！是否在浏览器打开？', buttons: ['取消', '打开']})
                        .then((res) => {
                            if (res.response === 1) {
                                shell.openExternal('https://my.oschina.net/u/' + getOsChinaUserId()
                                                   + '/blog/write/draft/' + result.result.draft)
                                    .then()
                            }
                        })
                } else {
                    remote.dialog.showMessageBox({message: result.message}).then()
                }
            });

        }
    )

    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
        remote.dialog.showMessageBox({message: e.message}).then()
    });

    req.write(data)
    req.end()
}

exports.uploadPictureToOsChina = uploadPictureToOsChina
exports.publishArticleToOsChina= publishArticleToOsChina