import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const DEFAULT_CHANNEL = {
  id: 'bramble-grace',
  name: 'Bramble&Grace',
  madeForKids: true,
  notes: 'Christian children storytelling channel'
};

const defaultSettings = {
  ollamaUrl: 'http://127.0.0.1:11434',
  model: '',
  maxSnapshots: 500,
  readOnly: true,
  activeChannelId: DEFAULT_CHANNEL.id,
  channels: [DEFAULT_CHANNEL]
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

function slug(value) {
  const out = String(value || 'channel')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return out || 'channel';
}

function migrate(raw) {
  const settings = { ...defaultSettings, ...(raw || {}) };
  if (!Array.isArray(settings.channels) || !settings.channels.length) {
    const name = String(raw?.channelName || DEFAULT_CHANNEL.name);
    settings.channels = [{ ...DEFAULT_CHANNEL, id: slug(name), name }];
  }
  settings.channels = settings.channels.map((channel, index) => ({
    id: String(channel.id || `${slug(channel.name)}-${index + 1}`),
    name: String(channel.name || `Channel ${index + 1}`).slice(0, 120),
    madeForKids: Boolean(channel.madeForKids),
    notes: String(channel.notes || '').slice(0, 500)
  }));
  if (!settings.channels.some(c => c.id === settings.activeChannelId)) {
    settings.activeChannelId = settings.channels[0].id;
  }
  delete settings.channelName;
  return settings;
}

export function getSettings() {
  return migrate(readJson(SETTINGS_FILE, {}));
}

export function saveSettings(next) {
  const current = getSettings();
  const safe = {
    ...current,
    ollamaUrl: String(next.ollamaUrl ?? current.ollamaUrl).replace(/\/$/, ''),
    model: String(next.model ?? current.model).slice(0, 120),
    maxSnapshots: Math.min(5000, Math.max(10, Number(next.maxSnapshots ?? current.maxSnapshots) || 500)),
    readOnly: true
  };
  writeJson(SETTINGS_FILE, safe);
  return safe;
}

export function getChannels() {
  return getSettings().channels;
}

export function getActiveChannel() {
  const settings = getSettings();
  return settings.channels.find(c => c.id === settings.activeChannelId) || settings.channels[0];
}

export function addChannel(input = {}) {
  const settings = getSettings();
  const name = String(input.name || '').trim().slice(0, 120);
  if (!name) throw new Error('Channel name is required.');
  let id = slug(name);
  let n = 2;
  while (settings.channels.some(c => c.id === id)) id = `${slug(name)}-${n++}`;
  const channel = {
    id,
    name,
    madeForKids: Boolean(input.madeForKids),
    notes: String(input.notes || '').trim().slice(0, 500)
  };
  settings.channels.push(channel);
  settings.activeChannelId = channel.id;
  writeJson(SETTINGS_FILE, settings);
  return channel;
}

export function setActiveChannel(id) {
  const settings = getSettings();
  const channel = settings.channels.find(c => c.id === id);
  if (!channel) throw new Error('Channel not found.');
  settings.activeChannelId = channel.id;
  writeJson(SETTINGS_FILE, settings);
  return channel;
}

export function updateChannel(id, input = {}) {
  const settings = getSettings();
  const index = settings.channels.findIndex(c => c.id === id);
  if (index < 0) throw new Error('Channel not found.');
  settings.channels[index] = {
    ...settings.channels[index],
    name: String(input.name ?? settings.channels[index].name).trim().slice(0, 120),
    madeForKids: input.madeForKids == null ? settings.channels[index].madeForKids : Boolean(input.madeForKids),
    notes: String(input.notes ?? settings.channels[index].notes).trim().slice(0, 500)
  };
  writeJson(SETTINGS_FILE, settings);
  return settings.channels[index];
}

export function removeChannel(id) {
  const settings = getSettings();
  if (settings.channels.length <= 1) throw new Error('Keep at least one channel.');
  settings.channels = settings.channels.filter(c => c.id !== id);
  if (!settings.channels.some(c => c.id === settings.activeChannelId)) {
    settings.activeChannelId = settings.channels[0].id;
  }
  writeJson(SETTINGS_FILE, settings);
  return settings;
}

export function getSnapshots(channelId = '') {
  const all = readJson(SNAPSHOTS_FILE, []);
  return channelId ? all.filter(item => item.channelId === channelId) : all;
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
