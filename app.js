/* Vikings Episode Codex
   Fetches show + episode data from TVMaze and renders a fast, themed UI.
   Notes:
   - We intentionally render summaries as plain text (not HTML) for safety.
*/

const SHOW_DEFS = [
  { key: "vikings", label: "Vikings", query: "vikings" },
  { key: "valhalla", label: "Vikings: Valhalla", query: "vikings valhalla" },
];

function tvmazeSingleSearchUrl(query) {
  return `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(query)}&embed=episodes`;
}

const els = {
  showName: document.getElementById("showName"),
  showSummary: document.getElementById("showSummary"),
  showMeta: document.getElementById("showMeta"),
  subtitle: document.getElementById("subtitle"),
  showPoster: document.getElementById("showPoster"),

  search: document.getElementById("search"),
  showSelect: document.getElementById("showSelect"),
  seasonSelect: document.getElementById("seasonSelect"),
  seasonList: document.getElementById("seasonList"),
  episodes: document.getElementById("episodes"),
  stats: document.getElementById("stats"),

  spoilerToggle: document.getElementById("spoilerToggle"),
  viewToggle: document.getElementById("viewToggle"),
  sortToggle: document.getElementById("sortToggle"),
  clearFilters: document.getElementById("clearFilters"),

  themeToggle: document.getElementById("themeToggle"),
  themeLabel: document.getElementById("themeLabel"),

  sectionTitle: document.getElementById("sectionTitle"),
  sectionSub: document.getElementById("sectionSub"),
  episodeTpl: document.getElementById("episodeCardTpl"),
};

/** @typedef {{ id:number, url:string, name:string, season:number, number:number, airdate:string, runtime:number, summary:string|null, image:string|null }} TvMazeEpisode */

const state = {
  loading: true,
  activeShowKey: "vikings",
  shows: /** @type {Record<string, any>} */ ({}),
  episodesByShow: /** @type {Record<string, TvMazeEpisode[]>} */ ({}),
  show: null,
  episodes: /** @type {TvMazeEpisode[]} */ ([]),
  season: "all",
  q: "",
  spoilerSafe: true,
  compact: false,
  sortDesc: false,
  theme: "night",
};

function renderShowSelect() {
  if (!els.showSelect) return;
  els.showSelect.innerHTML = "";

  for (const def of SHOW_DEFS) {
    const opt = document.createElement("option");
    opt.value = def.key;
    opt.textContent = def.label;
    els.showSelect.appendChild(opt);
  }

  els.showSelect.value = state.activeShowKey;
}

function setActiveShow(key) {
  if (!state.shows[key] || !state.episodesByShow[key]) return;

  state.activeShowKey = key;
  state.show = state.shows[key];
  state.episodes = state.episodesByShow[key];

  // Reset season filter when switching shows
  state.season = "all";
  if (els.seasonSelect) els.seasonSelect.value = "all";

  renderShowHeader();
  renderSeasonNav();
  renderEpisodes();

  const seasons = computeSeasons(state.episodes);
  els.subtitle.textContent = `${state.show?.name || ""} • ${seasons.length} seasons • ${state.episodes.length} episodes`;
}

function setTheme(next) {
  state.theme = next;
  document.documentElement.setAttribute("data-theme", next === "day" ? "day" : "");
  const isDay = next === "day";
  els.themeToggle.setAttribute("aria-pressed", String(isDay));
  els.themeLabel.textContent = isDay ? "Day" : "Night";
}

function safeTextFromHtml(html) {
  if (!html) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return (doc.body?.textContent || "").trim();
}

function formatEpisodeCode(season, number) {
  const s = String(season).padStart(2, "0");
  const e = String(number).padStart(2, "0");
  return `S${s}E${e}`;
}

function pill(text) {
  const el = document.createElement("span");
  el.className = "pill";
  el.textContent = text;
  return el;
}

function renderShowHeader() {
  if (!state.show) return;

  els.showName.textContent = state.show.name || "Vikings";
  els.showSummary.textContent = safeTextFromHtml(state.show.summary) || "Explore seasons and episodes.";

  const posterUrl = state.show?.image?.original || state.show?.image?.medium || "";
  if (els.showPoster) {
    if (posterUrl) {
      els.showPoster.src = posterUrl;
      els.showPoster.alt = `${state.show.name} poster`;
      els.showPoster.style.display = "block";
    } else {
      els.showPoster.removeAttribute("src");
      els.showPoster.alt = "";
      els.showPoster.style.display = "none";
    }
  }

  els.showMeta.innerHTML = "";
  if (state.show.premiered) els.showMeta.appendChild(pill(`Premiered: ${state.show.premiered}`));
  if (state.show.ended) els.showMeta.appendChild(pill(`Ended: ${state.show.ended}`));
  if (state.show.rating?.average) els.showMeta.appendChild(pill(`Rating: ${state.show.rating.average}`));
  if (Array.isArray(state.show.genres) && state.show.genres.length) {
    els.showMeta.appendChild(pill(state.show.genres.join(" • ")));
  }
}

