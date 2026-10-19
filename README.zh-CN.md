# JustWrite

**本地优先的 Markdown 文档工作台，带 AI 写作助手。** 你的笔记始终是磁盘上的普通 `.md` 文件——不需要账号、不上传云端、不被锁定。

[🇨🇳 中文](README.zh-CN.md) · [🇺🇸 English](README.md)

---

## 为什么重做

大部分笔记软件想要你的数据。JustWrite 只想要你的文件夹。

- 本地 Node 服务 + 浏览器打开，不再需要 Electron，也不用下载 200 MB 安装包
- 每篇文档都是普通 Markdown 文件，随时可以用任何编辑器打开
- AI 能力可选，兼容任意 OpenAI 协议接口，包括本地 Ollama
- 原子写入 + `.trash` 回收目录：崩溃或误删都不会真的丢稿

## 功能

| 模块 | 内容 |
| --- | --- |
| 文档管理 | 文件树、文件夹、重命名、软删除、全文搜索 |
| 编辑体验 | CodeMirror 6、实时预览、表格、代码高亮、KaTeX 公式、任务列表 |
| AI 写作 | 润色、续写、摘要、扩写、精简、纠错、取标题、生成大纲、解释、翻译 |
| 安全 | 仅监听回环地址、Host 头校验、会话级 Token、原子写 |

## 快速开始

```bash
git clone https://github.com/onblog/JustWrite.git
cd JustWrite
npm install
npm run start
```

打开 <http://127.0.0.1:7788>。

文档库默认位于 `~/JustWrite`，可以指向任意目录：

```bash
JUSTWRITE_VAULT=~/notes npm run start
PORT=8080 npm run start
```

## 配置 AI

点右上角 **⚙ 设置**，填入任意 OpenAI 兼容接口：

| 服务商 | Base URL | 模型 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Ollama（本地） | `http://localhost:11434/v1` | `qwen2.5:7b` |

API Key 保存在 `~/.justwrite/config.json`，权限 `0600`，不会下发到浏览器。在编辑器里选中文字，切到 **AI** 面板，点任意动作即可流式生成。

## 项目结构

```
server/    Node HTTP 服务 —— 文件 CRUD、搜索、AI 代理（SSE）
web/       Vite 前端 —— CodeMirror 编辑器、Markdown 预览、AI 面板
dist/      构建产物，由 Node 进程托管
```

服务只监听 `127.0.0.1`，并拒绝 `Host` 头不是回环地址的请求，以此阻断 DNS rebinding 攻击；所有 `/api/*` 调用都需要启动时注入 HTML 的会话级 Token。

## 历史版本

Electron 桌面版（v5.x）已冻结，源码保留在 `master` 分支。

## 开源协议

GPL-3.0-only，详见 [LICENSE](LICENSE)。
