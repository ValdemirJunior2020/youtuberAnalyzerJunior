# YouTuber Analyzer Junior

Local-first YouTube Studio analyzer for **multiple YouTube channels**.

This project does **not** use the YouTube Data API or YouTube Analytics API. It opens YouTube Studio in a persistent browser profile, lets the channel owner sign in normally, reads analytics visible in Studio, stores snapshots locally, and uses Ollama to explain performance and suggest improvements.

## Main features

- Add as many YouTube channel profiles as you want
- Separate persistent Chrome/Chromium login profile for every channel
- Separate scan history and analysis for every channel
- Made for Kids option so Ollama knows comments are normally unavailable
- General channel option where comments may be considered when visible
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
4. Add or select a channel.
5. Click **Open YouTube Studio** and sign in to that channel if needed.
6. Click **Scan Channel**.
7. Click **Analyze with Ollama**.
8. Switch channels any time from the channel selector.

Each channel browser profile is stored locally under `data/browser-profiles/<channel-id>`. Passwords are not stored by this app.

## Made for Kids

When a channel profile is marked **Made for Kids**, the Ollama analyst is told not to treat missing comments as a problem and not to recommend comment-based strategies. For general or Bible channels, comments can be considered when they appear in the Studio data.

## Safety

The scanner is intentionally read-only. It does not upload, delete, edit, publish, or reply to anything on YouTube.

## Notes

YouTube Studio changes its interface from time to time. The scanner uses fallback selectors and also stores raw visible analytics text so the Ollama analysis can still work when individual metrics move.
