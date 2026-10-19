import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createFileService } from './files.js';
import { readConfig, writeConfig, publicConfig } from './config.js';
import { ACTIONS, buildMessages, streamChat } from './ai.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const DIST = path.join(ROOT, 'dist');

const PORT = Number(process.env.PORT || 7788);
const HOST = '127.0.0.1';
const TOKEN = randomBytes(24).toString('base64url');
const VAULT = path.resolve(
  process.env.JUSTWRITE_VAULT || path.join(process.env.HOME || process.cwd(), 'JustWrite'),
);

const files = createFileService(VAULT);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendError(res, error) {
  const status = error.status || 500;
  if (status >= 500) console.error('[justwrite]', error);
  sendJson(res, status, { error: error.message || 'internal error' });
}

async function readJson(req, limit = 4 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('request body too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('invalid JSON body');
    error.status = 400;
    throw error;
  }
}

/**
 * Host header must be loopback. This blocks DNS-rebinding attacks where a
 * hostile page points its own domain at 127.0.0.1 to reach this API.
 */
function isAllowedHost(hostHeader) {
  if (!hostHeader) return false;
  const host = hostHeader.toLowerCase();
  return (
    host === `127.0.0.1:${PORT}` ||
    host === `localhost:${PORT}` ||
    host === `[::1]:${PORT}`
  );
}

function isAuthorized(req) {
  const token = req.headers['x-jw-token'];
  if (!token || token.length !== TOKEN.length) return false;
  return token === TOKEN;
}

async function handleApi(req, res, url) {
  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: 'missing or invalid token' });
    return;
  }

  const route = `${req.method} ${url.pathname}`;

  switch (route) {
    case 'GET /api/health':
      sendJson(res, 200, { ok: true, vault: VAULT, version: '6.0.0' });
      return;

    case 'GET /api/config':
      sendJson(res, 200, publicConfig());
      return;

    case 'PUT /api/config': {
      const patch = await readJson(req);
      if (patch?.ai && Object.prototype.hasOwnProperty.call(patch.ai, 'apiKey')) {
        // Only accept a real key; an empty string means "keep the stored one".
        if (!patch.ai.apiKey) delete patch.ai.apiKey;
      }
      const next = writeConfig(patch);
      sendJson(res, 200, { ...next, ai: { ...next.ai, apiKey: '' } });
      return;
    }

    case 'GET /api/actions':
      sendJson(
        res,
        200,
        Object.entries(ACTIONS).map(([id, preset]) => ({ id, label: preset.label })),
      );
      return;

    case 'GET /api/tree':
      sendJson(res, 200, { vault: VAULT, nodes: await files.tree() });
      return;

    case 'GET /api/file': {
      const target = url.searchParams.get('path') || '';
      sendJson(res, 200, await files.read(target));
      return;
    }

    case 'PUT /api/file': {
      const body = await readJson(req);
      if (typeof body.path !== 'string' || typeof body.content !== 'string') {
        sendJson(res, 400, { error: 'path and content are required' });
        return;
      }
      sendJson(res, 200, await files.write(body.path, body.content));
      return;
    }

    case 'POST /api/file': {
      const body = await readJson(req);
      if (typeof body.path !== 'string') {
        sendJson(res, 400, { error: 'path is required' });
        return;
      }
      sendJson(res, 201, await files.create(body.path, body.content ?? ''));
      return;
    }

    case 'POST /api/mkdir': {
      const body = await readJson(req);
      sendJson(res, 201, await files.mkdir(body.path));
      return;
    }

    case 'DELETE /api/file': {
      const target = url.searchParams.get('path') || '';
      sendJson(res, 200, await files.remove(target));
      return;
    }

    case 'POST /api/rename': {
      const body = await readJson(req);
      if (!body.from || !body.to) {
        sendJson(res, 400, { error: 'from and to are required' });
        return;
      }
      sendJson(res, 200, await files.rename(body.from, body.to));
      return;
    }

    case 'GET /api/search': {
      const query = url.searchParams.get('q') || '';
      sendJson(res, 200, { results: await files.search(query) });
      return;
    }

    case 'POST /api/ai':
      await handleAi(req, res);
      return;

    default:
      sendJson(res, 404, { error: `unknown endpoint: ${route}` });
  }
}

async function handleAi(req, res) {
  const body = await readJson(req);
  const config = readConfig();
  const messages = buildMessages(body.action, body.text, body.options || {});

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    await streamChat({
      ai: config.ai,
      messages,
      signal: controller.signal,
      onDelta: (delta) => res.write(`data: ${JSON.stringify({ delta })}\n\n`),
    });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (error) {
    if (error.name !== 'AbortError') {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }
  } finally {
    res.end();
  }
}

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'method not allowed' });
    return;
  }

  const rel = decodeURIComponent(url.pathname);
  let target = path.join(DIST, rel === '/' ? 'index.html' : rel);

  if (!target.startsWith(DIST + path.sep) && target !== path.join(DIST, 'index.html')) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }

  let info = await fsp.stat(target).catch(() => null);
  if (!info && !path.extname(target)) {
    target = path.join(target, 'index.html');
    info = await fsp.stat(target).catch(() => null);
  }
  if (!info || !info.isFile()) {
    if (rel !== '/' && !path.extname(rel)) {
      target = path.join(DIST, 'index.html');
      info = await fsp.stat(target).catch(() => null);
    }
    if (!info) {
      sendJson(res, 404, { error: 'not found. run `npm run build` first.' });
      return;
    }
  }

  let content = await fsp.readFile(target);
  const ext = path.extname(target).toLowerCase();

  if (ext === '.html') {
    content = Buffer.from(content.toString('utf8').replaceAll('__JW_TOKEN__', TOKEN), 'utf8');
  }

  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': content.length,
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : content);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!isAllowedHost(req.headers.host)) {
      sendJson(res, 403, { error: 'invalid host header' });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    if (res.headersSent) {
      res.end();
      return;
    }
    sendError(res, error);
  }
});

async function main() {
  await files.ensureVault();

  if (!fs.existsSync(DIST)) {
    console.warn('[justwrite] dist/ not found — run `npm run build` first.');
  }

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[justwrite] port ${PORT} is already in use. Set PORT=xxxx and retry.`);
      process.exit(1);
    }
    throw error;
  });

  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  JustWrite 6 — local document workspace');
    console.log(`  →  http://${HOST}:${PORT}`);
    console.log(`  vault: ${VAULT}`);
    console.log('');
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}

main().catch((error) => {
  console.error('[justwrite] failed to start:', error);
  process.exit(1);
});