function computeSeasons(episodes) {
  const seasons = new Map();
  for (const ep of episodes) {
    seasons.set(ep.season, (seasons.get(ep.season) || 0) + 1);
  }
  return [...seasons.entries()].sort((a, b) => a[0] - b[0]);
}

function renderSeasonNav() {
  const seasons = computeSeasons(state.episodes);

  // Select
  els.seasonSelect.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = `All seasons (${state.episodes.length})`;
  els.seasonSelect.appendChild(allOpt);
  for (const [s, count] of seasons) {
    const opt = document.createElement("option");
    opt.value = String(s);
    opt.textContent = `Season ${s} (${count})`;
    els.seasonSelect.appendChild(opt);
  }
  els.seasonSelect.value = state.season;

  // Sidebar buttons
  els.seasonList.innerHTML = "";
  const mkBtn = (label, value) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "season-btn";
    b.textContent = label;
    b.setAttribute("aria-current", String(value === state.season));
    b.addEventListener("click", () => {
      state.season = value;
      els.seasonSelect.value = value;
      render();
      els.search.focus();
    });
    return b;
  };

  els.seasonList.appendChild(mkBtn("All Seasons", "all"));
  for (const [s, count] of seasons) {
    els.seasonList.appendChild(mkBtn(`Season ${s} — ${count} eps`, String(s)));
  }
}

function getFilteredEpisodes() {
  const q = state.q.trim().toLowerCase();

  let list = state.episodes;
  if (state.season !== "all") {
    const seasonNum = Number(state.season);
    list = list.filter((e) => e.season === seasonNum);
  }

  if (q) {
    list = list.filter((e) => {
      const code = formatEpisodeCode(e.season, e.number).toLowerCase();
      const name = (e.name || "").toLowerCase();
      const summary = safeTextFromHtml(e.summary || "").toLowerCase();
      return code.includes(q) || name.includes(q) || summary.includes(q);
    });
  }

  list = [...list].sort((a, b) => {
    const aKey = a.season * 1000 + a.number;
    const bKey = b.season * 1000 + b.number;
    return state.sortDesc ? bKey - aKey : aKey - bKey;
  });

  return list;
}

function renderStats(filteredCount) {
  const seasons = computeSeasons(state.episodes);
  const seasonLabel = state.season === "all" ? "All" : `Season ${state.season}`;

  els.stats.innerHTML = "";
  els.stats.appendChild(document.createTextNode(`Seasons: ${seasons.length} • Total episodes: ${state.episodes.length}`));
  els.stats.appendChild(document.createElement("br"));
  els.stats.appendChild(document.createTextNode(`Viewing: ${seasonLabel} • Matching: ${filteredCount}`));
}

function renderSectionHeading(filteredCount) {
  const seasonLabel = state.season === "all" ? "All Seasons" : `Season ${state.season}`;
  els.sectionTitle.textContent = `Episodes — ${seasonLabel}`;

  const q = state.q.trim();
  els.sectionSub.textContent = q
    ? `${filteredCount} match${filteredCount === 1 ? "" : "es"} for “${q}”.`
    : `${filteredCount} episode${filteredCount === 1 ? "" : "s"}.`;
}

function makeEpisodeCard(ep) {
  const node = els.episodeTpl.content.firstElementChild.cloneNode(true);

  const imgEl = node.querySelector("[data-img]");
  const badgeEl = node.querySelector("[data-badge]");
  const titleEl = node.querySelector("[data-title]");
  const metaEl = node.querySelector("[data-meta]");
  const toggleBtn = node.querySelector("[data-toggle]");
  const body = node.querySelector("[data-body]");
  const summaryEl = node.querySelector("[data-summary]");
  const linkEl = node.querySelector("[data-link]");

  const code = formatEpisodeCode(ep.season, ep.number);
  badgeEl.textContent = code;
  titleEl.textContent = ep.name || "Untitled";

  const parts = [];
  if (ep.airdate) parts.push(`Air: ${ep.airdate}`);
  if (ep.runtime) parts.push(`${ep.runtime} min`);
  metaEl.textContent = parts.join(" • ") || "—";

  const summaryText = safeTextFromHtml(ep.summary || "") || "No summary available.";
  summaryEl.textContent = summaryText;

  if (imgEl) {
    if (ep.image) {
      imgEl.src = ep.image;
      imgEl.alt = `${code} ${ep.name || "Episode"} image`;
      imgEl.style.display = "block";
    } else {
      imgEl.removeAttribute("src");
      imgEl.alt = "";
      imgEl.style.display = "none";
    }
  }

  linkEl.href = ep.url || "https://www.tvmaze.com/";

  const open = () => {
    body.hidden = false;
    toggleBtn.textContent = "Close";
    toggleBtn.setAttribute("aria-expanded", "true");
  };
  const close = () => {
    body.hidden = true;
    toggleBtn.textContent = "Open";
    toggleBtn.setAttribute("aria-expanded", "false");
  };
  const toggle = () => (body.hidden ? open() : close());

  if (state.spoilerSafe) {
    close();
  } else {
    open();
  }

  toggleBtn.addEventListener("click", toggle);
  node.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });

  return node;
}

