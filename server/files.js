import fs from 'node:fs/promises';
import path from 'node:path';

const IGNORED_DIRS = new Set(['node_modules', '.git', '.obsidian', '.justwrite', '.trash', '.DS_Store']);
const MARKDOWN_EXT = new Set(['.md', '.markdown', '.mdown', '.txt']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class PathError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

/**
 * Resolve a client supplied relative path inside the vault.
 * Rejects absolute paths, traversal and symlink escapes.
 */
export function safeResolve(vault, relative) {
  if (typeof relative !== 'string' || relative.length === 0) {
    throw new PathError('path is required');
  }
  if (relative.includes('\0')) {
    throw new PathError('invalid path');
  }
  const normalized = path.normalize(relative).replace(/^([/\\])+/, '');
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new PathError('path escapes vault');
  }
  const root = path.resolve(vault);
  const target = path.resolve(root, normalized);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new PathError('path escapes vault');
  }
  return target;
}

async function statOrNull(target) {
  try {
    return await fs.lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function isMarkdown(name) {
  return MARKDOWN_EXT.has(path.extname(name).toLowerCase());
}

async function readTree(root, relative = '', depth = 0) {
  if (depth > 12) return [];
  const dir = relative ? path.join(root, relative) : root;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: rel,
        type: 'dir',
        children: await readTree(root, rel, depth + 1),
      });
    } else if (entry.isFile() && isMarkdown(entry.name)) {
      const info = await statOrNull(path.join(dir, entry.name));
      nodes.push({
        name: entry.name,
        path: rel,
        type: 'file',
        size: info?.size ?? 0,
        mtime: info?.mtimeMs ?? 0,
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  return nodes;
}

/** Write via a temporary file + rename so a crash never truncates the document. */
async function atomicWrite(target, content) {
  const dir = path.dirname(target);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
  const handle = await fs.open(tmp, 'w');
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, target);
}

export function createFileService(vault) {
  const root = path.resolve(vault);

  return {
    root,

    async ensureVault() {
      await fs.mkdir(root, { recursive: true });
    },

    async tree() {
      return readTree(root);
    },

    async read(relative) {
      const target = safeResolve(root, relative);
      const info = await statOrNull(target);
      if (!info) {
        const error = new Error('file not found');
        error.status = 404;
        throw error;
      }
      if (info.size > MAX_FILE_BYTES) {
        const error = new Error('file too large');
        error.status = 413;
        throw error;
      }
      const content = await fs.readFile(target, 'utf8');
      return { path: relative, content, mtime: info.mtimeMs, size: info.size };
    },

    async write(relative, content) {
      const target = safeResolve(root, relative);
      if (!isMarkdown(path.basename(target))) {
        throw new PathError('only markdown files are writable');
      }
      await atomicWrite(target, content);
      const info = await fs.stat(target);
      return { path: relative, mtime: info.mtimeMs, size: info.size };
    },

    async create(relative, content = '') {
      const target = safeResolve(root, relative);
      if (await statOrNull(target)) {
        const error = new Error('file already exists');
        error.status = 409;
        throw error;
      }
      if (!isMarkdown(path.basename(target))) {
        throw new PathError('only markdown files are supported');
      }
      await atomicWrite(target, content);
      return { path: relative };
    },

    async mkdir(relative) {
      const target = safeResolve(root, relative);
      await fs.mkdir(target, { recursive: true });
      return { path: relative };
    },

    /** Move the file into .trash instead of deleting, so a misclick is recoverable. */
    async remove(relative) {
      const target = safeResolve(root, relative);
      if (target === root) throw new PathError('cannot remove vault root');
      const trash = path.join(root, '.trash', `${Date.now()}`);
      await fs.mkdir(trash, { recursive: true });
      await fs.rename(target, path.join(trash, path.basename(target)));
      return { path: relative, trashed: true };
    },

    async rename(from, to) {
      const source = safeResolve(root, from);
      const target = safeResolve(root, to);
      if (await statOrNull(target)) {
        const error = new Error('target already exists');
        error.status = 409;
        throw error;
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.rename(source, target);
      return { from, to };
    },

    async search(query, limit = 60) {
      const needle = String(query || '').trim();
      if (needle.length < 1) return [];
      const results = [];
      const lower = needle.toLowerCase();

      const walk = async (relative) => {
        if (results.length >= limit) return;
        const dir = relative ? path.join(root, relative) : root;
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          if (results.length >= limit) return;
          if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
          const rel = relative ? `${relative}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            await walk(rel);
          } else if (entry.isFile() && isMarkdown(entry.name)) {
            const file = path.join(dir, entry.name);
            const info = await statOrNull(file);
            if (!info || info.size > MAX_FILE_BYTES) continue;
            const text = await fs.readFile(file, 'utf8');
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i += 1) {
              if (lines[i].toLowerCase().includes(lower)) {
                results.push({ path: rel, line: i + 1, text: lines[i].slice(0, 200).trim() });
                if (results.length >= limit) return;
              }
            }
          }
        }
      };

      await walk('');
      return results;
    },
  };
}
