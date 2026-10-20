<div align="center">

<img src="public/assets/icon.svg" width="88" alt="喵喵笔记" />

# miaomiao-site

**喵喵笔记** 的官网。喵喵笔记是一款只支持 macOS 的本地 Markdown 笔记应用。

[🇺🇸 English](README.md)

</div>

---

## 这是什么

一个单页营销站 + 两个 JSON 接口，跑在 Cloudflare Workers 上，静态资源走 Static Assets。
能静态的一律静态，托管成本几乎为零。

| 路由 | 处理方 | 作用 |
| --- | --- | --- |
| `/` | 静态资源 | 落地页（默认中文，可切英文） |
| `/api/release` | Worker | 从 R2 读取最新版本清单 |
| `/api/download?arch=arm64\|x64` | Worker | 从 R2 流式返回 dmg，支持 `Range` |

## 隐私

这个站刻意不接任何第三方：

- 没有统计、没有广告、没有 Cookie、没有外部字体和 CDN
- Worker 会写标准的 Workers 日志（保留 3 天）用于排查问题，但不会把 IP 落进 D1
- 唯一的“状态”是版本清单的 60 秒内存缓存

## 本地开发

```bash
npm install
npx wrangler dev --port 8799
```

本地会自动绑定一个模拟的 R2 桶。想试下载流程：

```bash
npx wrangler r2 object put "miaomiao-releases/releases/latest.json" --file=latest.json --local
npx wrangler r2 object put "miaomiao-releases/releases/miaomiao-notes-1.0.0-arm64.dmg" --file=路径.dmg --local
```

## 版本清单

R2 里的 `releases/latest.json` 描述当前版本，只提供最新版；发新版本时覆盖清单即可。

```json
{
  "version": "1.0.0",
  "released_at": "2026-10-20",
  "files": {
    "arm64": { "key": "releases/miaomiao-notes-1.0.0-arm64.dmg", "name": "miaomiao-notes-1.0.0-arm64.dmg", "size": 104189688 },
    "x64":   { "key": "releases/miaomiao-notes-1.0.0-x64.dmg",   "name": "miaomiao-notes-1.0.0-x64.dmg",   "size": 104188817 }
  }
}
```

## 部署

```bash
# 首次
npx wrangler r2 bucket create miaomiao-releases
npx wrangler r2 object put "miaomiao-releases/releases/latest.json" --file=latest.json --remote
npx wrangler r2 object put "miaomiao-releases/releases/miaomiao-notes-1.0.0-arm64.dmg" --file=… --remote

# 之后每次
npm run deploy
```

自定义域名 `miao.wordtk.com` 写在 `wrangler.jsonc` 里，首次部署时 wrangler 会自动建 DNS 记录和证书。

## 目录结构

```
src/index.js        Worker：/api/release 与 /api/download
public/             静态资源，命中时不执行 Worker
  index.html        落地页
  styles.css        单套浅色主题
  app.js            语言切换 + 版本信息
  assets/           图标与截图
wrangler.jsonc      Worker 配置（静态资源、R2 绑定、自定义域名）
```

## 开源协议

AGPL-3.0-only，与应用一致；也提供商业授权。
