import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { DATA_DIR, getSettings } from './store.js';

let context = null;
let page = null;

const profileDir = path.join(DATA_DIR, 'browser-profile');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function launchPersistent() {
  fs.mkdirSync(profileDir, { recursive: true });

  if (context) {
    try {
      if (context.pages().length) return context;
    } catch {}
    context = null;
  }

  const baseOptions = {
    headless: false,
    viewport: null,
    args: ['--start-maximized']
  };

  try {
    context = await chromium.launchPersistentContext(profileDir, {
      ...baseOptions,
      channel: 'chrome'
    });
  } catch {
    context = await chromium.launchPersistentContext(profileDir, baseOptions);
  }

  context.on('close', () => {
    context = null;
    page = null;
  });

  return context;
}

export async function openStudio() {
  const browserContext = await launchPersistent();
  page = browserContext.pages()[0] || await browserContext.newPage();
  await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  return {
    opened: true,
    url: page.url(),
    message: 'YouTube Studio opened. Sign in normally if Google asks you to.'
  };
}

async function getActivePage() {
  if (!context || !page || page.isClosed()) await openStudio();
  return page;
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
  const patterns = target === 'analytics'
    ? [/Analytics/i]
    : [/Content/i];

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
  const videos = await p.evaluate(() => {
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
      out.push({
        title,
        rawText: text.slice(0, 1800)
      });
    }
    return out;
  }).catch(() => []);

  return videos;
}

function detectLogin(text, url) {
  const combined = `${text}\n${url}`.toLowerCase();
  return combined.includes('accounts.google.com') || combined.includes('sign in to youtube') || combined.includes('choose an account');
}

export async function scanChannel() {
  const p = await getActivePage();
  if (!p.url().includes('studio.youtube.com')) {
    await p.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  let homeText = await visibleText();
  if (detectLogin(homeText, p.url())) {
    throw new Error('YouTube Studio is waiting for login. Complete the login in the opened browser, then scan again.');
  }

  await clickNavigation('analytics');
  await sleep(1200);
  const analyticsText = await visibleText();
  const overview = parseOverview(analyticsText);

  await clickNavigation('content');
  await sleep(1200);
  const contentText = await visibleText();
  const videos = await scanVideoRows();

  const settings = getSettings();
  return {
    id: `snap_${Date.now()}`,
    capturedAt: new Date().toISOString(),
    channelName: settings.channelName,
    overview,
    videos,
    analyticsText: analyticsText.slice(0, 50000),
    contentText: contentText.slice(0, 50000),
    source: 'youtube-studio-browser',
    readOnly: true
  };
}

export async function getStudioStatus() {
  return {
    browserOpen: Boolean(context && page && !page.isClosed()),
    currentUrl: page && !page.isClosed() ? page.url() : null,
    profileDir
  };
}
