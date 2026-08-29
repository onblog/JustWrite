exports.toast = (message, level, timeout) => {
    const num = 'toast' + Math.floor(Math.random() * 10000) //随机ID
    // .alert-success、.alert-info、.alert-warning、.alert-danger
    $('#toast').append(`
<div id="${num}" class="alert alert-${level} alert-dismissable">
    ${message}
</div>
`)
    // $('#' + num).fadeOut(timeout, () => {
    //     $('#' + num).remove()
    // })
    setTimeout(()=>{
        $('#' + num).remove()
    },timeout)
}

const {Notification, dialog} = require('electron')

// 异步弹出提示消息
exports.inform = function inform(config) {
    if (Notification.isSupported()){
        new Notification(config).show()
    }else {
        dialog.showMessageBox({message:config.title+'\n'+config.body}).then()
    }
}