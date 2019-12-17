exports.header = (title)=>{
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <link href="https://cdn.jsdelivr.net/npm/katex@0.11.1/dist/katex.min.css" rel="stylesheet" />
    <style type="text/css">
     @media print {
        h1, h2, h3, h4, h5, h6 { /*page-break-after: avoid; */
        }
        table, pre, ul, img { /*page-break-inside: avoid;*/
        }
        img {
            max-width: 100% !important;
        }
        body {
            width: 100%;
            margin: 0;
            padding: 0;
        }
     } 
    </style>
</head>
<body style="-webkit-print-color-adjust: exact;">
<div style="margin: 0 auto;max-width: 700px">
`}

exports.headerNoStyle = (title)=>{
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
</head>
<body>
<div>
`}

exports.footer = `</div></body></html>`

//        p, span, code, pre, code span, body, a {
//             /*font-size: 14px !important;*/
//         }
//
//         p {
//             /*margin-bottom: 0 !important;*/
//         }
//
//         /*h1 {*/
//         /*    font-size: 20px !important;*/
//         /*}*/
//
//         /*h2 {*/
//         /*    font-size: 19px !important;*/
//         /*}*/
//
//         /*h3 {*/
//         /*    font-size: 18px !important;*/
//         /*}*/
//
//         /*h4 {*/
//         /*    font-size: 17px !important;*/
//         /*}*/
//
//         /*h5 {*/
//         /*    font-size: 16px !important;*/
//         /*}*/
//
//         /*h6 {*/
//         /*    font-size: 15px !important;*/
//         /*}*/
//
//         /*pre {*/
//         /*    word-wrap: break-word;*/
//         /*}*/