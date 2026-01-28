# Vikings Episode Codex

A lightweight mini-app that shows **every season** and **every episode** of **Vikings** *and* **Vikings: Valhalla**, including descriptions (summaries), in a clean Viking-themed UI.

## How it works
- Episode data is fetched live from TVMaze:
  - `https://api.tvmaze.com/singlesearch/shows?q=vikings&embed=episodes`
  - `https://api.tvmaze.com/singlesearch/shows?q=vikings%20valhalla&embed=episodes`
- Summaries are rendered as **plain text** for safety.

Use the **Show** dropdown to switch between series.

## Run it
Because browsers sometimes block API requests when opening HTML directly from disk, run it with a local server.

### Option A (easiest): VS Code Live Server
1. Install the extension **Live Server**.
2. Right-click `index.html` → **Open with Live Server**.

### Option B: Any local server
Use any local server you like and open the URL it gives you.

## Files
- `index.html` – layout
- `styles.css` – Viking-themed styling
- `app.js` – fetch + render logic

## Want it fully offline?
Tell me and I’ll generate original, non-copied one-line descriptions for each episode and bundle everything into a local JSON file (no API calls).
