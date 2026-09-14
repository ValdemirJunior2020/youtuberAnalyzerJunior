import express from 'express';
import { addSnapshot, getSettings, getSnapshot, getSnapshots, saveSettings } from './store.js';
import { analyzeSnapshot, askChannel, getOllamaStatus } from './ollama.js';
import { getStudioStatus, openStudio, scanChannel } from './studio.js';

const app = express();
const PORT = Number(process.env.PORT || 8788);

app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  const [ollama, studio] = await Promise.all([getOllamaStatus(), getStudioStatus()]);
  res.json({ ok: true, ollama, studio, settings: getSettings() });
});

app.get('/api/settings', (_req, res) => {
  res.json(getSettings());
});

app.post('/api/settings', (req, res) => {
  res.json(saveSettings(req.body || {}));
});

app.post('/api/studio/open', async (_req, res) => {
  try {
    res.json(await openStudio());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/studio/scan', async (_req, res) => {
  try {
    const snapshot = await scanChannel();
    addSnapshot(snapshot);
    res.json(snapshot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/snapshots', (_req, res) => {
  const snapshots = getSnapshots().map(item => ({
    id: item.id,
    capturedAt: item.capturedAt,
    channelName: item.channelName,
    overview: item.overview,
    videos: item.videos
  }));
  res.json(snapshots);
});

app.get('/api/snapshots/:id', (req, res) => {
  const snapshot = getSnapshot(req.params.id);
  if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
  res.json(snapshot);
});

app.post('/api/analyze', async (req, res) => {
  try {
    const snapshots = getSnapshots();
    const snapshot = req.body?.snapshotId ? getSnapshot(req.body.snapshotId) : snapshots[0];
    if (!snapshot) return res.status(400).json({ error: 'Scan the channel first.' });
    const result = await analyzeSnapshot(snapshot, String(req.body?.focus || ''));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ask', async (req, res) => {
  try {
    const question = String(req.body?.question || '').trim();
    if (!question) return res.status(400).json({ error: 'Question is required.' });
    const snapshots = getSnapshots();
    const snapshot = req.body?.snapshotId ? getSnapshot(req.body.snapshotId) : snapshots[0];
    if (!snapshot) return res.status(400).json({ error: 'Scan the channel first.' });
    res.json(await askChannel(snapshot, question));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`YouTuber Analyzer backend running on http://127.0.0.1:${PORT}`);
});
