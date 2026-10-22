# RYPL — AI social media manager · by AXIon

> *Every post, a ripple.*

RYPL learns your business, plans content around festivals and global moments, designs posts,
carousels and motion-graphic reels, writes shoot briefs for reels you film yourself, analyses
any reel's retention curve, and turns comments into CRM leads. Built to run **locally with
Claude Code** first and become a SaaS later.

```
Brand Brain ─► Planner (holidays, trends) ─► Studio (posts · carousels · reels · shoot briefs) ─► Publish
     ▲                                                                                              │
     └──────────── Learning loop ◄──── Reel Lab (retention curve) ◄──── Instagram insights ◄────────┘
```

## What's inside

| Folder | What |
|---|---|
| `web/` | The app — Dashboard, Studio, Calendar, Reel Lab, Flows (node builder), CRM, Brand Brain, Settings. React + Vite + Tailwind + React Flow. |
| `server/` | Zero-dependency Node server. Runs `claude -p` against this repo and talks to the Instagram API. |
| `engine/brand/` | **Brand Brain**: `brand.md`, `style.json`, `playbook.md` (self-updating rules). |
| `engine/data/` | `moments.json` (Indian + global holidays, Oct 2026 → Oct 2027), `performance.json` (your post metrics). |
| `engine/scripts/` | `render-post.mjs` (spec → PNG), `analyze-reel.sh` (video → frames, cuts, transcript). |
| `engine/remotion/` | `RippleReel` motion-graphics composition (9:16, 30 fps). |
| `engine/out/samples/` | Sample renders — including a post Claude Code generated end-to-end. |
| `.claude/commands/` | Slash commands: `/make-post`, `/make-reel`, `/shoot-brief`, `/analyze-reel`, `/plan-week`, `/weekly-report`. |
| `CLAUDE.md` | The rules Claude follows in this project. |

## Run it

Needs **Node 20.12+**, **Claude Code** (logged in), **ffmpeg** (for Reel Lab).

```bash
npm run setup          # installs everything + Playwright's Chromium
npm run dev            # app → http://localhost:5173   server → http://localhost:8787
```

The app works without the server too (it shows **Demo mode** in the sidebar). With the
server running, the sidebar shows **Claude Code** and Studio / Reel Lab call the real engine.

### Use it straight from the terminal

```bash
claude                                  # opens Claude Code in this folder
> /make-post missed leads at night
> /make-post Diwali greeting --occasion "Diwali"
> /make-post 5 signs you need a receptionist --carousel
> /make-reel 3am WhatsApp lead gets booked
> /shoot-brief clinic owner reacts to Recipto
> /analyze-reel ~/Downloads/my-reel.mp4
> /plan-week Recipto for clinics
> /weekly-report
```

Everything lands in `engine/out/<slug>/`.

Preview and tweak the reel template live: `npm run remotion:studio`.

## Connect Instagram

1. Switch your Instagram to a **Business** or **Creator** account.
2. Create an app at developers.facebook.com → add the **Instagram** product → *API setup with Instagram login*.
3. Add `http://localhost:8787/api/instagram/callback` as a redirect URI.
4. `cp server/.env.example server/.env` and fill `IG_APP_ID`, `IG_APP_SECRET`.
5. App → **Settings → Connect Instagram**.

For your own account, development mode is enough. To connect **client** accounts you'll need
Meta App Review + Business Verification.

**Publishing:** Instagram downloads media from a **public URL**, so upload renders to
Cloudinary / S3 / R2 (or a tunnel) before calling `/api/instagram/publish`.
**Trending audio** can't be added via the API — those reels are marked `publish: "manual"`.

## The learning loop

1. `GET /api/instagram/media` pulls your posts + insights into `engine/data/performance.json`.
2. `/weekly-report` compares winners vs losers and rewrites `engine/brand/playbook.md`.
3. Every new creative follows the playbook and cites the rule it used.

Instagram's API gives *average* watch time, not the second-by-second retention graph. For a
real curve, screenshot the graph in the Instagram app and drop it in the reel's analysis folder
as `retention.png` — `/analyze-reel` will read it.

## Going SaaS (later)

- Swap `runClaude()` in `server/index.mjs` for the **Claude Agent SDK** + `ANTHROPIC_API_KEY`.
- Move to Postgres + auth, one Brand Brain folder per client.
- Render reels on a queue (Remotion Lambda or a worker box). Check Remotion's licence terms for company use.
- Meta App Review for `instagram_business_*` permissions.

## Notes

- Dates marked `"verify": true` in `moments.json` follow the lunar calendar — confirm before scheduling.
- `analyze-reel.sh` can fetch URLs with `yt-dlp`; only download reels you own or have permission to use.
- Demo data (dashboard numbers, leads) lives in `web/src/data.ts` and is replaced as live data comes in.
