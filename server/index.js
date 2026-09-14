import express from 'express';
import {
  addChannel, addSnapshot, getActiveChannel, getChannels, getSettings, getSnapshot,
  getSnapshots, removeChannel, saveSettings, setActiveChannel, updateChannel
} from './store.js';
import { analyzeSnapshot, askChannel, getOllamaStatus } from './ollama.js';
import { getStudioStatus, openStudio, scanChannel } from './studio.js';

const app = express();
const PORT = Number(process.env.PORT || 8788);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  const [ollama, studio] = await Promise.all([getOllamaStatus(), getStudioStatus()]);
  res.json({ ok: true, ollama, studio, settings: getSettings(), activeChannel: getActiveChannel() });
});

app.get('/api/settings', (_req, res) => res.json(getSettings()));
app.post('/api/settings', (req, res) => res.json(saveSettings(req.body || {})));

app.get('/api/channels', (_req, res) => res.json({ channels: getChannels(), activeChannel: getActiveChannel() }));
app.post('/api/channels', (req, res) => {
  try { res.json(addChannel(req.body || {})); }
  catch (error) { res.status(400).json({ error: error.message }); }
});
app.post('/api/channels/:id/activate', (req, res) => {
  try { res.json(setActiveChannel(req.params.id)); }
  catch (error) { res.status(404).json({ error: error.message }); }
});
app.post('/api/channels/:id', (req, res) => {
  try { res.json(updateChannel(req.params.id, req.body || {})); }
  catch (error) { res.status(404).json({ error: error.message }); }
});
app.delete('/api/channels/:id', (req, res) => {
  try { res.json(removeChannel(req.params.id)); }
  catch (error) { res.status(400).json({ error: error.message }); }
});

app.post('/api/studio/open', async (_req, res) => {
  try { res.json(await openStudio()); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/studio/scan', async (_req, res) => {
  try {
    const snapshot = await scanChannel();
    addSnapshot(snapshot);
    res.json(snapshot);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/snapshots', (req, res) => {
  const channelId = String(req.query.channelId || getActiveChannel().id);
  res.json(getSnapshots(channelId).map(item => ({
    id: item.id, capturedAt: item.capturedAt, channelId: item.channelId,
    channelName: item.channelName, overview: item.overview, videos: item.videos
  })));
});

app.get('/api/snapshots/:id', (req, res) => {
  const snapshot = getSnapshot(req.params.id);
  if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
  res.json(snapshot);
});

app.post('/api/analyze', async (req, res) => {
  try {
    const active = getActiveChannel();
    const snapshots = getSnapshots(active.id);
    const snapshot = req.body?.snapshotId ? getSnapshot(req.body.snapshotId) : snapshots[0];
    if (!snapshot) return res.status(400).json({ error: 'Scan the channel first.' });
    res.json(await analyzeSnapshot(snapshot, String(req.body?.focus || '')));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/ask', async (req, res) => {
  try {
    const question = String(req.body?.question || '').trim();
    if (!question) return res.status(400).json({ error: 'Question is required.' });
    const active = getActiveChannel();
    const snapshots = getSnapshots(active.id);
    const snapshot = req.body?.snapshotId ? getSnapshot(req.body.snapshotId) : snapshots[0];
    if (!snapshot) return res.status(400).json({ error: 'Scan the channel first.' });
    res.json(await askChannel(snapshot, question));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`YouTuber Analyzer backend running on http://127.0.0.1:${PORT}`);
});
