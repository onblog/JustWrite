exports.header = (title)=>{
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <link href="https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/katex.min.css" rel="stylesheet" />
</head>
<body>
<div style="margin: 0 auto;max-width: 700px">
`}

exports.footer = `</div></body></html>`