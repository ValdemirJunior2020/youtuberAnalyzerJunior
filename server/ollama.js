import { getSettings } from './store.js';

async function request(path, options = {}) {
  const settings = getSettings();
  const response = await fetch(`${settings.ollamaUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
  return response.json();
}

export async function getOllamaStatus() {
  try {
    const data = await request('/api/tags');
    const models = (data.models || []).map(model => model.name);
    return { online: true, models };
  } catch (error) {
    return { online: false, models: [], error: error.message };
  }
}

function chooseModel(models, preferred) {
  if (preferred && models.includes(preferred)) return preferred;
  if (preferred) {
    const close = models.find(name => name.startsWith(preferred.split(':')[0]));
    if (close) return close;
  }
  return models[0] || '';
}

function channelSystem(snapshot) {
  const audience = snapshot.madeForKids
    ? 'This channel is marked Made for Kids. YouTube comments are normally unavailable, so do not treat missing comments as a weakness and do not recommend comment-based strategies.'
    : 'This is a general-audience channel. Comments may be useful when they are present in the supplied Studio data.';
  return `You are the private YouTube channel analyst for ${snapshot.channelName || 'this channel'}. ${audience} Analyze only the channel data provided. Be practical, conservative, and easy to understand. Never invent metrics. If a metric is missing, say it is unavailable. Focus on patterns that can improve titles, thumbnails, hooks, pacing, retention, upload consistency, audience fit, and episode packaging. Return concise Markdown with these headings: Channel Health, What Is Working, What Needs Attention, Best Opportunities, Suggested Tests, Next 3 Actions.`;
}

export async function analyzeSnapshot(snapshot, focus = '') {
  const status = await getOllamaStatus();
  if (!status.online) throw new Error('Ollama is not running. Start Ollama and try again.');
  const settings = getSettings();
  const model = chooseModel(status.models, settings.model);
  if (!model) throw new Error('No Ollama model is installed. Install a model such as qwen3:8b first.');

  const trimmed = {
    capturedAt: snapshot.capturedAt,
    channelName: snapshot.channelName,
    madeForKids: snapshot.madeForKids,
    overview: snapshot.overview,
    videos: (snapshot.videos || []).slice(0, 40),
    analyticsText: String(snapshot.analyticsText || '').slice(0, 22000),
    contentText: String(snapshot.contentText || '').slice(0, 16000)
  };

  const user = `Analyze this saved YouTube Studio snapshot. ${focus ? `Special focus: ${focus}` : ''}\n\nDATA:\n${JSON.stringify(trimmed, null, 2)}`;
  const data = await request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: channelSystem(snapshot) },
        { role: 'user', content: user }
      ],
      options: { temperature: 0.2 }
    })
  });
  return { model, text: data.message?.content || 'No analysis returned.' };
}

export async function askChannel(snapshot, question) {
  const status = await getOllamaStatus();
  if (!status.online) throw new Error('Ollama is not running.');
  const settings = getSettings();
  const model = chooseModel(status.models, settings.model);
  if (!model) throw new Error('No Ollama model is installed.');

  const audienceRule = snapshot.madeForKids
    ? 'This is Made for Kids content, so comments are normally disabled by YouTube. Do not suggest comment-based analysis.'
    : 'Comments may be considered only if they appear in the supplied data.';

  const data = await request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: 'system',
          content: `You answer questions about the ${snapshot.channelName || 'selected'} YouTube channel using only the supplied YouTube Studio snapshot. ${audienceRule} Never invent numbers. Keep answers short, clear, and useful.`
        },
        {
          role: 'user',
          content: `Question: ${question}\n\nSnapshot:\n${JSON.stringify({ overview: snapshot.overview, videos: snapshot.videos, analyticsText: String(snapshot.analyticsText || '').slice(0, 18000) }, null, 2)}`
        }
      ],
      options: { temperature: 0.15 }
    })
  });
  return { model, text: data.message?.content || 'No answer returned.' };
}
