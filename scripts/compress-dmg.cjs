'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Re-pack the UDZO dmg electron-builder produces into ULMO (lzfse).
 *
 * Measured on this app: UDZO 99 MB -> ULMO 73 MB, ~10 s. ULMO is a native
 * macOS format (10.11+), so users still drag the app to Applications exactly
 * like a normal dmg — no extra tooling, unlike zip or tar.zst.
 */
const arch = process.argv[2] || 'arm64';
const { version } = require('../package.json');

const releaseDir = path.resolve(__dirname, '..', 'release');
const target = path.join(releaseDir, `miaomiao-notes-${version}-${arch}.dmg`);
const temp = path.join(releaseDir, `.ulmo-${arch}.dmg`);

if (!fs.existsSync(target)) {
  console.error(`[compress] missing ${target}`);
  process.exit(1);
}

const before = fs.statSync(target).size;

execFileSync('hdiutil', ['convert', target, '-format', 'ULMO', '-o', temp], {
  stdio: 'inherit',
});

if (!fs.existsSync(temp)) {
  console.error('[compress] hdiutil produced no output');
  process.exit(1);
}

fs.renameSync(temp, target);

const after = fs.statSync(target).size;
const saved = ((1 - after / before) * 100).toFixed(1);
console.log(
  `[compress] ${path.basename(target)}  ${(before / 1048576).toFixed(0)} MB -> ${(
    after / 1048576
  ).toFixed(0)} MB  (-${saved}%)`,
);
