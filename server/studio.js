import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { DATA_DIR, getActiveChannel } from './store.js';

const sessions = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function profileDirFor(channelId) {
  return path.join(DATA_DIR, 'browser-profiles', channelId);
}

async function launchPersistent(channel) {
  const existing = sessions.get(channel.id);
  if (existing?.context) {
    try {
      if (existing.context.pages().length) return existing;
    } catch {}
    sessions.delete(channel.id);
  }

  const profileDir = profileDirFor(channel.id);
  fs.mkdirSync(profileDir, { recursive: true });

  const baseOptions = { headless: false, viewport: null, args: ['--start-maximized'] };
  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, { ...baseOptions, channel: 'chrome' });
  } catch {
    context = await chromium.launchPersistentContext(profileDir, baseOptions);
  }

  const page = context.pages()[0] || await context.newPage();
  const session = { context, page, profileDir };
  sessions.set(channel.id, session);
  context.on('close', () => sessions.delete(channel.id));
  return session;
}

export async function openStudio() {
  const channel = getActiveChannel();
  const session = await launchPersistent(channel);
  await session.page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  return {
    opened: true,
    url: session.page.url(),
    channelId: channel.id,
    channelName: channel.name,
    message: `YouTube Studio opened for ${channel.name}. Sign in normally if Google asks you to.`
  };
}

async function getActivePage() {
  const channel = getActiveChannel();
  let session = sessions.get(channel.id);
  if (!session || session.page.isClosed()) {
    await openStudio();
    session = sessions.get(channel.id);
  }
  return session.page;
}

function firstMetric(lines, labels) {
  const clean = lines.map(x => x.trim()).filter(Boolean);
  const numberLike = /^[-+]?\d[\d,.]*(?:\s?[KMB])?(?:\.\d+)?%?$/i;
  for (const label of labels) {
    const index = clean.findIndex(line => line.toLowerCase() === label.toLowerCase() || line.toLowerCase().startsWith(`${label.toLowerCase()} `));
    if (index >= 0) {
      const same = clean[index].slice(label.length).trim();
      if (same && numberLike.test(same)) return same;
      for (let offset = 1; offset <= 3; offset++) {
        if (clean[index + offset] && numberLike.test(clean[index + offset])) return clean[index + offset];
      }
    }
  }
  return null;
}

function parseOverview(text) {
  const lines = text.split(/\r?\n/);
  return {
    views: firstMetric(lines, ['Views']),
    watchTimeHours: firstMetric(lines, ['Watch time (hours)', 'Watch time']),
    subscribers: firstMetric(lines, ['Subscribers']),
    impressions: firstMetric(lines, ['Impressions']),
    impressionsCtr: firstMetric(lines, ['Impressions click-through rate', 'Impressions click-through rate (%)']),
    averageViewDuration: firstMetric(lines, ['Average view duration']),
    returningViewers: firstMetric(lines, ['Returning viewers']),
    uniqueViewers: firstMetric(lines, ['Unique viewers'])
  };
}

async function clickNavigation(target) {
  const p = await getActivePage();
  const patterns = target === 'analytics' ? [/Analytics/i] : [/Content/i];
  for (const pattern of patterns) {
    try {
      const item = p.getByText(pattern, { exact: true }).first();
      if (await item.count()) {
        await item.click({ timeout: 5000 });
        await sleep(1800);
        return true;
      }
    } catch {}
  }
  try {
    const selector = target === 'analytics' ? 'a[href*="analytics"]' : 'a[href*="videos"]';
    const link = p.locator(selector).first();
    if (await link.count()) {
      await link.click({ timeout: 5000 });
      await sleep(1800);
      return true;
    }
  } catch {}
  return false;
}

async function visibleText() {
  const p = await getActivePage();
  await p.waitForLoadState('domcontentloaded').catch(() => {});
  return p.locator('body').innerText({ timeout: 20000 });
}

async function scanVideoRows() {
  const p = await getActivePage();
  return p.evaluate(() => {
    const selectors = ['ytcp-video-row', 'ytcp-video-list-cell-video', '[role="row"]'];
    let rows = [];
    for (const selector of selectors) {
      rows = Array.from(document.querySelectorAll(selector));
      if (rows.length > 1) break;
    }
    const seen = new Set();
    const out = [];
    for (const row of rows.slice(0, 60)) {
      const text = (row.innerText || '').trim();
      if (!text || text.length < 5) continue;
      const titleEl = row.querySelector('#video-title, a[href*="/video/"], a[href*="/edit"]');
      const title = (titleEl?.textContent || '').trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      out.push({ title, rawText: text.slice(0, 1800) });
    }
    return out;
  }).catch(() => []);
}

function detectLogin(text, url) {
  const combined = `${text}\n${url}`.toLowerCase();
  return combined.includes('accounts.google.com') || combined.includes('sign in to youtube') || combined.includes('choose an account');
}

export async function scanChannel() {
  const channel = getActiveChannel();
  const p = await getActivePage();
  if (!p.url().includes('studio.youtube.com')) {
    await p.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  const homeText = await visibleText();
  if (detectLogin(homeText, p.url())) {
    throw new Error(`YouTube Studio for ${channel.name} is waiting for login. Complete the login, then scan again.`);
  }

  await clickNavigation('analytics');
  await sleep(1200);
  const analyticsText = await visibleText();
  const overview = parseOverview(analyticsText);

  await clickNavigation('content');
  await sleep(1200);
  const contentText = await visibleText();
  const videos = await scanVideoRows();

  return {
    id: `snap_${Date.now()}`,
    capturedAt: new Date().toISOString(),
    channelId: channel.id,
    channelName: channel.name,
    madeForKids: channel.madeForKids,
    overview,
    videos,
    analyticsText: analyticsText.slice(0, 50000),
    contentText: contentText.slice(0, 50000),
    source: 'youtube-studio-browser',
    readOnly: true
  };
}

export async function getStudioStatus() {
  const channel = getActiveChannel();
  const session = sessions.get(channel.id);
  return {
    browserOpen: Boolean(session?.context && session?.page && !session.page.isClosed()),
    currentUrl: session?.page && !session.page.isClosed() ? session.page.url() : null,
    profileDir: profileDirFor(channel.id),
    channelId: channel.id,
    channelName: channel.name
  };
}
