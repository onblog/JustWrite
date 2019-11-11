exports.toast = (message, level, timeout) => {
    const num = 'toast' + Math.floor(Math.random() * 10000) //随机ID
    // .alert-success、.alert-info、.alert-warning、.alert-danger
    $('#toast').append(`
<div id="${num}" class="alert alert-${level} alert-dismissable">
    ${message}
</div>
`)
    $('#' + num).fadeOut(timeout, () => {
        $('#' + num).remove()
    })
}