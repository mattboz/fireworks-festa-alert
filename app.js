(function () {
  "use strict";

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const state = {
    localities: [],
    localityById: new Map(),
    festas: [],
    town: null,
    radiusKm: 3,
    upcomingOnly: true,
  };

  const townSelect = document.getElementById("town-select");
  const radiusSelect = document.getElementById("radius-select");
  const upcomingOnlyCheckbox = document.getElementById("upcoming-only");
  const countdownSection = document.getElementById("countdown-section");
  const festaListEl = document.getElementById("festa-list");
  const methodologyEl = document.getElementById("data-methodology");
  const flaggedListEl = document.getElementById("flagged-list");
  const shareLink = document.getElementById("share-link");

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function todayLocal() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function parseDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function daysBetween(a, b) {
    return Math.round((b - a) / 86400000);
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (state.town) params.set("town", state.town);
    params.set("radius", String(state.radiusKm));
    params.set("upcoming", state.upcomingOnly ? "1" : "0");
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }

  async function loadData() {
    const [localitiesRes, festasRes] = await Promise.all([
      fetch("data/localities.json"),
      fetch("data/festas.json"),
    ]);
    state.localities = await localitiesRes.json();
    state.localities.forEach((l) => state.localityById.set(l.id, l));
    const festasData = await festasRes.json();
    state.festas = festasData.festas;
    methodologyEl.textContent = festasData.methodology;
    flaggedListEl.innerHTML = "";
    (festasData.flaggedForReview || []).forEach((note) => {
      const li = document.createElement("li");
      li.textContent = note;
      flaggedListEl.appendChild(li);
    });
  }

  function populateTownSelect() {
    const malta = state.localities.filter((l) => l.region === "Malta").sort((a, b) => a.name.localeCompare(b.name));
    const gozo = state.localities.filter((l) => l.region === "Gozo").sort((a, b) => a.name.localeCompare(b.name));

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select your town...";
    townSelect.appendChild(placeholder);

    const maltaGroup = document.createElement("optgroup");
    maltaGroup.label = "Malta";
    malta.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.name;
      maltaGroup.appendChild(opt);
    });
    townSelect.appendChild(maltaGroup);

    const gozoGroup = document.createElement("optgroup");
    gozoGroup.label = "Gozo";
    gozo.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.name;
      gozoGroup.appendChild(opt);
    });
    townSelect.appendChild(gozoGroup);
  }

  function restoreFromUrlOrStorage() {
    const params = getParams();
    const urlTown = params.get("town");
    const urlRadius = params.get("radius");
    const urlUpcoming = params.get("upcoming");

    const storedTown = localStorage.getItem("festa-town");
    const storedRadius = localStorage.getItem("festa-radius");
    const storedUpcoming = localStorage.getItem("festa-upcoming");

    state.town = urlTown || storedTown || null;
    state.radiusKm = Number(urlRadius ?? storedRadius ?? 3);
    state.upcomingOnly = urlUpcoming !== null ? urlUpcoming === "1" : storedUpcoming !== "0";

    if (state.town && state.localityById.has(state.town)) {
      townSelect.value = state.town;
    }
    radiusSelect.value = String(state.radiusKm);
    upcomingOnlyCheckbox.checked = state.upcomingOnly;
  }

  function persist() {
    if (state.town) localStorage.setItem("festa-town", state.town);
    localStorage.setItem("festa-radius", String(state.radiusKm));
    localStorage.setItem("festa-upcoming", state.upcomingOnly ? "1" : "0");
    updateUrl();
  }

  function festaDistanceKm(festa) {
    if (!state.town) return null;
    const home = state.localityById.get(state.town);
    const loc = state.localityById.get(festa.localityId);
    if (!home || !loc) return null;
    if (home.id === loc.id) return 0;
    return haversineKm(home.lat, home.lon, loc.lat, loc.lon);
  }

  function isNear(festa) {
    const dist = festaDistanceKm(festa);
    if (dist === null) return false;
    return dist <= state.radiusKm;
  }

  function renderCountdown() {
    if (!state.town) {
      countdownSection.innerHTML = `<p class="countdown-loading">Pick your town above to see your next nearby festa.</p>`;
      return;
    }
    const today = todayLocal();
    const upcoming = state.festas
      .map((f) => ({ f, dist: festaDistanceKm(f), date: parseDate(f.date) }))
      .filter((x) => x.date >= today && x.dist !== null && x.dist <= state.radiusKm)
      .sort((a, b) => a.date - b.date);

    if (upcoming.length === 0) {
      countdownSection.innerHTML = `<p class="countdown-loading">No festas found within ${state.radiusKm} km of your town for the rest of the season. 🎉</p>`;
      return;
    }

    const next = upcoming[0];
    const loc = state.localityById.get(next.f.localityId);
    const days = daysBetween(today, next.date);
    const dayWord = days === 0 ? "TODAY" : days === 1 ? "TOMORROW" : `${days} days`;

    countdownSection.innerHTML = `
      <p class="countdown-days">${dayWord === "TODAY" || dayWord === "TOMORROW" ? dayWord : days}</p>
      <p class="countdown-label">${dayWord === "TODAY" || dayWord === "TOMORROW" ? "" : "days until next nearby festa"}</p>
      <p class="countdown-detail">
        <span class="place">${loc.name}</span> &mdash; ${next.f.title}
        <br/>${formatDate(next.date)}${next.dist === 0 ? " (your locality)" : ` &middot; ~${next.dist.toFixed(1)} km away`}
      </p>
    `;
  }

  function formatDate(d) {
    return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  function renderList() {
    const today = todayLocal();
    let items = state.festas.map((f) => ({
      f,
      date: parseDate(f.date),
      dist: festaDistanceKm(f),
    }));

    if (state.upcomingOnly) {
      items = items.filter((x) => x.date >= today);
    }

    items.sort((a, b) => a.date - b.date);

    festaListEl.innerHTML = "";

    if (items.length === 0) {
      festaListEl.innerHTML = `<p class="empty-state">No festas match your filters.</p>`;
      return;
    }

    let currentMonth = null;
    items.forEach(({ f, date, dist }) => {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthKey !== currentMonth) {
        currentMonth = monthKey;
        const heading = document.createElement("div");
        heading.className = "month-heading";
        heading.textContent = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
        festaListEl.appendChild(heading);
      }

      const loc = state.localityById.get(f.localityId);
      const near = state.town && dist !== null && dist <= state.radiusKm;
      const isPast = date < today;

      const card = document.createElement("article");
      card.className = "festa-card" + (near ? " near" : "") + (isPast ? " past" : "");

      const badges = [];
      if (near) badges.push(`<span class="badge badge-near">🔴 Near you</span>`);
      if (state.town && dist !== null && !near) {
        badges.push(`<span class="badge badge-distance">${dist.toFixed(0)} km away</span>`);
      }
      if (f.scale === "secondary") badges.push(`<span class="badge badge-secondary">Secondary feast</span>`);
      if (f.confidence !== "high") badges.push(`<span class="badge badge-unconfirmed">❓ ${f.confidence === "medium" ? "unconfirmed" : "low confidence"}</span>`);

      const days = daysBetween(today, date);
      const countdownText = isPast
        ? "past"
        : days === 0
        ? "today"
        : days === 1
        ? "tomorrow"
        : `in ${days}d`;

      card.innerHTML = `
        <div class="festa-date">
          <span class="day">${date.getDate()}</span>
          <span class="dow">${DOW[date.getDay()]}</span>
        </div>
        <div class="festa-body">
          <div class="festa-village">${loc ? loc.name : f.localityId} ${loc && loc.region === "Gozo" ? "🟢" : ""}</div>
          <div class="festa-title">${f.title}</div>
          <div class="festa-meta">${badges.join("")}</div>
          ${f.notes ? `<div class="festa-title" style="margin-top:4px;font-style:italic;">${f.notes}</div>` : ""}
        </div>
        <div class="festa-countdown"><strong>${countdownText}</strong></div>
      `;
      festaListEl.appendChild(card);
    });
  }

  function render() {
    renderCountdown();
    renderList();
  }

  function attachEvents() {
    townSelect.addEventListener("change", () => {
      state.town = townSelect.value || null;
      persist();
      render();
    });
    radiusSelect.addEventListener("change", () => {
      state.radiusKm = Number(radiusSelect.value);
      persist();
      render();
    });
    upcomingOnlyCheckbox.addEventListener("change", () => {
      state.upcomingOnly = upcomingOnlyCheckbox.checked;
      persist();
      render();
    });
    shareLink.addEventListener("click", async (e) => {
      e.preventDefault();
      updateUrl();
      try {
        await navigator.clipboard.writeText(window.location.href);
        shareLink.textContent = "Link copied!";
        setTimeout(() => (shareLink.textContent = "Copy share link"), 1800);
      } catch (err) {
        shareLink.textContent = window.location.href;
      }
    });
  }

  async function init() {
    await loadData();
    populateTownSelect();
    restoreFromUrlOrStorage();
    attachEvents();
    render();
  }

  init();
})();
