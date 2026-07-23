# Waggle

A personal tool for generating topics to speak or journal about, with prep
and speaking timers — solo or in a group that takes turns.

Fully offline. No accounts, no network calls, no analytics. All topics are
hardcoded in [`web/topics.js`](web/topics.js).

The project ships in two forms that share the exact same app code:

- **`/web`** — a plain HTML/CSS/JS website. Zero setup: open `index.html` in
  a browser and it works.
- **`/desktop`** — a thin Electron wrapper around `/web` that packages into a
  Windows `.exe`. It adds a native window and swaps `localStorage` for a
  settings file on disk — nothing about how the app looks or behaves changes.

---

## 1. Run the web version (no install required)

Open [`web/index.html`](web/index.html) directly in any modern browser
(double-click it, or right-click → Open With → your browser). That's it —
the whole app runs client-side with no build step and no server.

Settings (timer durations, enabled categories) are saved to the browser's
`localStorage`, so they'll still be there next time you open it in the same
browser.

---

## 2. Run the desktop version in dev mode

The desktop build needs [Node.js](https://nodejs.org/) (which includes npm).

1. **Install Node.js** — download the LTS installer from
   [nodejs.org](https://nodejs.org/) and run it. Verify it worked:

   ```bash
   node --version
   npm --version
   ```

2. **Install dependencies** — from the `desktop` folder:

   ```bash
   cd desktop
   npm install
   ```

   This downloads Electron and electron-builder (one-time, needs internet).
   The app itself never calls the network at runtime.

3. **Run it in dev mode:**

   ```bash
   npm start
   ```

   This opens a native Waggle window loading the same files from `/web`. Any
   edit you make to `/web/*.js`, `*.css`, or `*.html` shows up the next time
   you restart `npm start` (or reload the window with Ctrl+R).

In the desktop build, settings are stored as a JSON file instead of
`localStorage` — see `app.getPath('userData')` in
[`desktop/main.js`](desktop/main.js) for the exact location (e.g.
`%APPDATA%/Waggle/waggle-settings.json` on Windows).

---

## 3. Build the Windows `.exe`

From the `desktop` folder (after `npm install` has been run at least once):

```bash
cd desktop
npm run dist
```

electron-builder will produce a Windows installer (NSIS `.exe`) in
`desktop/dist/`. Hand that installer to anyone with Windows — no Node.js or
internet connection required on their end, the app is fully self-contained
and offline.

---

## Project structure

```
/web                    Standalone website — the single source of truth for all app logic
  index.html             Markup for all four screens (Home, Solo, Group, Settings)
  styles.css              Black & yellow theme, layout, animation
  topics.js                Hardcoded topic library (7 categories, 25+ topics each)
  storage.js                Settings persistence — localStorage on web, file store on desktop
  timer.js                   Wall-clock countdown timer (prep + speak phases)
  audio.js                    Web Audio API chime alerts (no audio files needed)
  waggle-app.js                 Screen navigation, state, and all event wiring

/desktop                Electron shell — adds a window and file-based settings only
  main.js                 Creates the BrowserWindow, loads /web/index.html, handles settings I/O
  preload.js                Exposes a small settings API to the renderer via contextBridge
  package.json               electron-builder config (targets a Windows NSIS installer)
```

`/desktop` never duplicates app logic — `main.js` loads `../web/index.html`
directly in dev, and the build config copies `/web` next to the packaged
`.exe` (`extraResources`), so both builds run the identical `web/` files.

## Adding topics or categories

Edit [`web/topics.js`](web/topics.js) — it's a plain object of
`"Category Name": ["topic", "topic", ...]`. Add a topic by adding a string to
an existing array, or add a whole new category by adding a new key. Nothing
else needs to change; Settings, Solo, and Group all read from this object
automatically.
