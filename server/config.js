import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'node:fs';

const CONFIG_DIR = join(homedir(), '.justwrite');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  ai: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.7,
  },
  editor: {
    theme: 'default',
    fontSize: 15,
    autoSaveDelay: 800,
  },
};

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    out[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? deepMerge(base[key] || {}, value)
        : value;
  }
  return out;
}

export function readConfig() {
  try {
    if (!existsSync(CONFIG_FILE)) return structuredClone(DEFAULTS);
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    return deepMerge(DEFAULTS, raw);
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function writeConfig(patch) {
  const next = deepMerge(readConfig(), patch);
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), { mode: 0o600 });
  try {
    chmodSync(CONFIG_FILE, 0o600);
  } catch {
    /* best effort on exotic filesystems */
  }
  return next;
}

/** Public view: never leak the API key to the browser, only a masked hint. */
export function publicConfig() {
  const config = readConfig();
  const key = config.ai.apiKey || '';
  return {
    ...config,
    ai: {
      ...config.ai,
      apiKey: '',
      hasApiKey: key.length > 0,
      apiKeyHint: key ? `${key.slice(0, 4)}…${key.slice(-4)}` : '',
    },
  };
}
