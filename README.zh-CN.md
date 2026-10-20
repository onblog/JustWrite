# 喵喵笔记

**一只喵喵的本地 Markdown 笔记应用，通过 iCloud Drive 同步。**

[🇨🇳 中文](README.zh-CN.md) · [🇺🇸 English](README.md)

---

## 为什么又做一个笔记软件？

因为笔记应该是**文件**，而不是别人数据库里的一行记录。

- 三栏布局参考 macOS 备忘录：文件夹 → 笔记 → 内容
- 每条笔记都是 iCloud Drive 里的普通 `.md` 文件，多台 Mac 免费同步
- 没有账号、没有服务器、没有订阅、没有埋点
- 界面刻意做小做暖——一套认真打磨的主题，而不是二十套凑数的皮肤

## 功能

| 模块 | 说明 |
| --- | --- |
| 布局 | 文件夹栏、笔记栏、编辑区，原生 macOS 窗口 |
| 编辑 | CodeMirror 6、Markdown 语法高亮、实时预览（⌘E） |
| 存储 | `iCloud Drive/MiaomiaoNotes` 下的普通 `.md` 文件 |
| 同步 | 依赖 macOS 自带 iCloud Drive，不引入额外服务 |
| 安全 | 原子写入、`.trash` 软删除、iCloud 冲突检测 |
| 搜索 | 标题 + 摘要即时过滤 |

## 环境要求

- macOS 12 及以上（Apple Silicon 或 Intel）
- 已开启 iCloud Drive（可选，未开启时回退到本地目录）

## 本地开发

```bash
npm install
npm run dev      # Vite + Electron 热更新
npm run start    # 构建一次后启动 Electron
npm run dist     # 打包 macOS dmg
```

## 笔记存在哪

```
~/Library/Mobile Documents/com~apple~CloudDocs/MiaomiaoNotes/
```

每条笔记都是普通 Markdown 文件，你随时可以用别的工具打开、编辑、搜索，应用不会锁定你的数据。

## iCloud 冲突怎么处理

iCloud 是最终一致同步。同一篇笔记在两台 Mac 上编辑、且还没同步回来时，iCloud 会生成 `笔记 2.md` 这样的副本。喵喵笔记的做法是：

- 写入前后都检测冲突副本
- 在编辑区顶部给出黄色提示条
- **绝不自动合并**——静默合并丢数据的概率，比让人手动处理高得多

## 项目结构

```
electron/      主进程：窗口、iCloud 路径、文件读写、原生菜单、IPC
src/           渲染进程：三栏 UI、CodeMirror 编辑器、Markdown 预览
src/styles/    设计变量与主题（换肤只需新增一个 [data-theme] 块）
build/         应用图标源文件（SVG + 生成的 icns）
```

渲染进程不直接碰文件系统，所有能力都通过 `contextBridge` 暴露的窄接口，
并且开启了 `contextIsolation` 与 sandbox。

## 开源协议

GPL-3.0-only，详见 [LICENSE](LICENSE)。
