import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const defaultSettings = {
  channelName: 'Bramble&Grace',
  ollamaUrl: 'http://127.0.0.1:11434',
  model: '',
  maxSnapshots: 100,
  readOnly: true
};

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDataDir();
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDataDir();
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, file);
}

export function getSettings() {
  return { ...defaultSettings, ...readJson(SETTINGS_FILE, {}) };
}

export function saveSettings(next) {
  const current = getSettings();
  const safe = {
    ...current,
    channelName: String(next.channelName ?? current.channelName).slice(0, 120),
    ollamaUrl: String(next.ollamaUrl ?? current.ollamaUrl).replace(/\/$/, ''),
    model: String(next.model ?? current.model).slice(0, 120),
    maxSnapshots: Math.min(500, Math.max(10, Number(next.maxSnapshots ?? current.maxSnapshots) || 100)),
    readOnly: true
  };
  writeJson(SETTINGS_FILE, safe);
  return safe;
}

export function getSnapshots() {
  return readJson(SNAPSHOTS_FILE, []);
}

export function addSnapshot(snapshot) {
  const settings = getSettings();
  const snapshots = getSnapshots();
  snapshots.unshift(snapshot);
  writeJson(SNAPSHOTS_FILE, snapshots.slice(0, settings.maxSnapshots));
  return snapshot;
}

export function getSnapshot(id) {
  return getSnapshots().find(item => item.id === id) || null;
}
