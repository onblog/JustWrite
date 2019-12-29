const path = require('path')

// 系统托盘图标目录 __dirname:主进程文件所在目录
const appIcon = path.join(__dirname, 'build');
// 按平台选择，mac是18px的倍数，win是16px的倍数
const iconFile = 'app.png'

exports.appIcon = appIcon
exports.iconFile = path.join(appIcon, iconFile)