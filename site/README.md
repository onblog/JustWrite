<div align="center">

<img src="public/assets/icon.svg" width="88" alt="Miaomiao Notes" />

# miaomiao-site

Official website for **Miaomiao Notes**, a local-first Markdown notes app for macOS.

[🇨🇳 中文](README.zh-CN.md)

</div>

---

## What this is

A single-page marketing site plus two JSON endpoints, running as a Cloudflare Worker
with Static Assets. Everything that can be static is static, so the site costs
almost nothing to host.

| Route | Handler | Purpose |
| --- | --- | --- |
| `/` | Static asset | Landing page (Chinese by default, English toggle) |
| `/api/release` | Worker | Latest version manifest from R2 |
| `/api/download?arch=arm64\|x64` | Worker | Streams the dmg from R2, supports `Range` |

## Privacy

This site deliberately has no third-party anything:

- no analytics, no ads, no cookies, no external fonts or CDNs
- downloads are not logged by IP; the worker keeps no request logs
- the only state is a 60 second in-memory cache of the release manifest

## Local development

```bash
npm install
npx wrangler dev --port 8799
```

The worker binds a local R2 bucket automatically. To try the download flow:

```bash
# create a manifest and push a build into the local bucket
npx wrangler r2 object put "miaomiao-releases/releases/latest.json" --file=latest.json --local
npx wrangler r2 object put "miaomiao-releases/releases/miaomiao-notes-1.0.0-arm64.dmg" --file=path/to.dmg --local
```

## Release manifest

`releases/latest.json` in the R2 bucket describes the current build. Only the
latest version is served; uploading a new one replaces the manifest.

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

## Deploy

```bash
# one-time
npx wrangler r2 bucket create miaomiao-releases
npx wrangler r2 object put "miaomiao-releases/releases/latest.json" --file=latest.json --remote
npx wrangler r2 object put "miaomiao-releases/releases/miaomiao-notes-1.0.0-arm64.dmg" --file=… --remote

# every deploy
npm run deploy
```

The custom domain `miao.wordtk.com` is declared in `wrangler.jsonc`; wrangler
creates the DNS record and certificate on first deploy.

## Project layout

```
src/index.js        Worker: /api/release and /api/download
public/             Static assets served without invoking the worker
  index.html        Landing page
  styles.css        Single light theme
  app.js            Language toggle + release metadata
  assets/           Icon and screenshot
wrangler.jsonc      Worker config (assets, R2 binding, custom domain)
```

## License

AGPL-3.0-only, same as the app. Commercial licensing available on request.
