const {remote, shell} = require('electron')
const https = require('https');
const DataStore = require('../script/store')
const dataStore = new DataStore()
const querystring = require('querystring')
const zlib = require('zlib')
const FormData = require('form-data')

//上传图片到掘金
function uploadPictureToJueJin(filePath) {
    return new Promise((resolve, reject) => {
        let formData = new FormData();
        formData.append('file', fs.createReadStream(filePath))

        let headers = formData.getHeaders()
        headers.Cookie = dataStore.getJueJinCookies() //获取Cookie
        //自己的headers属性在这里追加
        let request = https.request({
                                        host: 'cdn-ms.juejin.im',
                                        method: 'POST',
                                        path: '/v1/upload?bucket=gold-user-assets',
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
                    console.log(result)
                    if (result.m === 'ok') {
                        resolve(result.d.url.https)
                    } else {
                        reject(result.m)
                    }
                }
            });
        });
        formData.pipe(request)
    })
}

//发布文章到掘金
function publishArticleToJueJin(title, markdown, html) {
    let req = https.get('https://juejin.im/auth', {
        headers: {
            'Cookie': dataStore.getJueJinCookies()
        }
    }, res => {
        if (res.statusCode !== 200) {
            remote.dialog.showMessageBox({message: '请先登录掘金'}).then()
            return
        }
        let str = '';
        res.on('data', function (buffer) {
            str += buffer;//用字符串拼接
        })
        res.on('end', () => {
            const result = JSON.parse(str);
            //上传之后result就是返回的结果
            const data = querystring.stringify({
                                                   'uid': result.userId,
                                                   'device_id': result.clientId,
                                                   'token': result.token,
                                                   'src': 'web',
                                                   'category': '5562b428e4b00c57d9b94b9d',
                                                   'content': '',
                                                   'html': html,
                                                   'markdown': markdown,
                                                   'screenshot': '',
                                                   'isTitleImageFullscreen': '',
                                                   'tags': '',
                                                   'title': title,
                                                   'type': 'markdown'
                                               })
            //真正完成发布文章的请求
            publishArticleToJueJinFact(data)
        });
    })

    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
        remote.dialog.showMessageBox({message: e.message}).then()
    });
}

function publishArticleToJueJinFact(data) {
    let options = {
        method: 'POST',
        headers: {
            'Accept-Encoding': 'gzip, deflate, br',
            "Accept-Language": "zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3",
            'Referer': 'https://juejin.im/editor/drafts/new',
            'Accept': '*/*',
            'Origin': 'https://juejin.im',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length,
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:45.0) Gecko/20100101 Firefox/45.0',
            'Cookie': dataStore.getJueJinCookies()

        }
    }

    let req = https.request('https://post-storage-api-ms.juejin.im/v1/draftStorage',
                            options, function (res) {
            if (res.statusCode !== 200) {
                remote.dialog.showMessageBox({message: '请先登录掘金 ' + res.statusCode}).then()
                return
            }
            //解决返回数据被gzip压缩
            let output;
            if (res.headers['content-encoding'] === 'gzip') {
                let gzip = zlib.createGunzip();
                res.pipe(gzip);
                output = gzip;
            } else {
                output = res;
            }
            res = output

            let str = ''
            res.on('data', function (chunk) {
                str += chunk
            });
            res.on('end', () => {
                const result = JSON.parse(str)
                //上传之后result就是返回的结果
                if (result.m === 'ok') {
                    remote.dialog.showMessageBox({message: '发布成功！是否在浏览器打开？', buttons: ['取消', '打开']})
                        .then((res) => {
                            if (res.response === 1) {
                                shell.openExternal('https://juejin.im/editor/drafts/' + result.d[0])
                                    .then()
                            }
                        })
                } else {
                    //发布失败
                    remote.dialog.showMessageBox({message: result.m}).then()
                }
            });
        })

    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
        remote.dialog.showMessageBox({message: e.message}).then()
    });

    req.write(data)
    req.end()
}

exports.uploadPictureToJueJin =uploadPictureToJueJin
exports.publishArticleToJueJin =publishArticleToJueJin