const {remote, shell} = require('electron')
const https = require('https');
const DataStore = require('../script/store')
const jsdom = require("jsdom")
const querystring = require('querystring')
const dataStore = new DataStore()

//上传图片到博客园
function uploadPictureToCnBlog(filePath) {
    return new Promise((resolve, reject) => {
        let formData = new FormData()
        formData.append('imageFile', fs.createReadStream(filePath)) //'file'是服务器接受的key
        formData.append("host", 'www.cnblogs.com')
        formData.append("uploadType", 'Paste')

        let headers = formData.getHeaders() //这个不能少
        headers.Cookie = dataStore.getCnBlogCookies() //获取Cookie
        //自己的headers属性在这里追加
        let request = https.request({
                                        host: 'upload.cnblogs.com',
                                        method: 'POST',
                                        path: '/imageuploader/CorsUpload',
                                        headers: headers
                                    }, function (res) {
            let str = '';
            res.on('data', function (buffer) {
                       str += buffer;//用字符串拼接
                   }
            );
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const result = JSON.parse(str);
                    //上传之后result就是返回的结果
                    // console.log(result)
                    if (result.success) {
                        resolve(result.message)
                    } else {
                        reject(result.message)
                    }
                }
            });
        });
        formData.pipe(request)
    })
}

let cnBlog_url = 'https://i1.cnblogs.com/EditPosts.aspx?opt=1'

//发布文章到博客园
function publishArticleToCnBlog(title, content) {
    let req = https.get(cnBlog_url, {
        headers: {
            'Cookie': dataStore.getCnBlogCookies()
        }
    }, res => {
        let str = '';
        res.on('data', function (buffer) {
            str += buffer; //用字符串拼接
        })
        res.on('end', () => {
            //上传之后result就是返回的结果
            const dom = new jsdom.JSDOM(str);
            const VIEWSTATE = dom.window.document.querySelector('#__VIEWSTATE').value
            const VIEWSTATEGENERATOR = dom.window.document.querySelector(
                '#__VIEWSTATEGENERATOR').value
            if (!VIEWSTATE) {
                remote.dialog.showMessageBox({message: '请先登录博客园'}).then()
                return
            }
            //真正发布文章
            publishArticleToCnBlogFact(title, content, VIEWSTATE, VIEWSTATEGENERATOR)
        });
    })

    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
        remote.dialog.showMessageBox({message: e.message}).then()
    });
}

function publishArticleToCnBlogFact(title, content, VIEWSTATE, VIEWSTATEGENERATOR) {
    const data = querystring.stringify({
                                           '__VIEWSTATE': VIEWSTATE,
                                           '__VIEWSTATEGENERATOR': VIEWSTATEGENERATOR,
                                           'Editor$Edit$txbTitle': title,
                                           'Editor$Edit$EditorBody': content,
                                           'Editor$Edit$Advanced$ckbPublished': 'on',
                                           'Editor$Edit$Advanced$chkDisplayHomePage': 'on',
                                           'Editor$Edit$Advanced$chkComments': 'on',
                                           'Editor$Edit$Advanced$chkMainSyndication': 'on',
                                           'Editor$Edit$Advanced$txbEntryName': '',
                                           'Editor$Edit$Advanced$txbExcerpt': '',
                                           'Editor$Edit$Advanced$txbTag': '',
                                           'Editor$Edit$Advanced$tbEnryPassword': '',
                                           'Editor$Edit$lkbDraft': '存为草稿'
                                       })

    let options = {
        method: 'POST',
        headers: {
            'Accept-Encoding': 'deflate, br',
            "Accept-Language": "zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3",
            'Referer': 'https://i.cnblogs.com',
            'Accept': '*/*',
            'Origin': 'https://i.cnblogs.com',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length,
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:45.0) Gecko/20100101 Firefox/45.0',
            'Cookie': dataStore.getCnBlogCookies()

        }
    }

    let req = https.request(cnBlog_url, options, function (res) {
        if (res.statusCode === 302) {
            //发布成功
            res.setEncoding('utf-8')
            let str = ''
            res.on('data', function (chunk) {
                str += chunk
            });
            res.on('end', () => {
                const dom = new jsdom.JSDOM(str);
                const a = dom.window.document.body.getElementsByTagName('a')[0]
                remote.dialog.showMessageBox({message: '发布成功！是否在浏览器打开？', buttons: ['取消', '打开']})
                    .then((res) => {
                        if (res.response === 1) {
                            shell.openExternal('https://i.cnblogs.com' + a.href).then()
                        }
                    })
            });
        } else {
            //发布失败
            remote.dialog.showMessageBox({message: '发布失败！\n原因可能是：未登录博客园账号或者发布的标题重复'}).then()
        }
    })

    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
        remote.dialog.showMessageBox({message: e.message}).then()
    });

    req.write(data)
    req.end()
}

exports.uploadPictureToCnBlog = uploadPictureToCnBlog
exports.publishArticleToCnBlog = publishArticleToCnBlog