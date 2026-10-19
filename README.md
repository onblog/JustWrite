# JustWrite

**Local-first Markdown workspace with AI writing assistance.** Your notes stay as plain `.md` files on your own disk — no account, no cloud, no lock-in.

[🇨🇳 中文](README.zh-CN.md) · [🇺🇸 English](README.md)

---

## Why

Most note apps want your data. JustWrite wants your folder.

- Runs as a local Node service and opens in your browser — no Electron, no 200 MB download
- Every document is a normal Markdown file you can open with any editor
- AI assistance is optional and works with any OpenAI-compatible endpoint, including local Ollama
- Atomic writes plus a `.trash` folder: a crash or a misclick never destroys a draft

## Features

| Area | What you get |
| --- | --- |
| Documents | File tree, folders, rename, soft delete, full-text search |
| Editing | CodeMirror 6, live preview, tables, code highlighting, KaTeX math, task lists |
| AI writing | Polish, continue, summarize, expand, shorten, proofread, title, outline, explain, translate |
| Safety | Loopback-only binding, Host header checks, per-session token, atomic file writes |

## Quick start

```bash
git clone https://github.com/onblog/JustWrite.git
cd JustWrite
npm install
npm run start
```

Then open <http://127.0.0.1:7788>.

The vault defaults to `~/JustWrite`. Point it anywhere:

```bash
JUSTWRITE_VAULT=~/notes npm run start
PORT=8080 npm run start
```

## AI setup

Open **⚙ Settings** and fill in any OpenAI-compatible endpoint:

| Provider | Base URL | Model |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Ollama (local) | `http://localhost:11434/v1` | `qwen2.5:7b` |

The API key is stored in `~/.justwrite/config.json` with `0600` permissions and never sent to the browser. Select some text, open the **AI** panel, and pick an action.

## Architecture

```
server/    Node HTTP service — file CRUD, search, AI proxy (SSE)
web/       Vite frontend — CodeMirror editor, markdown preview, AI panel
dist/      Built assets served by the Node process
```

The server binds `127.0.0.1` only and rejects requests whose `Host` header is not loopback, which blocks DNS-rebinding attacks. Every `/api/*` call requires a per-session token injected into the HTML at startup.

## Previous versions

The Electron desktop edition (v5.x) is frozen. See the `master` branch for the archived source.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
