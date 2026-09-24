# Discord GIF Bot (`/gif`)

A 100% free, open-source Discord bot with exactly one command:

```
/gif media: <image or video>
```

It downloads the attachment, converts it to an optimized GIF with FFmpeg +
gifsicle (both free/open-source), automatically shrinks it if needed to fit
Discord's upload limit, sends it back, and deletes all temp files.

**Stack:** Node.js, TypeScript, discord.js v14, FFmpeg, gifsicle, Docker.
**Cost:** $0 — no paid APIs, database, storage, or VPS required.

---

## 1. How it works

```
Discord → /gif → free cloud server (Render) → FFmpeg + gifsicle → GIF → Discord
```

1. User runs `/gif` and attaches a file.
2. Bot replies `🎬 Converting...` immediately (Discord requires a reply
   within 3 seconds).
3. File is streamed to a temp directory (size-capped as it downloads).
4. Extension decides image vs. video handling.
5. FFmpeg does a two-pass palette-optimized GIF conversion (this is the
   standard high-quality FFmpeg GIF technique — much better than a naive
   single-pass conversion).
6. `gifsicle -O3` further compresses the result.
7. If the GIF is still over the size limit, the bot automatically retries
   with a lower fps/resolution/more aggressive compression (5 quality
   tiers, from 480px/15fps down to 200px/6fps).
8. The final GIF replaces the "Converting..." message with `✅ Done!` and
   the file attached.
9. The temp directory (input file + every intermediate GIF) is deleted,
   success or failure.
10. On any failure, the bot edits the reply to
    `❌ I couldn't convert that file. Please try another image or video.`

All conversions run through a small in-process queue
(`MAX_CONCURRENT_JOBS`, default 2) so a burst of requests can't overload
the free instance's limited CPU.

---

## 2. Supported files

| Images | Videos |
|---|---|
| PNG | MP4 |
| JPG / JPEG | MOV |
| WEBP | WEBM |
| | AVI |
| | MKV |

Videos are trimmed to `MAX_VIDEO_SECONDS` (default 10s) to keep conversions
fast on free-tier CPU.

---

## 3. Discord Developer Portal setup

1. Go to <https://discord.com/developers/applications> → **New Application**.
   Give it a name (this becomes the bot's display name).
2. In the left sidebar, open **Bot**.
   - Click **Reset Token** → copy the token. This is your `DISCORD_TOKEN`.
     **Never share this or commit it to git.**
   - Leave **Privileged Gateway Intents** all **off** — this bot never
     reads message content, so it doesn't need them.
3. In the left sidebar, open **General Information** → copy the
   **Application ID**. This is your `DISCORD_CLIENT_ID`.
4. That's it — no OAuth scopes or extra config needed yet.

---

## 4. Invite the bot to your server

1. In the Developer Portal, open **OAuth2 → URL Generator**.
2. Under **Scopes**, check:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, check:
   - `Send Messages`
   - `Attach Files`
   - `Use Slash Commands` (implied by `applications.commands`)
   - `Read Message History` (optional, lets it reply cleanly in threads)
4. Copy the generated URL at the bottom, open it in a browser, pick your
   server, and authorize it.

Or build the URL manually (replace `YOUR_CLIENT_ID`):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=51200&scope=bot%20applications.commands
```

---

## 5. Local development

Requirements: Node.js 18.17+, `ffmpeg` and `gifsicle` installed locally
(e.g. `sudo apt install ffmpeg gifsicle` on Debian/Ubuntu, `brew install
ffmpeg gifsicle` on macOS).

```bash
git clone <your-repo-url>
cd discord-gif-bot
npm install
cp .env.example .env
# edit .env: paste DISCORD_TOKEN, DISCORD_CLIENT_ID, and (for instant
# command registration while developing) DISCORD_GUILD_ID of your test server

npm run deploy-commands   # registers /gif
npm run dev                # starts the bot with auto-reload
```

Invite the bot (step 4 above), then try `/gif` in your test server.

---

## 6. Free hosting: Render

**Why Render:** it has a genuine free web-service tier (no credit card),
supports Docker, and runs a real background Node.js process — everything
this bot needs. Verified against Render's own docs as of writing.

### 6a. One-time account setup

1. Create a free account at <https://render.com> (GitHub sign-in is
   easiest — no credit card required for the free tier).
2. Push this project to a GitHub repository (public or private, either
   works).

### 6b. Deploy

**Option A — Blueprint (fastest):** this repo includes `render.yaml`.
1. In the Render dashboard: **New → Blueprint**.
2. Select your repo. Render reads `render.yaml` and creates the service
   automatically, already set to the **Free** plan and Docker runtime.
3. When prompted, fill in the secret env vars: `DISCORD_TOKEN`,
   `DISCORD_CLIENT_ID`, and optionally `DISCORD_GUILD_ID`.
4. Click **Apply**.

**Option B — Manual:**
1. **New → Web Service** → connect your repo.
2. **Runtime:** Docker (Render auto-detects the `Dockerfile`).
3. **Instance Type:** Free.
4. Add environment variables (**Environment** tab):
   - `DISCORD_TOKEN` = your bot token
   - `DISCORD_CLIENT_ID` = your application ID
   - `DISCORD_GUILD_ID` = (optional, for instant guild-scoped commands)
   - `MAX_UPLOAD_MB`, `MAX_GIF_MB`, `MAX_VIDEO_SECONDS`,
     `MAX_CONCURRENT_JOBS` — optional, defaults are sensible.
5. Click **Create Web Service**. Render builds the Docker image and
   deploys it — first build takes a few minutes.

### 6c. Register the slash command in production

Commands are registered by *running a script*, not by deploying — do this
once (and again any time you change the command definition):

- **Fastest for testing:** set `DISCORD_GUILD_ID` in Render's env vars,
  then open the **Shell** tab on your Render service and run:
  ```bash
  node dist/deploy-commands.js
  ```
  Guild commands appear instantly in that one server.
- **For every server the bot is in:** leave `DISCORD_GUILD_ID` empty and
  run the same command. Global commands can take **up to ~1 hour** to
  show up everywhere.

### 6d. Keep it running 24/7 without your PC — for free

Render's free web services **spin down after ~15 minutes with no inbound
HTTP requests**, and take 30-60 seconds to "cold start" back up. A sleeping
service means the bot's Discord connection drops.

The bot already runs a tiny built-in HTTP server (`src/keepalive.ts`) for
exactly this reason. To stop Render from ever seeing 15 idle minutes, add
a **free external pinger** that hits your Render URL every 5-10 minutes:

1. After deploying, copy your service's public URL from the Render
   dashboard (looks like `https://discord-gif-bot-xxxx.onrender.com`).
2. Create a free account at either:
   - <https://cron-job.org> (no credit card), or
   - <https://uptimerobot.com> (no credit card, free plan checks every 5 min)
3. Add a new monitor/cron job that sends a `GET` request to your Render
   URL every 5-10 minutes.

That's it — as long as the pinger keeps running (it's free and hosted by
that service, not your PC), Render never sees 15 idle minutes, so it never
sleeps, and your bot stays connected to Discord continuously. Your
computer does not need to be on.

