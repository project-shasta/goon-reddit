# GoOn Reddit

A small Electron app that logs into Reddit with **your own session**, scans a subreddit's newest
posts, and fetches images, galleries, Reddit-hosted videos, and external videos in parallel.

Reddit blocks anonymous `.json` access, so the app opens a real Reddit login window and reuses that
session for every request. Cookies never leave the main process.

## Requirements

- Windows 10/11 (x64)
- Node.js 26 via [mise](https://mise.jdx.dev/) — `mise install`
- npm

## Setup

```powershell
mise install
npm install
npm run tools:setup
```

`tools:setup` puts the two external helpers into `./tools` so the app folder stays portable:

| Tool   | Purpose                                              |
| ------ | ---------------------------------------------------- |
| ffmpeg | Merges Reddit's separate DASH/HLS audio + video      |
| yt-dlp | Downloads YouTube, RedGifs, Imgur, Streamable, etc.  |

yt-dlp is SHA-256 verified on download. You can update it later from **Settings → Tools**.

## Build commands

```powershell
npm run build           # compile out/ only
npm run build:win       # typecheck + build + zip archive
.\build.bat             # double-click: stop processes, clean, build, pause for review
```

### Icon generation (PNG → ICO)

The app icon is generated from a 256×256 PNG using Python/Pillow (installed via mise):

```powershell
mise exec -- python -c "
from PIL import Image
img = Image.open('node_modules/app-builder-lib/templates/icons/electron-linux/256x256.png')
img = img.resize((256, 256), Image.LANCZOS).convert('RGBA')
img.save('build/icon.ico', format='ICO', sizes=[(256, 256)])
"
```

To use your own icon, replace the source path with your PNG and re-run the command.

## Run

```powershell
npm run dev      # development, hot reload
npm start        # preview the production build
```

## Using the app

### Layout

The app has two tabs in the header: **Downloader** and **Settings**.

**Downloader tab** (top to bottom):

1. **Auth panel** — login/logout/recheck buttons. Shows your Reddit username when connected.
2. **Subreddit bar** — enter a subreddit name (e.g. `pics`), press **Check**, then **Download new**.
3. **Progress** — shows posts scanned, media found, downloaded/skipped counts, and a transfer list.
4. **Activity log** — toggleable, closed by default. Shows timestamped entries (info, warn, error, success).

**Settings tab**:

- Destination folder, number of newest posts to scan (default 100), parallel downloads (1–8)
- Media types: images, galleries, Reddit videos, external videos (toggle each)
- Behavior: skip NSFW, skip already-downloaded files
- Tools: ffmpeg and yt-dlp status, update yt-dlp

### Workflow

1. Press **Log in on Reddit** and finish the normal Reddit login (including 2FA if enabled). The
   window closes itself once the session is verified.
2. Type a subreddit name (for example `pics` or `r/pics`) and press **Check**.
3. Press **Download new** — scans newest posts, then downloads matching media.
4. Watch progress in the transfer list and the transfer list. Use **Cancel** to stop mid-run.

Files are saved flat per subreddit:

```
<destination>\<subreddit>\YYYY-MM-DD_<postId>_<title-slug>[_NN].<ext>
```

Galleries get `_01`, `_02`, … suffixes. Existing files are skipped by default, and name collisions
get ` (1)`, ` (2)`, … suffixes.

### Retry and thumbnail handling

Downloads retry up to 3 times per URL (source URL + preview URL fallback). A small orange badge
shows the retry count (e.g. `×3`). Failed entries show an alert icon with a hover tooltip containing
the error reason.

If a downloaded image is still a thumbnail (detected by file size: JPEG < 12 KB, PNG/WebP < 8 KB),
it is skipped and the app fetches the next unscanned posts from the subreddit, adding their media
to the queue. This replaces low-res images with higher-quality ones from later in the scan range.

## How it works

- Main process authenticates through a persisted Chromium partition (`persist:reddit`).
- Requests go through `session.fetch` first. If Reddit answers with its HTML block page, the same
  URL is retried inside a hidden `reddit.com` page so headers, origin, cookies, and TLS fingerprint
  look like a real browser.
- Scans paginate `/r/<name>.json?sort=new` with rate limiting and retries. If Reddit's edge blocks
  that path it falls back to `api.reddit.com/r/<name>/new`, then the legacy `/r/<name>/new.json`.
- Video strategy per post: try DASH with ffmpeg → HLS with ffmpeg → direct `fallback_url`. External
  hosts go through yt-dlp.
- The renderer only sees a typed IPC bridge; Node and cookies stay in the main process.

## Tests

```powershell
npm test          # extraction + filename + listing unit tests
npm run typecheck # main, preload, and renderer
```

## Manual smoke test

1. `npm run tools:setup` reports both tools with versions.
2. **Log in on Reddit** completes and the header shows `u/<name>`.
3. Check a known subreddit (e.g. `pics`) — member count and title appear.
4. **Download new** with `maxPosts` set to 25 on a small subreddit:
   - images save to the destination subreddit folder
   - a gallery produces `_01`, `_02`, … files
   - a Reddit video produces a playable MP4 with audio (ffmpeg present)
   - a YouTube/RedGifs post produces an MP4 (yt-dlp present)
5. Cancel halfway: partial `.part*` files are removed, phase shows **Cancelled**.
6. Re-run with **Skip files already downloaded**: counts show skipped, no duplicates.
7. **Log out** clears the session; scanning then asks you to log in again.

## Troubleshooting

- **"Reddit blocked the request"** — open the login window, confirm Reddit loads and you are signed
  in, then retry. VPN/datacenter IPs are more likely to be blocked.
- **Verification / 2FA** — solve it in the login window; the app waits for the session cookie.
- **Reddit video has no audio** — ffmpeg was not found. Run `npm run tools:setup` or update it in
  Settings; the app falls back to video-only `fallback_url`.
- **External video fails** — update yt-dlp in **Settings → Tools**; some hosts change frequently.
- **Quarantined/private subreddit** — opt in on Reddit first; the app uses your account's access.
