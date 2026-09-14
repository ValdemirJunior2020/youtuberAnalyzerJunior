# YouTuber Analyzer Junior

Local-first YouTube Studio analyzer for **Bramble&Grace**.

This project does **not** use the YouTube Data API or YouTube Analytics API. It opens YouTube Studio in a persistent browser profile, lets the channel owner sign in normally, reads analytics visible in Studio, stores snapshots locally, and uses Ollama to explain performance and suggest improvements.

## Main features

- Persistent Chrome/Chromium profile for YouTube Studio login
- Read-only Studio scanner using Playwright
- Channel overview metrics and recent video table
- Local snapshot history in `data/`
- Ollama analysis with practical improvement suggestions
- Ask-your-channel chat using saved Studio data
- No YouTube API key, Google Cloud project, or paid AI API required
- Smart Windows `INSTALL.bat` and `START.bat`

## Quick start

1. Run `INSTALL.bat` once.
2. Run `START.bat`.
3. Open the dashboard at `http://127.0.0.1:5173`.
4. Click **Open YouTube Studio** and sign in if needed.
5. Click **Scan Channel**.
6. Click **Analyze with Ollama**.

The browser profile is stored locally under `data/browser-profile`. Passwords are not stored by this app.

## Safety

The scanner is intentionally read-only. It does not upload, delete, edit, publish, or reply to anything on YouTube.

## Notes

YouTube Studio changes its interface from time to time. The scanner uses several fallback selectors and also stores raw visible analytics text so the Ollama analysis can still work when individual metrics move.
