'use strict';

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

/**
 * iCloud Drive lives at a fixed location on macOS. Putting the vault inside it
 * is enough to get system-level sync — no CloudKit, no server, no account API.
 */
const ICLOUD_ROOT = path.join(
  os.homedir(),
  'Library',
  'Mobile Documents',
  'com~apple~CloudDocs',
);

const VAULT_DIR_NAME = 'MiaomiaoNotes';

function icloudRoot() {
  return ICLOUD_ROOT;
}

function vaultPath() {
  return path.join(ICLOUD_ROOT, VAULT_DIR_NAME);
}

function isICloudAvailable() {
  try {
    return fs.statSync(ICLOUD_ROOT).isDirectory();
  } catch {
    return false;
  }
}

function isVaultReady() {
  try {
    return fs.statSync(vaultPath()).isDirectory();
  } catch {
    return false;
  }
}

/** Create the vault on first launch. Failures here are non-fatal. */
function ensureVault() {
  const target = vaultPath();
  try {
    fs.mkdirSync(target, { recursive: true });
    return { ok: true, path: target };
  } catch (error) {
    return { ok: false, path: target, error: error.message };
  }
}

/**
 * iCloud keeps undownloaded files as `.filename.md.icloud` placeholders.
 * Reading one returns an empty file, so we surface them to the UI instead.
 */
function isPlaceholder(fileName) {
  return fileName.startsWith('.') && fileName.endsWith('.icloud');
}

function placeholderTarget(fileName) {
  return fileName.replace(/^\./, '').replace(/\.icloud$/, '');
}

/**
 * Detect iCloud conflict copies such as `笔记 2.md` next to `笔记.md`.
 * We never merge automatically — merging silently is worse than a visible conflict.
 */
function findConflictCopies(dir, fileName) {
  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);
  if (!stem) return [];

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const escapedStem = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedExt = ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedStem} \\d+${escapedExt}$`);

  return entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(dir, entry.name));
}

module.exports = {
  icloudRoot,
  vaultPath,
  isICloudAvailable,
  isVaultReady,
  ensureVault,
  isPlaceholder,
  placeholderTarget,
  findConflictCopies,
  VAULT_DIR_NAME,
};
