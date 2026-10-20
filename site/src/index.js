/**
 * Miaomiao Notes — official site worker.
 *
 * Only /api/* reaches this script (see run_worker_first in wrangler.jsonc);
 * every other request is served straight from the static asset layer, which
 * keeps the site free and fast.
 *
 * Privacy: this worker keeps no logs, stores no IP addresses, sets no
 * cookies and calls no third parties. The only state it holds is a 60 second
 * in-memory cache of the release manifest.
 */

const MANIFEST_KEY = 'releases/latest.json';
const CACHE_TTL_MS = 60_000;
const ALLOWED_ARCH = new Set(['arm64', 'x64']);

let manifestCache = { value: null, at: 0 };

function json(status, payload, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function fail(status, code, message) {
  return json(status, { ok: false, error: { code, message } });
}

async function readManifest(env) {
  const now = Date.now();
  if (manifestCache.value && now - manifestCache.at < CACHE_TTL_MS) {
    return manifestCache.value;
  }

  const object = await env.R2_RELEASES.get(MANIFEST_KEY);
  if (!object) return null;

  let parsed;
  try {
    parsed = await object.json();
  } catch {
    return null;
  }

  manifestCache = { value: parsed, at: now };
  return parsed;
}

/** Public shape: never expose the internal R2 key. */
function publicManifest(manifest) {
  const files = {};
  for (const arch of ['arm64', 'x64']) {
    const file = manifest?.files?.[arch];
    if (!file) continue;
    files[arch] = {
      name: file.name,
      size: file.size ?? null,
      url: `/api/download?arch=${arch}`,
    };
  }
  return {
    version: manifest.version,
    released_at: manifest.released_at ?? null,
    files,
  };
}

async function handleRelease(env) {
  const manifest = await readManifest(env);
  if (!manifest) {
    return fail(503, 'release_unavailable', '安装包还没上传，稍后再来喵～');
  }
  return json(200, { ok: true, data: publicManifest(manifest) }, {
    'Cache-Control': 'public, max-age=60',
  });
}

async function handleDownload(request, env, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return fail(405, 'method_not_allowed_on_path', '只支持 GET 下载');
  }

  const arch = url.searchParams.get('arch');
  if (!ALLOWED_ARCH.has(arch)) {
    return fail(400, 'bad_request', '未知的架构，请使用 arm64 或 x64');
  }

  const manifest = await readManifest(env);
  const file = manifest?.files?.[arch];
  if (!manifest || !file?.key) {
    return fail(404, 'not_found', '当前版本没有这个架构的安装包');
  }

  // Only hand the Range header to R2 when the client actually asked for one,
  // otherwise R2 may return a ranged object for a plain GET.
  const rangeHeader = request.headers.get('range');
  const object = await env.R2_RELEASES.get(
    file.key,
    rangeHeader ? { range: request.headers } : undefined,
  );

  if (!object) {
    return fail(404, 'not_found', '安装包文件不存在');
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${safeFilename(file.name)}"`);
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('Accept-Ranges', 'bytes');
  if (object.httpEtag) headers.set('ETag', object.httpEtag);

  let status = 200;
  let body = object.body;

  if (body === null) {
    // A conditional request that only satisfied a precondition comes back body-less.
    status = 304;
  } else if (rangeHeader && object.range) {
    // R2 reports a range even for plain GETs, so gate 206 on the request header.
    status = 206;
    const offset = object.range.offset ?? 0;
    const length = object.range.length ?? object.size;
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('Content-Length', String(length));
  } else {
    headers.set('Content-Length', String(object.size));
  }

  return new Response(body, { status, headers });
}

/** Strip any character that could break the header or the filesystem. */
function safeFilename(name) {
  const base = String(name || 'miaomiao-notes.dmg').split('/').pop();
  return base.replace(/[^\w.\-]+/g, '-');
}

async function handleApi(request, env, url) {
  if (url.pathname === '/api/release') return handleRelease(env);
  if (url.pathname === '/api/download') return handleDownload(request, env, url);
  return fail(404, 'not_found', '没有这个接口');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        console.error('[api]', error);
        return fail(500, 'internal_error', '服务器开小差了，稍后再试');
      }
    }

    // Reached only if asset routing ever lets a non-API path through.
    return env.ASSETS.fetch(request);
  },
};
