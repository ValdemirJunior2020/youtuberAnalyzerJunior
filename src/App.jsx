import React, { useEffect, useMemo, useState } from 'react';

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
};

const MetricCard = ({ label, value, note }) => (
  <div className="metric-card">
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value || '—'}</div>
    {note && <div className="metric-note">{note}</div>}
  </div>
);

const StatusPill = ({ ok, children }) => (
  <span className={`status-pill ${ok ? 'ok' : 'warn'}`}>{children}</span>
);

function App() {
  const [health, setHealth] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState({ channelName: 'Bramble&Grace', model: '', ollamaUrl: 'http://127.0.0.1:11434' });

  const refresh = async () => {
    try {
      const [h, s, cfg] = await Promise.all([
        api('/api/health'),
        api('/api/snapshots'),
        api('/api/settings')
      ]);
      setHealth(h);
      setSnapshots(s);
      setSettings(cfg);
      if (!selectedId && s[0]?.id) setSelectedId(s[0].id);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => { refresh(); }, []);

  const selected = useMemo(
    () => snapshots.find(item => item.id === selectedId) || snapshots[0] || null,
    [snapshots, selectedId]
  );

  const run = async (name, fn) => {
    setBusy(name);
    setMessage('');
    try {
      await fn();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  };

  const openStudio = () => run('open', async () => {
    const result = await api('/api/studio/open', { method: 'POST' });
    setMessage(result.message || 'YouTube Studio opened.');
    await refresh();
  });

  const scan = () => run('scan', async () => {
    const snapshot = await api('/api/studio/scan', { method: 'POST' });
    setSelectedId(snapshot.id);
    setMessage(`Scan saved at ${new Date(snapshot.capturedAt).toLocaleString()}.`);
    setAnalysis('');
    setAnswer('');
    await refresh();
  });

  const analyze = () => run('analyze', async () => {
    const result = await api('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ snapshotId: selected?.id || '' })
    });
    setAnalysis(result.text);
    setMessage(`Analysis created with ${result.model}.`);
  });

  const ask = () => run('ask', async () => {
    const result = await api('/api/ask', {
      method: 'POST',
      body: JSON.stringify({ snapshotId: selected?.id || '', question })
    });
    setAnswer(result.text);
  });

  const saveSettings = () => run('settings', async () => {
    const saved = await api('/api/settings', { method: 'POST', body: JSON.stringify(settings) });
    setSettings(saved);
    setMessage('Settings saved.');
    await refresh();
  });

  const overview = selected?.overview || {};
  const models = health?.ollama?.models || [];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">LOCAL · READ ONLY · NO YOUTUBE API</div>
          <h1>Bramble&Grace Channel Analyzer</h1>
          <p>Your private YouTube Studio monitor powered by Playwright + Ollama.</p>
        </div>
        <div className="status-stack">
          <StatusPill ok={health?.ollama?.online}>{health?.ollama?.online ? 'Ollama online' : 'Ollama offline'}</StatusPill>
          <StatusPill ok={health?.studio?.browserOpen}>{health?.studio?.browserOpen ? 'Studio open' : 'Studio closed'}</StatusPill>
        </div>
      </header>

      <main>
        <section className="hero-panel">
          <div>
            <h2>Analyze your channel. Change nothing automatically.</h2>
            <p>Open YouTube Studio, sign in normally, scan the visible analytics, and let Ollama explain what can improve.</p>
          </div>
          <div className="hero-actions">
            <button className="secondary" onClick={openStudio} disabled={busy}>{busy === 'open' ? 'Opening…' : 'Open YouTube Studio'}</button>
            <button className="primary" onClick={scan} disabled={busy}>{busy === 'scan' ? 'Scanning…' : 'Scan Channel'}</button>
            <button className="accent" onClick={analyze} disabled={busy || !selected}>{busy === 'analyze' ? 'Analyzing…' : 'Analyze with Ollama'}</button>
          </div>
        </section>

        {message && <div className="message">{message}</div>}

        <section className="metrics-grid">
          <MetricCard label="Views" value={overview.views} />
          <MetricCard label="Watch Time" value={overview.watchTimeHours} note="hours when Studio provides it" />
          <MetricCard label="Subscribers" value={overview.subscribers} />
          <MetricCard label="Impressions" value={overview.impressions} />
          <MetricCard label="CTR" value={overview.impressionsCtr} />
          <MetricCard label="Avg. View Duration" value={overview.averageViewDuration} />
        </section>

        <section className="two-col">
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">HISTORY</div>
                <h3>Saved scans</h3>
              </div>
              <button className="ghost" onClick={refresh}>Refresh</button>
            </div>
            {snapshots.length === 0 ? (
              <div className="empty">No scans yet. Open Studio and scan your channel.</div>
            ) : (
              <div className="snapshot-list">
                {snapshots.map(item => (
                  <button key={item.id} className={`snapshot-row ${selected?.id === item.id ? 'active' : ''}`} onClick={() => setSelectedId(item.id)}>
                    <span>{new Date(item.capturedAt).toLocaleString()}</span>
                    <strong>{item.overview?.views || '—'} views</strong>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="eyebrow">AI REVIEW</div>
            <h3>Improvement suggestions</h3>
            <div className="analysis-box">
              {analysis ? <pre>{analysis}</pre> : <div className="empty">Run “Analyze with Ollama” after a scan. The analysis will focus on what is working, weak spots, and practical next tests.</div>}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">VIDEOS</div>
              <h3>Detected videos</h3>
            </div>
            <span className="muted">{selected?.videos?.length || 0} found in this scan</span>
          </div>
          <div className="video-table-wrap">
            <table>
              <thead><tr><th>Title</th><th>Visible Studio data</th></tr></thead>
              <tbody>
                {(selected?.videos || []).slice(0, 25).map((video, index) => (
                  <tr key={`${video.title}-${index}`}>
                    <td className="video-title">{video.title}</td>
                    <td><div className="raw-cell">{video.rawText}</div></td>
                  </tr>
                ))}
                {!selected?.videos?.length && <tr><td colSpan="2" className="empty-cell">No video rows detected yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="two-col">
          <div className="panel">
            <div className="eyebrow">ASK YOUR CHANNEL</div>
            <h3>Ask Ollama about the latest scan</h3>
            <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Example: Which videos should I study first and why?" />
            <button className="primary full" onClick={ask} disabled={busy || !question.trim() || !selected}>{busy === 'ask' ? 'Thinking…' : 'Ask Ollama'}</button>
            {answer && <div className="answer-box"><pre>{answer}</pre></div>}
          </div>

          <div className="panel">
            <div className="eyebrow">SETTINGS</div>
            <h3>Local configuration</h3>
            <label>Channel name<input value={settings.channelName || ''} onChange={e => setSettings({ ...settings, channelName: e.target.value })} /></label>
            <label>Ollama URL<input value={settings.ollamaUrl || ''} onChange={e => setSettings({ ...settings, ollamaUrl: e.target.value })} /></label>
            <label>Ollama model
              <select value={settings.model || ''} onChange={e => setSettings({ ...settings, model: e.target.value })}>
                <option value="">Auto-select installed model</option>
                {models.map(model => <option key={model} value={model}>{model}</option>)}
              </select>
            </label>
            <button className="secondary full" onClick={saveSettings} disabled={busy}>{busy === 'settings' ? 'Saving…' : 'Save Settings'}</button>
            <div className="privacy-note"><strong>Read-only by design.</strong> The app does not upload videos, change metadata, delete content, publish posts, or reply to comments.</div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
