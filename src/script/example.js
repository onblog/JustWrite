exports.example = `# h1 标题 8-)
## h2 标题
### h3 标题
#### h4 标题
##### h5 标题
###### h6 标题

---

## 分割线

___

---

***


## Typographic replacements

有些字体包没有一些字符哦！

Enable typographer option to see result.

(c) (C) (r) (R) (tm) (TM) (p) (P) +-

test.. test... test..... test?..... test!....

!!!!!! ???? ,,  -- ---


## 强调

**This is bold text**

__This is bold text__

*This is italic text*

_This is italic text_

~~Strikethrough~~


## 引用块


> Blockquotes can also be nested...
>> ...by using additional greater-than signs right next to each other...
> > > ...or with spaces between arrows.


## 列表

不排序

+ Create a list by starting a line with \`+\`, \`-\`, or \`*\`
+ Sub-lists are made by indenting 2 spaces:
  - Marker character change forces new list start:
    * Ac tristique libero volutpat at
    + Facilisis in pretium nisl aliquet
    - Nulla volutpat aliquam velit
+ Very easy!

排序

1. Lorem ipsum dolor sit amet
2. Consectetur adipiscing elit
3. Integer molestie lorem at massa


1. You can use sequential numbers...
1. ...or keep all the numbers as \`1.\`

设置开始数字

57. foo
1. bar


## 代码

Inline \`code\`

Indented code

    // Some comments
    line 1 of code
    line 2 of code
    line 3 of code


Block code "fences"

\`\`\`
Sample text here...
\`\`\`

Syntax highlighting

\`\`\` js
var foo = function (bar) {
  return bar++;
};

console.log(foo(5));
\`\`\`

## 表格

| Option | Description |
| ------ | ----------- |
| data   | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default. |
| ext    | extension to be used for dest files. |

Right aligned columns

| Option | Description |
| ------:| -----------:|
| data   | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default. |
| ext    | extension to be used for dest files. |


## 超链接

[link text](http://dev.nodeca.com)

鼠标悬停会有提示

[link with title](http://nodeca.github.io/pica/demo/ "title text!")

Autoconverted link https://github.com/nodeca/pica (enable linkify to see)


## 图像

![Stormtroopocat](https://octodex.github.com/images/stormtroopocat.jpg "The Stormtroopocat")

Like links, Images also have a footnote style syntax

![Alt text][id]

With a reference later in the document defining the URL location:

[id]: https://octodex.github.com/images/dojocat.jpg  "The Dojocat"


## Plugins（插件）

The killer feature of \`markdown-it\` is very effective support of
[syntax plugins](https://www.npmjs.org/browse/keyword/markdown-it-plugin).


### [Emojies表情](https://github.com/markdown-it/markdown-it-emoji)

> Classic markup: :wink: :crush: :cry: :tear: :laughing: :yum:
>
> Shortcuts (emoticons): :-) :-( 8-) ;)

see [how to change output](https://github.com/markdown-it/markdown-it-emoji#change-output) with twemoji.


### [Subscript](https://github.com/markdown-it/markdown-it-sub) / [Superscript](https://github.com/markdown-it/markdown-it-sup)

- 19^th^
- H~2~O


### [\\<ins>下划线](https://github.com/markdown-it/markdown-it-ins)

++Inserted text++


### [\\<mark>标记](https://github.com/markdown-it/markdown-it-mark)

==Marked text==


### [Footnotes脚注](https://github.com/markdown-it/markdown-it-footnote)

点一下就知道啥用法了！

Footnote 1 link[^first].

Footnote 2 link[^second].

Inline footnote^[Text of inline footnote] definition.

Duplicated footnote reference[^second].

[^first]: Footnote **can have markup**

    and multiple paragraphs.

[^second]: Footnote text.


### [Definition lists](https://github.com/markdown-it/markdown-it-deflist)

Term 1

:   Definition 1
with lazy continuation.

Term 2 with *inline markup*

:   Definition 2

        { some code, part of Definition 2 }

    Third paragraph of definition 2.

_Compact style:_

Term 1
  ~ Definition 1

Term 2
  ~ Definition 2a
  ~ Definition 2b


### [Abbreviations](https://github.com/markdown-it/markdown-it-abbr)

鼠标悬停出现提示信息

This is HTML abbreviation example.

It converts "HTML", but keep intact partial entries like "xxxHTMLyyy" and so on.

*[HTML]: 出现了吧！意不意外，惊不惊喜。


### TOC目录

[TOC]

### 图片大小

![Minion](https://octodex.github.com/images/minion.png =100x100)

### HTML属性

Example input:
\`\`\`md
# header {.style-me}
paragraph {data-toggle=modal}
\`\`\`
Output:
\`\`\`html
<h1 class="style-me">header</h1>
<p data-toggle="modal">paragraph</p>
\`\`\`
or
\`\`\`md
![](1.png){style=width:200px;height:100px}
\`\`\`
更多用法：<https://github.com/arve0/markdown-it-attrs>

### 任务列表

- [x] 已完成任务
- [ ] 未完成任务

### 数学公式

##### 行内公式：\\$...\\$

$e^{x^2}\\neq{e^x}^2$

##### 块公式：$\\$...$\\$

$$e^{x^2}\\neq{e^x}^2$$

来个 *"复杂点"* 的:

$$H(D_2) = -(\\frac{2}{4}\\ log_2 \\frac{2}{4} + \\frac{2}{4}\\ log_2 \\frac{2}{4}) = 1$$

矩阵：

$$
        \\begin{pmatrix}
        1 & a_1 & a_1^2 & \\cdots & a_1^n \\\\
        1 & a_2 & a_2^2 & \\cdots & a_2^n \\\\
        \\vdots & \\vdots & \\vdots & \\ddots & \\vdots \\\\
        1 & a_m & a_m^2 & \\cdots & a_m^n \\\\
        \\end{pmatrix}
$$

### UML

@startuml
Bob -> Alice : hello
@enduml

更多用法：<http://www.plantuml.com/>
`







exports.jianLi = `# XXX{style="text-align:center"}

 180XXXXXXXX ·  xxxxx@163.com ·  JustWrite ·  My Blog{style="text-align:center"}

## 个人信息

*  男，1994 年出生
*  求职意向：Java 研发工程师
*  工作经验：0 年（校招可不填）
*  期望薪资：0k（校招可不填）

## 教育经历

*  硕士，XXXX大学，计算机科学与技术专业，2016.9~2019.7
*  学士，XXXX大学，软件工程专业，2012.9~2016.7
*  绩点：***，年级前 100%
*  通过了 CET4/6 英语等级考试

## 工作经历

*  **XXXX 公司，XXXX 部门，XXXX 工程师，2010.1~2010.9**

   负责 XXX

## 项目经历

*  **XXXX 项目**

   *使用到的技术*

   使用一两句话描述项目的主要功能，然后介绍自己在项目中的角色，解决了什么问题，使用什么方式解决，比别人的方法相比有什么优势（尽量用数据来说明）。

## 技能清单

*  ★★★ Java
*  ★★☆ C++、Python
*  ★★★ MySQL
*  ★★★ Redis
*  ★★☆ Spring
*  ★☆☆ RabbitMQ、ZooKeeper
*  ★★☆ JavaScript

> 请使用resume简历主题预览，点击【导出】HTML，在浏览器打开后点击【打印】即可。
`