function renderEpisodes() {
  const filtered = getFilteredEpisodes();
  els.episodes.innerHTML = "";

  els.episodes.classList.toggle("compact", state.compact);

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "panel";
    empty.textContent = "No episodes match your filters.";
    els.episodes.appendChild(empty);
    renderStats(0);
    renderSectionHeading(0);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const ep of filtered) frag.appendChild(makeEpisodeCard(ep));
  els.episodes.appendChild(frag);

  renderStats(filtered.length);
  renderSectionHeading(filtered.length);
}

function setLoading(loading, message) {
  state.loading = loading;
  if (loading) {
    els.showName.textContent = "Loading…";
    els.showSummary.textContent = message || "Fetching episode list.";
  }
}

async function load() {
  setLoading(true, "Fetching episode list from TVMaze…");

  try {
    const results = await Promise.all(
      SHOW_DEFS.map(async (def) => {
        const url = tvmazeSingleSearchUrl(def.query);
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`TVMaze request failed for ${def.label}: ${res.status}`);
        const data = await res.json();
        /** @type {TvMazeEpisode[]} */
        const episodes = (data?._embedded?.episodes || []).map((e) => ({
          id: e.id,
          url: e.url,
          name: e.name,
          season: e.season,
          number: e.number,
          airdate: e.airdate,
          runtime: e.runtime,
          summary: e.summary,
          image: e.image?.original || e.image?.medium || null,
        }));
        return { def, data, episodes };
      })
    );

    for (const r of results) {
      state.shows[r.def.key] = r.data;
      state.episodesByShow[r.def.key] = r.episodes;
    }

    renderShowSelect();
    setActiveShow(state.activeShowKey);

    setLoading(false);
  } catch (err) {
    setLoading(false);
    els.showName.textContent = "Couldn’t load episodes";
    els.showSummary.textContent =
      "This usually happens if your browser blocks requests when opened as a file. Open with a local server (VS Code Live Server is easiest).";
    els.showMeta.innerHTML = "";

    const hint = document.createElement("div");
    hint.className = "panel";
    hint.innerHTML = "<b>Fix:</b> Open this folder with a local server, then reload.";
    els.episodes.innerHTML = "";
    els.episodes.appendChild(hint);

    console.error(err);
  }
}

function wireEvents() {
  els.search.addEventListener("input", (e) => {
    state.q = e.target.value;
    renderEpisodes();
  });

  if (els.showSelect) {
    els.showSelect.addEventListener("change", (e) => {
      const next = e.target.value;
      setActiveShow(next);
    });
  }

  els.seasonSelect.addEventListener("change", (e) => {
    state.season = e.target.value;
    renderSeasonNav();
    renderEpisodes();
  });

  els.spoilerToggle.addEventListener("click", () => {
    state.spoilerSafe = !state.spoilerSafe;
    els.spoilerToggle.setAttribute("aria-pressed", String(state.spoilerSafe));
    els.spoilerToggle.textContent = `Spoiler-safe: ${state.spoilerSafe ? "On" : "Off"}`;
    renderEpisodes();
  });

  els.viewToggle.addEventListener("click", () => {
    state.compact = !state.compact;
    els.viewToggle.setAttribute("aria-pressed", String(state.compact));
    els.viewToggle.textContent = `View: ${state.compact ? "Compact" : "Cards"}`;
    renderEpisodes();
  });

  els.sortToggle.addEventListener("click", () => {
    state.sortDesc = !state.sortDesc;
    els.sortToggle.setAttribute("aria-pressed", String(state.sortDesc));
    els.sortToggle.textContent = `Sort: ${state.sortDesc ? "Desc" : "Asc"}`;
    renderEpisodes();
  });

  els.clearFilters.addEventListener("click", () => {
    state.q = "";
    state.season = "all";
    state.sortDesc = false;
    els.search.value = "";
    els.seasonSelect.value = "all";
    els.sortToggle.setAttribute("aria-pressed", "false");
    els.sortToggle.textContent = "Sort: Asc";
    renderSeasonNav();
    renderEpisodes();
  });

  // Theme: default night
  setTheme("night");
  els.themeToggle.addEventListener("click", () => {
    setTheme(state.theme === "day" ? "night" : "day");
  });
}

function render() {
  renderSeasonNav();
  renderEpisodes();
}

wireEvents();
load();
