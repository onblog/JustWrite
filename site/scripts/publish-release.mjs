#!/usr/bin/env node
/**
 * Publish the packaged dmgs to R2 and point the site at the new version.
 *
 *   1. upload release/miaomiao-notes-<version>-<arch>.dmg -> R2 releases/
 *   2. rewrite site/latest.json (the manifest the Worker serves)
 *   3. upload the manifest -> R2 releases/latest.json
 *
 * Run `npm run dist` first, then `npm run release` from site/. The worker code
 * itself does not change between releases, so no `wrangler deploy` is needed
 * for a plain version bump.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const siteDir = path.resolve(import.meta.dirname, '..');
const repoDir = path.resolve(siteDir, '..');
const releaseDir = path.join(repoDir, 'release');
const wranglerBin = path.join(siteDir, 'node_modules', '.bin', 'wrangler');
const BUCKET = 'miaomiao';
const ARCHES = ['arm64', 'x64'];

const { version } = JSON.parse(
  fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'),
);

/**
 * wrangler 4.144 on Node 25 does the work and then never exits (an open
 * handle keeps the process alive), so `await child.exitCode` would hang
 * forever. Wait for the success line, then stop the process ourselves; a
 * non-zero exit before that line is a real failure.
 */
function runWrangler(args, successPattern, timeoutMs = 10 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const child = spawn(wranglerBin, args, {
      cwd: siteDir,
      env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 2000).unref();
      error ? reject(error) : resolve(output);
    };

    const timer = setTimeout(
      () => finish(new Error(`wrangler timed out after ${timeoutMs}ms:\n${output}`)),
      timeoutMs,
    );

    const onData = (chunk) => {
      output += chunk.toString();
      if (successPattern.test(output)) finish(null);
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', finish);
    child.on('exit', (code) => {
      if (successPattern.test(output)) return finish(null);
      finish(new Error(`wrangler exited with code ${code}:\n${output}`));
    });
  });
}

function sizeOf(file) {
  return fs.statSync(file).size;
}

const UPLOAD_ATTEMPTS = 3;

/**
 * R2 uploads occasionally die on a transient Cloudflare API timeout. Retrying
 * matters most for the manifest: until it lands the site keeps announcing the
 * previous version, even though the new dmgs are already in the bucket.
 */
async function upload(localFile, key) {
  const args = ['r2', 'object', 'put', `${BUCKET}/${key}`, `--file=${localFile}`, '--remote'];
  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      return await runWrangler(args, /Upload complete/i);
    } catch (error) {
      if (attempt === UPLOAD_ATTEMPTS) throw error;
      const first = String(error.message).split('\n').find((line) => line.trim()) || 'unknown error';
      console.log(`  attempt ${attempt}/${UPLOAD_ATTEMPTS} failed: ${first.trim()}`);
      await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
    }
  }
}

async function main() {
  if (!fs.existsSync(wranglerBin)) {
    throw new Error(`wrangler not installed; run npm install in ${siteDir}`);
  }

  const files = {};
  for (const arch of ARCHES) {
    const name = `miaomiao-notes-${version}-${arch}.dmg`;
    const file = path.join(releaseDir, name);
    if (!fs.existsSync(file)) {
      throw new Error(`missing ${file}; run "npm run dist" first`);
    }
    files[arch] = { key: `releases/${name}`, name, size: sizeOf(file) };
  }

  for (const arch of ARCHES) {
    const { key, name } = files[arch];
    console.log(`uploading ${name} (${(files[arch].size / 1024 / 1024).toFixed(1)} MB)`);
    await upload(path.join(releaseDir, name), key);
  }

  const manifest = {
    version,
    released_at: new Date().toISOString().slice(0, 10),
    files,
  };
  const manifestPath = path.join(siteDir, 'latest.json');
  // One file per line, so a version bump reads as a real 4-line diff.
  const inline = (file) => `{ ${Object.entries(file).map(([k, v]) => `"${k}": ${JSON.stringify(v)}`).join(', ')} }`;
  const body = [
    '{',
    `  "version": "${manifest.version}",`,
    `  "released_at": "${manifest.released_at}",`,
    '  "files": {',
    `    "arm64": ${inline(files.arm64)},`,
    `    "x64":   ${inline(files.x64)}`,
    '  }',
    '}',
    '',
  ].join('\n');
  fs.writeFileSync(manifestPath, body);
  console.log(`wrote ${path.relative(process.cwd(), manifestPath)}`);

  await upload(manifestPath, 'releases/latest.json');

  console.log(`published ${version}: ${ARCHES.join(', ')}`);
}

main().catch((error) => {
  console.error(`release failed: ${error.message}`);
  process.exit(1);
});
