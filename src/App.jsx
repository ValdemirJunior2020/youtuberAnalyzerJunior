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
  const [settings, setSettings] = useState({ model: '', ollamaUrl: 'http://127.0.0.1:11434', channels: [], activeChannelId: '' });
  const [newChannel, setNewChannel] = useState({ name: '', madeForKids: false, notes: '' });

  const activeChannel = useMemo(
    () => settings.channels?.find(c => c.id === settings.activeChannelId) || settings.channels?.[0] || null,
    [settings]
  );

  const refresh = async () => {
    try {
      const [h, cfg] = await Promise.all([api('/api/health'), api('/api/settings')]);
      setHealth(h);
      setSettings(cfg);
      const channelId = cfg.activeChannelId || cfg.channels?.[0]?.id || '';
      const s = await api(`/api/snapshots?channelId=${encodeURIComponent(channelId)}`);
      setSnapshots(s);
      setSelectedId(current => s.some(item => item.id === current) ? current : (s[0]?.id || ''));
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
    try { await fn(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(''); }
  };

  const switchChannel = id => run('switch', async () => {
    await api(`/api/channels/${encodeURIComponent(id)}/activate`, { method: 'POST' });
    setAnalysis('');
    setAnswer('');
    setSelectedId('');
    await refresh();
  });

  const addChannel = () => run('addChannel', async () => {
    if (!newChannel.name.trim()) throw new Error('Enter a channel name.');
    await api('/api/channels', { method: 'POST', body: JSON.stringify(newChannel) });
    setNewChannel({ name: '', madeForKids: false, notes: '' });
    setAnalysis('');
    setAnswer('');
    await refresh();
    setMessage('Channel added. Open YouTube Studio and sign in to that channel once.');
  });

  const removeActiveChannel = () => run('removeChannel', async () => {
    if (!activeChannel) return;
    if (!window.confirm(`Remove ${activeChannel.name} from this analyzer? Saved YouTube data in your browser profile will stay on disk.`)) return;
    await api(`/api/channels/${encodeURIComponent(activeChannel.id)}`, { method: 'DELETE' });
    setSelectedId('');
    setAnalysis('');
    setAnswer('');
    await refresh();
  });

  const openStudio = () => run('open', async () => {
    const result = await api('/api/studio/open', { method: 'POST' });
    setMessage(result.message || 'YouTube Studio opened.');
    await refresh();
  });

  const scan = () => run('scan', async () => {
    const snapshot = await api('/api/studio/scan', { method: 'POST' });
    setSelectedId(snapshot.id);
    setMessage(`Scan saved for ${snapshot.channelName} at ${new Date(snapshot.capturedAt).toLocaleString()}.`);
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
    const saved = await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ ollamaUrl: settings.ollamaUrl, model: settings.model })
    });
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
          <h1>YouTuber Analyzer Junior</h1>
          <p>Analyze as many YouTube channels as you want with separate logins, history, and Ollama insights.</p>
        </div>
        <div className="status-stack">
          <StatusPill ok={health?.ollama?.online}>{health?.ollama?.online ? 'Ollama online' : 'Ollama offline'}</StatusPill>
          <StatusPill ok={health?.studio?.browserOpen}>{health?.studio?.browserOpen ? 'Studio open' : 'Studio closed'}</StatusPill>
        </div>
      </header>

      <main>
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">CHANNELS</div>
              <h3>{activeChannel ? `Active: ${activeChannel.name}` : 'Add your first channel'}</h3>
              <div className="muted">Each channel gets its own saved Chrome login and its own scan history.</div>
            </div>
            {settings.channels?.length > 1 && <button className="ghost" onClick={removeActiveChannel} disabled={busy}>Remove active channel</button>}
          </div>

          <label>Switch channel
            <select value={settings.activeChannelId || ''} onChange={e => switchChannel(e.target.value)} disabled={busy}>
              {(settings.channels || []).map(channel => (
                <option key={channel.id} value={channel.id}>{channel.name}{channel.madeForKids ? ' · Made for Kids' : ''}</option>
              ))}
            </select>
          </label>

          <div className="two-col">
            <div>
              <label>Add another channel<input value={newChannel.name} onChange={e => setNewChannel({ ...newChannel, name: e.target.value })} placeholder="Example: Bible in One Minute" /></label>
              <label>Notes<input value={newChannel.notes} onChange={e => setNewChannel({ ...newChannel, notes: e.target.value })} placeholder="Optional channel purpose" /></label>
            </div>
            <div>
              <label className="check-label"><input type="checkbox" checked={newChannel.madeForKids} onChange={e => setNewChannel({ ...newChannel, madeForKids: e.target.checked })} /> Made for Kids channel</label>
              <div className="privacy-note">Made for Kids profiles automatically tell Ollama not to expect or recommend comments.</div>
              <button className="secondary full" onClick={addChannel} disabled={busy}>{busy === 'addChannel' ? 'Adding…' : '+ Add Channel'}</button>
            </div>
          </div>
        </section>

        <section className="hero-panel">
          <div>
            <h2>{activeChannel ? `Analyze ${activeChannel.name}` : 'Analyze your channel'}</h2>
            <p>Open the dedicated YouTube Studio session, sign in once, scan the visible analytics, and let Ollama explain what can improve.</p>
          </div>
          <div className="hero-actions">
            <button className="secondary" onClick={openStudio} disabled={busy || !activeChannel}>{busy === 'open' ? 'Opening…' : 'Open YouTube Studio'}</button>
            <button className="primary" onClick={scan} disabled={busy || !activeChannel}>{busy === 'scan' ? 'Scanning…' : 'Scan Channel'}</button>
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
              <div><div className="eyebrow">HISTORY</div><h3>Saved scans</h3></div>
              <button className="ghost" onClick={refresh}>Refresh</button>
            </div>
            {snapshots.length === 0 ? <div className="empty">No scans yet for this channel.</div> : (
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
            <div className="analysis-box">{analysis ? <pre>{analysis}</pre> : <div className="empty">Run “Analyze with Ollama” after a scan.</div>}</div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><div className="eyebrow">VIDEOS</div><h3>Detected videos</h3></div>
            <span className="muted">{selected?.videos?.length || 0} found in this scan</span>
          </div>
          <div className="video-table-wrap"><table>
            <thead><tr><th>Title</th><th>Visible Studio data</th></tr></thead>
            <tbody>
              {(selected?.videos || []).slice(0, 25).map((video, index) => <tr key={`${video.title}-${index}`}><td className="video-title">{video.title}</td><td><div className="raw-cell">{video.rawText}</div></td></tr>)}
              {!selected?.videos?.length && <tr><td colSpan="2" className="empty-cell">No video rows detected yet.</td></tr>}
            </tbody>
          </table></div>
        </section>

        <section className="two-col">
          <div className="panel">
            <div className="eyebrow">ASK YOUR CHANNEL</div>
            <h3>Ask Ollama about this channel</h3>
            <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Example: What should I improve next?" />
            <button className="primary full" onClick={ask} disabled={busy || !question.trim() || !selected}>{busy === 'ask' ? 'Thinking…' : 'Ask Ollama'}</button>
            {answer && <div className="answer-box"><pre>{answer}</pre></div>}
          </div>

          <div className="panel">
            <div className="eyebrow">SETTINGS</div>
            <h3>Local configuration</h3>
            <label>Ollama URL<input value={settings.ollamaUrl || ''} onChange={e => setSettings({ ...settings, ollamaUrl: e.target.value })} /></label>
            <label>Ollama model<select value={settings.model || ''} onChange={e => setSettings({ ...settings, model: e.target.value })}><option value="">Auto-select installed model</option>{models.map(model => <option key={model} value={model}>{model}</option>)}</select></label>
            <button className="secondary full" onClick={saveSettings} disabled={busy}>{busy === 'settings' ? 'Saving…' : 'Save Settings'}</button>
            <div className="privacy-note"><strong>Read-only by design.</strong> Every channel is analyzed separately. The app never uploads, deletes, publishes, or edits YouTube content.</div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
