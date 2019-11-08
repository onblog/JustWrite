exports.toast = (message, level) => {
    const num = 'toast'+Math.floor(Math.random()*10000) //随机ID
    // .alert-success、.alert-info、.alert-warning、.alert-danger
    $('body').append(`
<div id="${num}" class="alert alert-${level} alert-dismissable">
    <button type="button" class="close toast-close" data-dismiss="alert" aria-hidden="true">
    </button>
    ${message}
</div>
`)
    setTimeout(function () {
        $('#'+num).remove()
    },3000)
    //是否显示声音
}