# 喵喵笔记 · Miaomiao Notes

**A cute, local-first Markdown notes app for macOS, synced through iCloud Drive.**  
**一只喵喵的本地 Markdown 笔记应用，通过 iCloud Drive 同步。**

[🇨🇳 中文](README.zh-CN.md) · [🇺🇸 English](README.md)

---

## Why another notes app?

Because your notes should be **files**, not someone else's database.

- Three-column layout borrowed from Apple Notes: folders → notes → content
- Every note is a plain `.md` file inside iCloud Drive, so it syncs across your Macs for free
- No account, no server, no subscription, no telemetry
- A deliberately small, warm UI — one carefully made theme instead of twenty mediocre ones

## Features

| Area | What you get |
| --- | --- |
| Layout | Folder column, note column, editor — native macOS chrome |
| Editing | CodeMirror 6, Markdown syntax highlighting, live preview (⌘E) |
| Storage | Plain `.md` files in `iCloud Drive/MiaomiaoNotes` |
| Sync | macOS iCloud Drive, no extra service |
| Safety | Atomic writes, `.trash` soft delete, iCloud conflict detection |
| Search | Instant title + snippet filtering across the vault |

## Requirements

- macOS 12 or later (Apple Silicon or Intel)
- iCloud Drive enabled (optional — the app falls back to a local folder)

## Development

```bash
npm install
npm run dev      # Vite + Electron with hot reload
npm run start    # build once, then launch Electron
npm run dist     # package a macOS .dmg
```

## Where notes live

```
~/Library/Mobile Documents/com~apple~CloudDocs/MiaomiaoNotes/
```

Every note is a normal Markdown file. You can open, edit, or grep them with any
tool you like — the app never locks your data in.

## iCloud conflicts

iCloud sync is eventually consistent. If the same note is edited on two Macs
before syncing, iCloud creates a copy like `笔记 2.md`. Miaomiao Notes:

- detects those copies before and after each write
- shows a warning banner in the editor
- **never merges automatically** — silent merging loses data more often than it saves it

## Architecture

```
electron/   Main process: window, iCloud paths, file IO, native menu, IPC
src/        Renderer: three-column UI, CodeMirror editor, Markdown preview
src/styles/ Design tokens and theme (a new theme is one [data-theme] block)
```

The renderer never touches the filesystem directly — everything goes through a
narrow `contextBridge` surface with `contextIsolation` and sandbox enabled.

## License

GPL-3.0-only. See [LICENSE](LICENSE).
