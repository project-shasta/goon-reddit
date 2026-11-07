# Reddit Downloader

A small Electron app that logs into Reddit with **your own session**, scans a subreddit's newest
posts, and downloads images, galleries, Reddit-hosted videos, and external videos in parallel. It
also includes a plain image slideshow of whatever it scanned.

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

## Run

```powershell
npm run dev      # development, hot reload
npm start        # preview the production build
npm run build    # compile out/ only
npm run build:win # typecheck + build + NSIS installer & zip archive
```

## Using the app

1. Press **Log in on Reddit** and finish the normal Reddit login (including 2FA if enabled). The
   window closes itself once the session is verified.
2. Type a subreddit name (for example `pics` or `r/pics`) and press **Check**.
3. Choose one of:
   - **Download new** — scans newest posts, then downloads matching media.
   - **Scan only** — loads posts into the slideshow without downloading anything.
4. Watch progress in **Activity** and the transfer list. Use **Cancel** to stop mid-run.

Files are saved flat per subreddit:

```
<destination>\<subreddit>\YYYY-MM-DD_<postId>_<title-slug>[_NN].<ext>
```

Galleries get `_01`, `_02`, … suffixes. Existing files are skipped by default, and name collisions
get ` (1)`, ` (2)`, … suffixes.

### Slideshow

The **Slideshow** tab plays every image the last scan found. Downloaded images play from disk via a
locked-down `rdm-media://` protocol; everything else streams from Reddit. Press `←`/`→` to move,
space to pause, and `F` for fullscreen. Speed and NSFW blur are in **Settings**.

### Settings

- Destination folder, number of newest posts to scan, parallel downloads
- Which media types to fetch (images, galleries, Reddit videos, external videos)
- Skip NSFW, skip already-downloaded files, blur NSFW in slideshow
- Slideshow interval and tool status/updates

Everything the app writes lives in a self-contained `data` folder next to the app:
`data/settings.json`, the Chromium profile, and the persisted `reddit` session. In development that is
the project root, in a normal install it is the folder that contains the executable, and portable
builds use `PORTABLE_EXECUTABLE_DIR`. Nothing is written to `%APPDATA%`.

On first launch after upgrading, the app copies an existing profile from the old
`%APPDATA%\Reddit Downloader` location (settings, `Local State`, and the Reddit partition) into the
new `data` folder, so you stay logged in. If the app folder is read-only, the app will refuse to
start — it must be placed in a writable location.

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
4. **Scan only** on a subreddit with images: slideshow fills while scanning, arrows/space work.
5. **Download new** with `maxPosts` set to 25 on a small subreddit:
   - images save to the destination subreddit folder
   - a gallery produces `_01`, `_02`, … files
   - a Reddit video produces a playable MP4 with audio (ffmpeg present)
   - a YouTube/RedGifs post produces an MP4 (yt-dlp present)
6. Cancel halfway: partial `.part*` files are removed, phase shows **Cancelled**.
7. Re-run with **Skip files already downloaded**: counts show skipped, no duplicates.
8. **Log out** clears the session; scanning then asks you to log in again.

## Troubleshooting

- **“Reddit blocked the request”** — open the login window, confirm Reddit loads and you are signed
  in, then retry. VPN/datacenter IPs are more likely to be blocked.
- **Verification / 2FA** — solve it in the login window; the app waits for the session cookie.
- **Reddit video has no audio** — ffmpeg was not found. Run `npm run tools:setup` or update it in
  Settings; the app falls back to video-only `fallback_url`.
- **External video fails** — update yt-dlp in **Settings → Tools**; some hosts change frequently.
- **Quarantined/private subreddit** — opt in on Reddit first; the app uses your account's access.
