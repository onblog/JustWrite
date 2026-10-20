'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

/**
 * Ad-hoc sign the packaged app before the dmg is built.
 *
 * electron-builder's `identity: "-"` is not understood as ad-hoc — it looks
 * for a certificate literally named "-" and silently skips signing. Without a
 * signature the bundle has no sealed resources, and macOS reports the app as
 * "damaged" instead of "unverified developer".
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  execFileSync('codesign', ['--deep', '--force', '--sign', '-', appPath], {
    stdio: 'inherit',
  });

  const info = execFileSync('codesign', ['-dv', appPath], { encoding: 'utf8' });
  const sealed = info.split('\n').find((line) => line.startsWith('Sealed Resources')) ?? '';
  console.log(`[after-pack] ad-hoc signed ${appPath}`);
  console.log(`[after-pack] ${sealed.trim()}`);
};
