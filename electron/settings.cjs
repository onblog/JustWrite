'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULTS = {
  /** 'zh' | 'en' */
  language: 'zh',
  /** send an anonymous launch beacon (random device id only) */
  telemetry: true,
  /** check for a new release on launch (at most one dialog per day) */
  autoCheckUpdates: true,
  /** internal: last UTC date a update dialog was shown */
  lastUpdateNotice: '',
  /** absolute path of the notes library; empty means "detect on first launch" */
  vaultPath: '',
  /** 'light' | 'dark' */
  theme: 'light',
  /** editor font size in px */
  fontSize: 15,
  /** autosave debounce in ms */
  autoSaveDelay: 700,
  /** quit the app when the last window closes (macOS default is to stay) */
  quitOnAllWindowsClosed: false,
  /** re-open the last edited note on launch */
  restoreLastNote: true,
  /** 'mtime' | 'ctime' | 'title' */
  sortBy: 'mtime',
  /** show a two-line preview under each title */
  showSnippet: true,
  /** open notes in preview mode by default */
  defaultPreview: false,
  /** disable the cat float animation and other transitions */
  reduceMotion: false,
};

let cache = null;

function settingsFile() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function sanitize(input) {
  const out = { ...DEFAULTS };
  if (!input || typeof input !== 'object') return out;

  if (input.language === 'zh' || input.language === 'en') out.language = input.language;
  if (typeof input.telemetry === 'boolean') out.telemetry = input.telemetry;
  if (typeof input.autoCheckUpdates === 'boolean') {
    out.autoCheckUpdates = input.autoCheckUpdates;
  }
  if (typeof input.lastUpdateNotice === 'string') {
    out.lastUpdateNotice = input.lastUpdateNotice;
  }
  if (typeof input.vaultPath === 'string') out.vaultPath = input.vaultPath;
  if (input.theme === 'light' || input.theme === 'dark') out.theme = input.theme;

  const size = Number(input.fontSize);
  if (Number.isFinite(size)) out.fontSize = Math.min(22, Math.max(12, Math.round(size)));

  const delay = Number(input.autoSaveDelay);
  if (Number.isFinite(delay)) out.autoSaveDelay = Math.min(3000, Math.max(200, Math.round(delay)));

  if (typeof input.quitOnAllWindowsClosed === 'boolean') {
    out.quitOnAllWindowsClosed = input.quitOnAllWindowsClosed;
  }
  if (typeof input.restoreLastNote === 'boolean') out.restoreLastNote = input.restoreLastNote;

  if (['mtime', 'ctime', 'title'].includes(input.sortBy)) out.sortBy = input.sortBy;
  if (typeof input.showSnippet === 'boolean') out.showSnippet = input.showSnippet;
  if (typeof input.defaultPreview === 'boolean') out.defaultPreview = input.defaultPreview;
  if (typeof input.reduceMotion === 'boolean') out.reduceMotion = input.reduceMotion;

  return out;
}

function read() {
  if (cache) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    cache = sanitize(raw);
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function write(patch) {
  const next = sanitize({ ...read(), ...patch });
  cache = next;
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf8');
  } catch (error) {
    console.error('[settings] failed to persist:', error);
  }
  return next;
}

function reset() {
  cache = { ...DEFAULTS };
  try {
    fs.rmSync(settingsFile(), { force: true });
  } catch {
    /* ignore */
  }
  return cache;
}

module.exports = { read, write, reset, DEFAULTS };
