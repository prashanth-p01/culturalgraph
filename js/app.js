/* CultureGraph — plain JavaScript single-page app (hash routing, no framework) */
(function () {
  "use strict";

  // ---------- Constants & state ----------
  const ITEMS = window.CG_ITEMS;
  const DISTRICTS = window.CG_DISTRICTS;
  const MESSAGES = window.CG_MESSAGES;
  const FAV_KEY = "culturegraph_favorites"; // same key as the original app
  const LOCALE_KEY = "cg_locale";
  const THEME_KEY = "cg_theme";

  const CATEGORY_ICONS = {
    dance: "💃", music: "🎵", place: "🛕", festival: "🎆", food: "🍛", craft: "🎨",
    literature: "📜", "martial-art": "🥋", attire: "👘", history: "🏛️", tradition: "🪔"
  };

  const state = {
    locale: localStorage.getItem(LOCALE_KEY) || "en",
    theme: localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    favorites: loadFavorites(),
    map: null
  };

  // ---------- Helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Localized string: pick current locale, fall back to English.
  const loc = (obj) => (obj && (obj[state.locale] || obj.en)) || "";
  const t = (key) => {
    const get = (dict) => key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict);
    const v = get(MESSAGES[state.locale]);
    if (v !== undefined) return v;
    const fb = get(MESSAGES.en);
    return fb !== undefined ? fb : key;
  };
  const catLabel = (cat) => t("Explore.categories." + cat);
  const itemUrl = (it) => `#/explore/${it.category}/${it.slug}`;
  const districtById = (id) => DISTRICTS.find((d) => d.id === id);
  const itemById = (id) => ITEMS.find((i) => i.id === id);
  const itemsInDistrict = (id) => ITEMS.filter((i) => i.districtIds.includes(id));
  const img = (it, cls = "") => {
    const src = (it.images && it.images[0] && it.images[0].url) || `images/placeholders/${it.category === "place" ? "place" : it.category}.svg`;
    const alt = it.images && it.images[0] ? loc(it.images[0].alt) : loc(it.name);
    return `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.onerror=null;this.src='images/placeholders/place.svg'" />`;
  };
  const badge = (v) => {
    const cls = v === "verified" ? "tag-verified" : v === "partial" ? "tag-partial" : "tag-unverified";
    return `<span class="tag ${cls}">${esc(t("Detail." + (v || "unverified")))}</span>`;
  };
  const distKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  function loadFavorites() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
  }
  function saveFavorites() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites)); } catch { /* storage unavailable */ }
  }
  const isFav = (id) => state.favorites.includes(id);
  function toggleFav(id) {
    state.favorites = isFav(id) ? state.favorites.filter((x) => x !== id) : [...state.favorites, id];
    saveFavorites();
    return isFav(id);
  }
  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ---------- Global UI (language, theme, nav) ----------
  function applyLocale() {
    document.documentElement.lang = state.locale;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $("#langToggle").textContent = state.locale === "en" ? "தமிழ்" : "English";
    document.title = state.locale === "ta" ? "CultureGraph — தமிழ்நாடு பண்பாட்டு வழிகாட்டி" : t("Metadata.title");
  }
  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    $("#themeToggle").textContent = state.theme === "dark" ? "☀️" : "🌙";
  }
  $("#langToggle").addEventListener("click", () => {
    state.locale = state.locale === "en" ? "ta" : "en";
    localStorage.setItem(LOCALE_KEY, state.locale);
    applyLocale();
    render();
  });
  $("#themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, state.theme);
    applyTheme();
  });
  $("#navToggle").addEventListener("click", () => {
    const nav = $("#mainNav");
    nav.classList.toggle("open");
    $("#navToggle").setAttribute("aria-expanded", nav.classList.contains("open"));
  });
  $("#year").textContent = new Date().getFullYear();

  function updateActiveNav(route) {
    document.querySelectorAll(".main-nav a").forEach((a) => {
      const target = a.getAttribute("href").slice(1);
      a.classList.toggle("active", route[0] === target.split("/")[1] || (route[0] === "explore" && target === "/explore"));
    });
    $("#mainNav").classList.remove("open");
  }

  // ---------- Router ----------
  function parseRoute() {
    const path = location.hash.replace(/^#/, "") || "/";
    return path.split("/").filter(Boolean).map(decodeURIComponent);
  }
  function render() {
    const route = parseRoute();
    const [page, a, b] = route.length ? route : ["home"];
    updateActiveNav([page]);
    const app = $("#main");
    let html;
    switch (page) {
      case "explore":
        html = a ? (b ? viewItem(a, b) : viewCategory(a)) : viewExplore();
        break;
      case "districts":
        html = a ? viewDistrict(a) : viewDistricts();
        break;
      case "map": html = viewMapShell(); break;
      case "favorites": html = viewFavorites(); break;
      case "dashboard": html = viewDashboard(); break;
      case "about": html = viewAbout(); break;
      case "credits": html = viewCredits(); break;
      case "home": case undefined: html = viewHome(); break;
      default: html = viewNotFound();
    }
    app.innerHTML = html;
    app.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    if (page === "map") initMap();
    bindPage(page, a, b);
  }
  window.addEventListener("hashchange", render);

  // ---------- Pages ----------
  function card(it) {
    return `<a class="card" href="${itemUrl(it)}">
      ${img(it)}
      <div class="card-body">
        <span class="muted">${CATEGORY_ICONS[it.category] || ""} ${esc(catLabel(it.category))}</span>
        <h3 class="card-title">${esc(loc(it.name))}</h3>
        <p>${esc(loc(it.summary))}</p>
      </div></a>`;
  }
  function homeFeaturesHtml() {
    const feats = [["dance", "🎭"], ["music", "🎶"], ["places", "🛕"], ["festivals", "🎆"], ["food", "🍛"], ["crafts", "🎨"], ["map", "🗺️"], ["search", "🔍"], ["offline", "📱"], ["bilingual", "🌐"]];
    return feats.map(([k, ic]) => `<div class="panel"><h3>${ic} ${esc(t("Home.features." + k + ".title"))}</h3><p class="muted">${esc(t("Home.features." + k + ".desc"))}</p></div>`).join("");
  }
  function viewHome() {
    const featured = ITEMS.filter((i) => i.verification === "verified").slice(0, 3);
    const cultureOfDay = ITEMS[new Date().getDate() % ITEMS.length];
    return `
      <section class="hero">
        <h1>${esc(t("Home.title"))} <span class="accent">${esc(t("Home.titleTamil"))}</span></h1>
        <p>${esc(t("Home.tagline"))}</p>
        <div class="actions"><a class="btn btn-light" href="#/explore">${esc(t("Home.ctaExplore"))}</a><a class="btn btn-outline" style="color:#fff;border-color:#fff" href="#/map">🗺️ ${esc(t("Nav.map"))}</a></div>
      </section>
      <section class="section">
        <div class="section-head"><h2>${esc(t("Explore.title"))}</h2></div>
        <div class="grid">${Object.keys(CATEGORY_ICONS).map((c) => `
          <a class="tile" href="#/explore/${c}">${CATEGORY_ICONS[c]} ${esc(catLabel(c))}
            <span class="count">${ITEMS.filter((i) => i.category === c).length} ${state.locale === "ta" ? "உள்ளீடுகள்" : "entries"}</span></a>`).join("")}
        </div>
      </section>
      <section class="section">
        <div class="section-head"><h2>${esc(t("Home.featuresTitle"))}</h2></div>
        <p class="muted">${esc(t("Home.featuresSubtitle"))}</p>
        <div class="grid">${homeFeaturesHtml()}</div>
      </section>
      <section class="section">
        <div class="section-head"><h2>✨ ${state.locale === "ta" ? "இன்றைய பண்பாடு" : "Culture of the Day"}</h2><a href="${itemUrl(cultureOfDay)}">${esc(t("Home.ctaExplore"))} →</a></div>
        <div class="grid">${card(cultureOfDay)}${featured.map(card).join("")}</div>
      </section>`;
  }

  function viewExplore() {
    const cats = Object.keys(CATEGORY_ICONS);
    return `
      <h1>${esc(t("Explore.title"))}</h1>
      <div class="toolbar">
        <input class="input" id="globalSearch" type="search" placeholder="${esc(t("Explore.searchPlaceholder"))}" aria-label="${esc(t("Explore.search"))}" />
      </div>
      <div id="searchResults"></div>
      <div class="grid" id="categoryTiles">${cats.map((c) => `
        <a class="tile" href="#/explore/${c}">${CATEGORY_ICONS[c]} ${esc(catLabel(c))}
          <span class="count">${ITEMS.filter((i) => i.category === c).length}</span></a>`).join("")}
      </div>`;
  }

  function matches(it, q) {
    if (!q) return true;
    const hay = [it.name.en, it.name.ta, it.summary.en, it.summary.ta, ...(it.tags || [])].join(" ").toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function viewCategory(cat) {
    if (!CATEGORY_ICONS[cat]) return viewNotFound();
    const list = ITEMS.filter((i) => i.category === cat);
    const districtOpts = DISTRICTS.filter((d) => list.some((i) => i.districtIds.includes(d.id)));
    return `
      <div class="crumbs"><a href="#/explore">${esc(t("Explore.title"))}</a> / ${esc(catLabel(cat))}</div>
      <h1>${CATEGORY_ICONS[cat]} ${esc(catLabel(cat))}</h1>
      <div class="toolbar">
        <input class="input" id="catSearch" type="search" placeholder="${esc(t("Explore.search"))}" aria-label="${esc(t("Explore.search"))}" />
        <select class="input" id="catDistrict" aria-label="${esc(t("Detail.district"))}" style="max-width:240px">
          <option value="">${esc(t("Detail.district"))}: ${state.locale === "ta" ? "அனைத்தும்" : "All"}</option>
          ${districtOpts.map((d) => `<option value="${esc(d.id)}">${esc(loc(d.name))}</option>`).join("")}
        </select>
      </div>
      <p class="muted" id="catCount"></p>
      <div class="grid" id="catGrid" data-cat="${esc(cat)}"></div>`;
  }

  function viewItem(cat, slug) {
    const it = ITEMS.find((i) => i.category === cat && i.slug === slug);
    if (!it) return viewNotFound();
    const fav = isFav(it.id);
    const row = (label, val) => val ? `<dt>${esc(label)}</dt><dd>${val}</dd>` : "";
    const list = (arr) => arr && arr.length ? `<ul>${arr.map((x) => `<li>${esc(loc(x))}</li>`).join("")}</ul>` : "";
    const districts = it.districtIds.map((id) => districtById(id)).filter(Boolean)
      .map((d) => `<a class="tag" href="#/districts/${d.slug}">${esc(loc(d.name))}</a>`).join("");
    const related = (it.relatedIds || []).map(itemById).filter(Boolean)
      .concat((it.relatedPlaceIds || []).map(itemById).filter(Boolean));
    const uniqueRelated = [...new Map(related.map((r) => [r.id, r])).values()];
    const sources = (it.sources || []).map((s) => s.url ? `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>` : `<li>${esc(s.label)}</li>`).join("");
    const media = (it.mediaLinks || []).map((m) => `<li><a href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.title)}</a></li>`).join("");
    const hasInfo = it.religion || it.deity || it.openingHours || it.origin || it.instruments || it.performers || it.monthSeason || it.era;
    return `
      <div class="crumbs"><a href="#/">${state.locale === "ta" ? "முகப்பு" : "Home"}</a> / <a href="#/explore/${esc(cat)}">${esc(catLabel(cat))}</a> / ${esc(loc(it.name))}</div>
      <h1>${CATEGORY_ICONS[cat] || ""} ${esc(loc(it.name))}</h1>
      <p class="lead">${esc(loc(it.summary))}</p>
      <div class="actions">
        ${badge(it.verification)}
        ${it.era ? `<span class="tag">${esc(it.era)}</span>` : ""}
        ${(it.tags || []).slice(0, 6).map((tg) => `<span class="tag">${esc(tg)}</span>`).join("")}
      </div>
      ${img(it, "detail-hero")}
      <div class="actions">
        <button class="btn ${fav ? "saved" : ""}" data-action="fav" data-id="${esc(it.id)}">${fav ? "★ " + esc(t("Detail.unfavorite")) : "☆ " + esc(t("Detail.favorite"))}</button>
        <button class="btn btn-outline" data-action="share" data-title="${esc(loc(it.name))}">${esc(t("Detail.share"))}</button>
      </div>
      <div class="detail-grid">
        <div>
          <div class="panel"><p style="margin:0;white-space:pre-line">${esc(loc(it.description))}</p></div>
          ${it.specialFeatures ? `<div class="panel"><h3>✦</h3>${list(it.specialFeatures)}</div>` : ""}
          ${it.rituals ? `<div class="panel"><h3>${state.locale === "ta" ? "சடங்குகள்" : "Rituals"}</h3>${list(it.rituals)}</div>` : ""}
          ${it.instruments ? `<div class="panel"><h3>${state.locale === "ta" ? "இசைக்கருவிகள்" : "Instruments"}</h3>${list(it.instruments)}</div>` : ""}
          ${uniqueRelated.length ? `<div class="panel"><h3>${esc(t("Detail.relatedItems"))}</h3><div class="grid">${uniqueRelated.slice(0, 4).map(card).join("")}</div></div>` : ""}
        </div>
        <aside>
          <div class="panel"><h3>${esc(t("Detail.district"))}</h3><div>${districts || '<span class="muted">—</span>'}</div>
            ${it.location ? `<p class="muted" style="margin-top:10px">${it.location.address ? esc(it.location.address) : ""}</p><a href="#/map">🗺️ ${esc(t("Nav.map"))}</a>` : ""}
          </div>
          ${hasInfo ? `<div class="panel"><dl>
            ${row(state.locale === "ta" ? "சமயம்" : "Religion", esc(it.religion))}
            ${row(state.locale === "ta" ? "தெய்வம்" : "Deity", esc(it.deity))}
            ${row(state.locale === "ta" ? "நேரம்" : "Opening hours", esc(it.openingHours))}
            ${row(state.locale === "ta" ? "தோற்றம்" : "Origin", it.origin ? esc(loc(it.origin)) : "")}
            ${row(state.locale === "ta" ? "காலம்" : "Season", it.monthSeason ? esc(loc(it.monthSeason)) : "")}
            ${row(state.locale === "ta" ? "கலைஞர்கள்" : "Performers", it.performers ? esc(it.performers.join(", ")) : "")}
            ${row(t("Detail.lastVerified"), esc(it.lastVerified || ""))}
          </dl></div>` : ""}
          ${sources ? `<div class="panel"><h3>${esc(t("Detail.sources"))}</h3><ul>${sources}</ul></div>` : ""}
          ${media ? `<div class="panel"><h3>Media</h3><ul>${media}</ul></div>` : ""}
          ${!it.description ? `<p class="muted">${esc(t("Detail.notAvailable"))}</p>` : ""}
        </aside>
      </div>`;
  }

  function viewDistricts() {
    const regions = ["North", "South", "Central", "West"];
    return `
      <h1>${esc(t("Nav.districts"))}</h1>
      <p class="muted">${state.locale === "ta" ? "38 மாவட்டங்கள்" : "All 38 districts of Tamil Nadu"}</p>
      <div class="toolbar"><input class="input" id="distSearch" type="search" placeholder="${esc(t("Explore.search"))}" aria-label="${esc(t("Explore.search"))}" /></div>
      ${regions.map((r) => {
        const ds = DISTRICTS.filter((d) => d.region === r);
        return ds.length ? `<h2 class="region-title">${r}</h2><div class="grid" data-region-grid>${ds.map((d) => `
          <a class="card" data-dist-name="${esc(loc(d.name).toLowerCase())}" href="#/districts/${d.slug}">
            ${img({ images: d.images, name: d.name, category: "place" })}
            <div class="card-body"><h3 class="card-title">${esc(loc(d.name))}</h3>
            <p>${esc(loc(d.summary))}</p>
            <span class="muted">${itemsInDistrict(d.id).length} ${state.locale === "ta" ? "உள்ளீடுகள்" : "entries"}</span></div>
          </a>`).join("")}</div>` : "";
      }).join("")}`;
  }

  function viewDistrict(slug) {
    const d = DISTRICTS.find((x) => x.slug === slug);
    if (!d) return viewNotFound();
    const its = itemsInDistrict(d.id);
    return `
      <div class="crumbs"><a href="#/districts">${esc(t("Nav.districts"))}</a> / ${esc(loc(d.name))}</div>
      <h1>${esc(loc(d.name))}</h1>
      <p class="muted">${esc(t("Detail.district"))}: ${esc(loc(d.headquarters))} · ${esc(d.region)} · ${d.coordinates.lat.toFixed(3)}, ${d.coordinates.lng.toFixed(3)}</p>
      <p class="lead">${esc(loc(d.summary))}</p>
      <div class="panel"><p style="margin:0">${esc(loc(d.description))}</p></div>
      ${d.knownFor && d.knownFor.length ? `<div class="panel"><h3>${state.locale === "ta" ? "புகழ்பெற்றவை" : "Known for"}</h3><ul>${d.knownFor.map((k) => `<li>${esc(loc(k))}</li>`).join("")}</ul></div>` : ""}
      <div class="actions"><a class="btn" href="#/map">🗺️ ${esc(t("Nav.map"))}</a></div>
      <h2 class="region-title">${esc(t("Explore.title"))}</h2>
      <div class="grid">${its.length ? its.map(card).join("") : `<p class="empty">${esc(t("Explore.noResults"))}</p>`}</div>`;
  }

  function viewMapShell() {
    const cats = Object.keys(CATEGORY_ICONS);
    return `
      <h1>${esc(t("Nav.map"))}</h1>
      <div class="toolbar">
        <select class="input" id="mapCat" aria-label="${esc(t("Explore.filters"))}">
          <option value="all">${state.locale === "ta" ? "அனைத்து வகைகள்" : "All categories"}</option>
          ${cats.map((c) => `<option value="${c}">${esc(catLabel(c))}</option>`).join("")}
        </select>
        <select class="input" id="mapDistrict" aria-label="${esc(t("Detail.district"))}">
          <option value="all">${state.locale === "ta" ? "அனைத்து மாவட்டங்கள்" : "All districts"}</option>
          ${DISTRICTS.map((d) => `<option value="${esc(d.id)}">${esc(loc(d.name))}</option>`).join("")}
        </select>
        <button class="btn btn-gold" id="nearMe">📍 ${state.locale === "ta" ? "அருகில்" : "Near Me"}</button>
      </div>
      <p class="muted" id="mapCount"></p>
      <div id="map" role="region" aria-label="Map"></div>
      <p class="muted" id="mapNote"></p>`;
  }

  function viewFavorites() {
    const favs = state.favorites.map(itemById).filter(Boolean);
    return `
      <h1>★ ${esc(t("Nav.favorites"))}</h1>
      ${favs.length ? `<div class="grid">${favs.map(card).join("")}</div>`
        : `<div class="empty"><p>${state.locale === "ta" ? "இன்னும் எதுவும் சேமிக்கப்படவில்லை." : "Nothing saved yet. Tap “Save” on any entry to add it here."}</p>
           <a class="btn" href="#/explore">${esc(t("Home.ctaExplore"))}</a></div>`}`;
  }

  function viewDashboard() {
    const favs = state.favorites.map(itemById).filter(Boolean);
    const verified = ITEMS.filter((i) => i.verification === "verified").length;
    const recent = ITEMS.slice(0, 4);
    return `
      <h1>${esc(t("Nav.dashboard"))}</h1>
      <div class="stats" style="margin-bottom:24px">
        <div class="stat"><strong>${ITEMS.length}</strong>${state.locale === "ta" ? "பண்பாட்டு உள்ளீடுகள்" : "Cultural entries"}</div>
        <div class="stat"><strong>${DISTRICTS.length}</strong>${state.locale === "ta" ? "மாவட்டங்கள்" : "Districts"}</div>
        <div class="stat"><strong>${Object.keys(CATEGORY_ICONS).length}</strong>${state.locale === "ta" ? "வகைகள்" : "Categories"}</div>
        <div class="stat"><strong>${verified}</strong>${state.locale === "ta" ? "சரிபார்க்கப்பட்டவை" : "Verified"}</div>
        <div class="stat"><strong>${favs.length}</strong>${esc(t("Nav.favorites"))}</div>
      </div>
      <div class="section-head"><h2>${esc(t("Nav.favorites"))}</h2><a href="#/favorites">${state.locale === "ta" ? "அனைத்தும்" : "View all"} →</a></div>
      <div class="grid">${favs.length ? favs.slice(0, 4).map(card).join("") : `<p class="muted">${state.locale === "ta" ? "இன்னும் இல்லை." : "No favourites yet."}</p>`}</div>
      <div class="section-head" style="margin-top:28px"><h2>${state.locale === "ta" ? "சமீபத்தியவை" : "Browse"}</h2></div>
      <div class="grid">${recent.map(card).join("")}</div>`;
  }

  function viewAbout() {
    return `
      <h1>${state.locale === "ta" ? "பற்றி" : "About CultureGraph"}</h1>
      <p class="lead">${esc(t("Metadata.description"))}</p>
      <div class="panel"><h3>${state.locale === "ta" ? "நோக்கம்" : "Purpose"}</h3>
        <p>${state.locale === "ta"
          ? "தமிழ்நாட்டின் கலை, இசை, நடனம், கோயில்கள், உணவு மற்றும் மரபுகளை அனைவரும் அறிய இந்த வழிகாட்டி உருவாக்கப்பட்டுள்ளது."
          : "CultureGraph is a bilingual (English & Tamil) guide to the living heritage of Tamil Nadu across all 38 districts — dance, music, temples, festivals, food, crafts, literature, martial arts, attire, history and traditions."}</p></div>
      <div class="panel"><h3>${state.locale === "ta" ? "தரவுகள்" : "Data"}</h3><p class="muted">${esc(t("Footer.dataNote"))}</p></div>`;
  }

  function viewCredits() {
    return `
      <h1>${esc(t("Home.creditsTitle"))}</h1>
      <div class="panel"><p>${esc(t("Home.creditsTeam"))}</p><p>${esc(t("Home.creditsData"))}</p><p>${esc(t("Home.creditsTech"))}</p></div>`;
  }

  function viewNotFound() {
    return `<div class="notfound"><h1>${esc(t("NotFound.title"))}</h1><p class="muted">${esc(t("NotFound.message"))}</p>
      <a class="btn" href="#/">${esc(t("NotFound.goHome"))}</a></div>`;
  }

  // ---------- Page behaviours (filters, map, actions) ----------
  function bindPage(page, a, b) {
    // Global search on Explore home
    const gs = $("#globalSearch");
    if (gs) {
      gs.addEventListener("input", () => {
        const q = gs.value.trim();
        const tiles = $("#categoryTiles"), res = $("#searchResults");
        if (!q) { res.innerHTML = ""; tiles.style.display = ""; return; }
        const found = ITEMS.filter((i) => matches(i, q));
        tiles.style.display = "none";
        res.innerHTML = `<p class="muted">${found.length} ${state.locale === "ta" ? "முடிவுகள்" : "results"}</p>
          <div class="grid">${found.length ? found.map(card).join("") : `<p class="empty">${esc(t("Explore.noResults"))}</p>`}</div>`;
      });
    }

    // Category page filters
    const catGrid = $("#catGrid");
    if (catGrid) {
      const cat = catGrid.dataset.cat;
      const update = () => {
        const q = $("#catSearch").value.trim();
        const d = $("#catDistrict").value;
        const list = ITEMS.filter((i) => i.category === cat && matches(i, q) && (!d || i.districtIds.includes(d)));
        $("#catCount").textContent = `${list.length} ${state.locale === "ta" ? "உள்ளீடுகள்" : "entries"}`;
        catGrid.innerHTML = list.length ? list.map(card).join("") : `<p class="empty">${esc(t("Explore.noResults"))}</p>`;
      };
      $("#catSearch").addEventListener("input", update);
      $("#catDistrict").addEventListener("change", update);
      update();
    }

    // District directory search
    const ds = $("#distSearch");
    if (ds) {
      ds.addEventListener("input", () => {
        const q = ds.value.trim().toLowerCase();
        document.querySelectorAll("[data-dist-name]").forEach((el) => {
          el.style.display = !q || el.dataset.distName.includes(q) ? "" : "none";
        });
      });
    }

    // Detail page actions (event delegation)
    const main = $("#main");
    main.onclick = (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      if (btn.dataset.action === "fav") {
        const on = toggleFav(btn.dataset.id);
        toast(on ? (state.locale === "ta" ? "சேமிக்கப்பட்டது" : "Saved to favourites") : (state.locale === "ta" ? "நீக்கப்பட்டது" : "Removed from favourites"));
        render();
      } else if (btn.dataset.action === "share") {
        const url = location.href;
        if (navigator.share) navigator.share({ title: btn.dataset.title, url }).catch(() => {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast("Link copied"));
        else toast(url);
      }
    };
  }

  // ---------- Map (Leaflet, loaded from CDN) ----------
  function initMap() {
    const el = $("#map");
    if (!el) return;
    if (typeof window.L === "undefined") {
      el.outerHTML = `<div class="map-fallback">The map needs an internet connection to load its tiles and Leaflet library. Please reconnect and reload.</div>`;
      return;
    }
    if (state.map) { state.map.remove(); state.map = null; }
    const map = L.map(el).setView([11.1, 78.66], 7);
    state.map = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18, attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    const userLayer = L.layerGroup().addTo(map);

    const draw = () => {
      layer.clearLayers();
      const cat = $("#mapCat").value, dst = $("#mapDistrict").value;
      const pts = ITEMS.filter((i) => i.location && (cat === "all" || i.category === cat) && (dst === "all" || i.districtIds.includes(dst)));
      pts.forEach((it) => {
        L.circleMarker([it.location.lat, it.location.lng], { radius: 7, color: "#8F1D2C", fillColor: "#D98200", fillOpacity: .9, weight: 2 })
          .bindPopup(`<strong>${esc(loc(it.name))}</strong><br>${esc(catLabel(it.category))}<br><a href="${itemUrl(it)}">${state.locale === "ta" ? "விவரங்கள்" : "View details"} →</a>`)
          .addTo(layer);
      });
      $("#mapCount").textContent = `${pts.length} ${state.locale === "ta" ? "இடங்கள்" : "locations"}`;
      if (pts.length) map.fitBounds(L.latLngBounds(pts.map((p) => [p.location.lat, p.location.lng])), { padding: [30, 30], maxZoom: 10 });
    };
    $("#mapCat").addEventListener("change", draw);
    $("#mapDistrict").addEventListener("change", draw);
    draw();

    $("#nearMe").addEventListener("click", () => {
      if (!navigator.geolocation) return toast("Geolocation not supported");
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        userLayer.clearLayers();
        L.circleMarker([lat, lng], { radius: 9, color: "#fff", fillColor: "#1E63D6", fillOpacity: 1, weight: 3 }).bindPopup("You are here").addTo(userLayer);
        map.setView([lat, lng], 10);
        const near = ITEMS.filter((i) => i.location)
          .map((i) => ({ i, d: distKm(lat, lng, i.location.lat, i.location.lng) }))
          .sort((x, y) => x.d - y.d).slice(0, 1);
        if (near.length) $("#mapNote").textContent = `${state.locale === "ta" ? "அருகிலுள்ளது" : "Nearest"}: ${loc(near[0].i.name)} (${near[0].d.toFixed(1)} km)`;
      }, () => toast(state.locale === "ta" ? "இருப்பிடம் கிடைக்கவில்லை" : "Location permission denied"));
    });
    setTimeout(() => map.invalidateSize(), 150);
  }

  // ---------- Boot ----------
  applyTheme();
  applyLocale();
  render();

  // Register the offline cache only when served over http(s) (service workers don't run from file://).
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
