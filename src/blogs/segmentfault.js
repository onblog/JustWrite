const {remote, shell} = require('electron')
const https = require('https');
const DataStore = require('../script/store')
const dataStore = new DataStore()
const FormData = require('form-data')

//上传图片至思否
function uploadPictureToSegmentFault(filePath) {
    return new Promise((resolve, reject) => {
        let formData = new FormData();
        formData.append('image', fs.createReadStream(filePath))

        let headers = formData.getHeaders()
        headers.Cookie = dataStore.getSegmentFaultCookie() //获取Cookie
        //自己的headers属性在这里追加
        let request = https.request({
                                        host: 'segmentfault.com',
                                        method: 'POST',
                                        path: '/img/upload/image?_='
                                              + dataStore.getSegmentFaultToken(),
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
                    if (result[0] === 0) {
                        resolve(result[1])
                    } else {
                        reject('上传图片失败')
                    }
                } else {
                    reject('上传图片失败,状态码' + res.statusCode)
                }
            });
        });
        formData.pipe(request)
    })
}

//上传文章到思否
function publishArticleToSegmentFault(title, text) {
    let formData = new FormData();
    formData.append('type', 1)
    formData.append('url', '')
    formData.append('blogId', 0)
    formData.append('isTiming', 0)
    formData.append('created', '')
    formData.append('weibo', 0)
    formData.append('license', 0)
    formData.append('tags', '')
    formData.append('title', title)
    formData.append('text', text)
    formData.append('articleId', '')
    formData.append('draftId', '')
    formData.append('id', '')

    let headers = formData.getHeaders()
    headers.Cookie = dataStore.getSegmentFaultCookie() //获取Cookie
    //自己的headers属性在这里追加
    headers.referer = 'https://segmentfault.com/write?freshman=1'
    headers.origin = 'https://segmentfault.com'
    headers['x-requested-with'] = 'XMLHttpRequest'
    headers['accept-language'] = 'zh-CN,zh;q=0.9,en;q=0.8'
    headers['accept-encoding'] = 'deflate, br'
    headers['accept'] = '*/*'
    headers['sec-fetch-site'] = 'sec-fetch-site'
    headers['sec-fetch-mode'] = 'cors'
    headers['User-Agent'] =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36'
    let request = https.request(
        'https://segmentfault.com/api/article/draft/save?_=' + dataStore.getSegmentFaultToken(), {
            method: 'POST',
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
                    // console.log(result)
                    if (result.status === 0) {
                        remote.dialog.showMessageBox(
                            {message: '发布成功！是否在浏览器打开？', buttons: ['取消', '打开']})
                            .then((res) => {
                                if (res.response === 1) {
                                    shell.openExternal('https://segmentfault.com/user/draft').then()
                                }
                            })
                    } else {
                        remote.dialog.showMessageBox({message: result.message}).then()
                    }
                } else {
                    remote.dialog.showMessageBox({message: '请先登录思否'}).then()
                }
            });
        });
    formData.pipe(request)

    request.on('error', function (e) {
        console.log('problem with request: ' + e.message);
        remote.dialog.showMessageBox({message: e.message}).then()
    });
}

exports.uploadPictureToSegmentFault = uploadPictureToSegmentFault
exports.publishArticleToSegmentFault = publishArticleToSegmentFault