---

## 7. Updating / restarting the bot

- **Deploy an update:** push to the branch Render is watching (usually
  `main`). Render auto-builds and redeploys on every push.
- **Manual redeploy:** Render dashboard → your service → **Manual Deploy
  → Deploy latest commit**.
- **Restart without changing code:** Render dashboard → your service →
  **Manual Deploy → Restart Service** (top-right menu).
- **Re-register commands after changing `src/commands/gif.ts`:** re-run
  `node dist/deploy-commands.js` from the Shell tab (see 6c).
- **Rotate a leaked token:** Developer Portal → Bot → **Reset Token**,
  then update `DISCORD_TOKEN` in Render's Environment tab and restart.

---

## 8. Limitations of Render's free tier (read this)

- **Sleeps after 15 min of no HTTP traffic**, unless kept warm by the free
  external pinger from step 6d. If the pinger ever stops, the bot goes
  offline until the next inbound request wakes it (30-60s cold start).
- **750 free instance-hours/month.** A single service pinged/running
  continuously uses ~720-744 hours/month, which fits — but don't run a
  second free service on the same account at the same time or you may
  exceed the shared monthly pool.
- **Shared, limited CPU/RAM** (free tier is intentionally modest). Long or
  high-resolution videos will convert slower than on a paid tier — this is
  why `MAX_VIDEO_SECONDS`, resolution caps, and `MAX_CONCURRENT_JOBS`
  exist. Raise them only if you upgrade.
- **No persistent disk on the free tier.** Not a problem here — this bot
  never needs to keep files between requests; everything is written to
  the container's ephemeral temp storage and deleted immediately after
  each conversion.
- **100 GB/month outbound bandwidth.** Plenty for GIFs, which are capped
  at `MAX_GIF_MB` (10MB by default) each.
- **Cold starts:** if the service does sleep and wake, the *first*
  Discord interaction after waking may hit the 3-second interaction
  timeout before the bot's process is fully up. This is rare with the
  pinger running, but if the bot ever misses a reply, just re-run the
  command.

If you outgrow these limits, the code is a portable Docker image — the
same `Dockerfile` deploys as-is to Fly.io, Koyeb, Railway, or any other
Docker-capable host if you later choose to pay for more resources.

---

## 9. Reliability features already built in

- Global `unhandledRejection` / `uncaughtException` handlers keep one bad
  file from crashing the whole bot; Render also auto-restarts the
  container if it ever does crash.
- Attachment size is checked *before* downloading, and the download itself
  aborts early if the remote file exceeds `MAX_UPLOAD_MB` (never buffers
  an oversized file fully into memory/disk).
- Conversion automatically retries at lower quality if the first attempt
  produces a GIF larger than `MAX_GIF_MB`.
- Every temp file (input + every intermediate GIF/palette) is deleted in a
  `finally` block, whether the conversion succeeds or fails.
- `MAX_CONCURRENT_JOBS` queues extra requests instead of spawning
  unlimited parallel FFmpeg processes.
- The bot token is only ever read from the environment (`.env` locally,
  Render's encrypted env vars in production) and is never logged.

---

## 10. Project structure

```
discord-gif-bot/
├── src/
│   ├── index.ts            # bot entrypoint, event wiring, crash safety
│   ├── config.ts           # env var loading + defaults
│   ├── convert.ts          # FFmpeg + gifsicle conversion pipeline
│   ├── deploy-commands.ts  # registers the /gif slash command
│   ├── keepalive.ts        # tiny HTTP server for Render + uptime pinger
│   ├── commands/
│   │   └── gif.ts          # /gif command handler
│   └── utils/
│       ├── download.ts     # streamed, size-capped attachment download
│       ├── exec.ts         # child_process wrapper for CLI tools
│       ├── files.ts        # temp dir creation/cleanup helpers
│       └── jobQueue.ts     # concurrency limiter
├── Dockerfile               # Node 20 + ffmpeg + gifsicle
├── render.yaml               # Render Blueprint (free plan)
├── package.json
├── tsconfig.json
├── .env.example
└── .dockerignore / .gitignore
```

---

## 11. License

Use, modify, and redistribute freely for your own server(s).
