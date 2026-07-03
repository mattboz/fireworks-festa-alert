(function () {
  "use strict";

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const state = {
    localities: [],
    localityById: new Map(),
    festas: [],
    towns: [],
    radiusKm: 3,
    upcomingOnly: true,
  };

  const townAddSelect = document.getElementById("town-add-select");
  const townsChipsEl = document.getElementById("towns-chips");
  const radiusSelect = document.getElementById("radius-select");
  const upcomingOnlyCheckbox = document.getElementById("upcoming-only");
  const countdownSection = document.getElementById("countdown-section");
  const nearFestasEl = document.getElementById("near-festas");
  const calendarExportBtn = document.getElementById("calendar-export");
  const festaListEl = document.getElementById("festa-list");
  const fullListCountEl = document.getElementById("full-list-count");
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
    if (state.towns.length) params.set("towns", state.towns.join(","));
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

  function populateTownAddSelect() {
    const available = state.localities.filter((l) => !state.towns.includes(l.id));
    const malta = available.filter((l) => l.region === "Malta").sort((a, b) => a.name.localeCompare(b.name));
    const gozo = available.filter((l) => l.region === "Gozo").sort((a, b) => a.name.localeCompare(b.name));

    townAddSelect.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = state.towns.length ? "+ Add another town..." : "Select your town...";
    townAddSelect.appendChild(placeholder);

    const maltaGroup = document.createElement("optgroup");
    maltaGroup.label = "Malta";
    malta.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.name;
      maltaGroup.appendChild(opt);
    });
    if (malta.length) townAddSelect.appendChild(maltaGroup);

    const gozoGroup = document.createElement("optgroup");
    gozoGroup.label = "Gozo";
    gozo.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = l.name;
      gozoGroup.appendChild(opt);
    });
    if (gozo.length) townAddSelect.appendChild(gozoGroup);
  }

  function renderTownsChips() {
    townsChipsEl.innerHTML = "";
    state.towns.forEach((townId) => {
      const loc = state.localityById.get(townId);
      if (!loc) return;
      const chip = document.createElement("span");
      chip.className = "town-chip";
      chip.innerHTML = `${loc.name} <button type="button" aria-label="Remove ${loc.name}">&times;</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        state.towns = state.towns.filter((t) => t !== townId);
        persist();
        populateTownAddSelect();
        renderTownsChips();
        render();
      });
      townsChipsEl.appendChild(chip);
    });
  }

  function restoreFromUrlOrStorage() {
    const params = getParams();
    const urlTowns = params.get("towns");
    const legacyTown = params.get("town");
    const urlRadius = params.get("radius");
    const urlUpcoming = params.get("upcoming");

    let storedTowns = null;
    try {
      storedTowns = JSON.parse(localStorage.getItem("festa-towns") || "null");
    } catch (e) {
      storedTowns = null;
    }
    const legacyStoredTown = localStorage.getItem("festa-town");
    const storedRadius = localStorage.getItem("festa-radius");
    const storedUpcoming = localStorage.getItem("festa-upcoming");

    const rawTowns = urlTowns
      ? urlTowns.split(",")
      : legacyTown
      ? [legacyTown]
      : Array.isArray(storedTowns)
      ? storedTowns
      : legacyStoredTown
      ? [legacyStoredTown]
      : [];

    state.towns = rawTowns.filter((id) => state.localityById.has(id));
    state.radiusKm = Number(urlRadius ?? storedRadius ?? 3);
    state.upcomingOnly = urlUpcoming !== null ? urlUpcoming === "1" : storedUpcoming !== "0";

    radiusSelect.value = String(state.radiusKm);
    upcomingOnlyCheckbox.checked = state.upcomingOnly;
  }

  function persist() {
    localStorage.setItem("festa-towns", JSON.stringify(state.towns));
    localStorage.removeItem("festa-town");
    localStorage.setItem("festa-radius", String(state.radiusKm));
    localStorage.setItem("festa-upcoming", state.upcomingOnly ? "1" : "0");
    updateUrl();
  }

  // Returns { dist, townId } for the closest of the user's tracked towns, or null.
  function festaClosestTown(festa) {
    const loc = state.localityById.get(festa.localityId);
    if (!loc || !state.towns.length) return null;
    let best = null;
    state.towns.forEach((townId) => {
      const home = state.localityById.get(townId);
      if (!home) return;
      const dist = home.id === loc.id ? 0 : haversineKm(home.lat, home.lon, loc.lat, loc.lon);
      if (!best || dist < best.dist) best = { dist, townId };
    });
    return best;
  }

  function formatDate(d) {
    return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  function loudnessTier(distKm, scale) {
    const bands =
      scale === "major"
        ? [
            [1, "🔊🔊🔊", "Expect a big bang"],
            [3, "🔊🔊", "Likely to rattle windows"],
            [5, "🔊", "Clearly audible"],
            [8, "🔉", "Faint, distant rumble possible"],
          ]
        : [
            [1, "🔊🔊", "Likely to rattle windows"],
            [3, "🔊", "Clearly audible"],
            [5, "🔉", "Faint, distant rumble possible"],
            [8, "🔉", "Probably faint"],
          ];
    for (const [maxDist, icon, label] of bands) {
      if (distKm <= maxDist) return { icon, label };
    }
    return { icon: "🔈", label: "Probably not noticeable" };
  }

  function urgencyBucket(days) {
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days <= 7) return "week";
    if (days <= 31) return "month";
    return "later";
  }

  const BUCKET_ORDER = ["today", "tomorrow", "week", "month", "later"];
  const BUCKET_LABELS = {
    today: "Today",
    tomorrow: "Tomorrow",
    week: "This week",
    month: "This month",
    later: "Later this season",
  };

  function getNearUpcomingFestas() {
    const today = todayLocal();
    return state.festas
      .map((f) => {
        const closest = festaClosestTown(f);
        return { f, date: parseDate(f.date), closest };
      })
      .filter((x) => x.closest !== null && x.closest.dist <= state.radiusKm && x.date >= today)
      .sort((a, b) => a.date - b.date);
  }

  function renderCountdown() {
    if (!state.towns.length) {
      countdownSection.innerHTML = `<p class="countdown-loading">Add a town above to see your next nearby festa.</p>`;
      return;
    }
    const upcoming = getNearUpcomingFestas();

    if (upcoming.length === 0) {
      countdownSection.innerHTML = `<p class="countdown-loading">No festas found within ${state.radiusKm} km of your towns for the rest of the season. 🎉</p>`;
      return;
    }

    const today = todayLocal();
    const next = upcoming[0];
    const loc = state.localityById.get(next.f.localityId);
    const closestTownLoc = state.localityById.get(next.closest.townId);
    const days = daysBetween(today, next.date);
    const dayWord = days === 0 ? "TODAY" : days === 1 ? "TOMORROW" : `${days} days`;
    const nearNote =
      state.towns.length > 1 ? ` &middot; closest to ${closestTownLoc.name}` : "";

    countdownSection.innerHTML = `
      <p class="countdown-days">${dayWord === "TODAY" || dayWord === "TOMORROW" ? dayWord : days}</p>
      <p class="countdown-label">${dayWord === "TODAY" || dayWord === "TOMORROW" ? "" : "days until next nearby festa"}</p>
      <p class="countdown-detail">
        <span class="place">${loc.name}</span> &mdash; ${next.f.title}
        <br/>${formatDate(next.date)}${next.closest.dist === 0 ? " (your locality)" : ` &middot; ~${next.closest.dist.toFixed(1)} km away`}${nearNote}
      </p>
    `;
  }

  function festaCardHtml({ f, date, dist, showLoudness }) {
    const loc = state.localityById.get(f.localityId);
    const today = todayLocal();
    const isPast = date < today;
    const near = dist !== null && dist <= state.radiusKm;

    const badges = [];
    if (near) badges.push(`<span class="badge badge-near">🔴 Near you</span>`);
    if (dist !== null && !near) {
      badges.push(`<span class="badge badge-distance">${dist.toFixed(0)} km away</span>`);
    }
    if (f.scale === "secondary") badges.push(`<span class="badge badge-secondary">Secondary feast</span>`);
    if (f.confidence !== "high") badges.push(`<span class="badge badge-unconfirmed">❓ ${f.confidence === "medium" ? "unconfirmed" : "low confidence"}</span>`);

    const days = daysBetween(today, date);
    const countdownText = isPast ? "past" : days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days}d`;

    let loudnessHtml = "";
    if (showLoudness && near) {
      const tier = loudnessTier(dist, f.scale);
      loudnessHtml = `<div class="festa-loudness">${tier.icon} ${tier.label}</div>`;
    }

    return `
      <article class="festa-card${near ? " near" : ""}${isPast ? " past" : ""}">
        <div class="festa-date">
          <span class="day">${date.getDate()}</span>
          <span class="dow">${DOW[date.getDay()]}</span>
        </div>
        <div class="festa-body">
          <div class="festa-village">${loc ? loc.name : f.localityId} ${loc && loc.region === "Gozo" ? "🟢" : ""}</div>
          <div class="festa-title">${f.title}</div>
          ${loudnessHtml}
          <div class="festa-meta">${badges.join("")}</div>
          ${f.notes ? `<div class="festa-title" style="margin-top:4px;font-style:italic;">${f.notes}</div>` : ""}
        </div>
        <div class="festa-countdown"><strong>${countdownText}</strong></div>
      </article>
    `;
  }

  function renderNearFestas() {
    if (!state.towns.length) {
      nearFestasEl.innerHTML = `<p class="empty-state">Add a town above to see the festas that matter to you.</p>`;
      calendarExportBtn.hidden = true;
      return;
    }

    const upcoming = getNearUpcomingFestas();

    if (upcoming.length === 0) {
      nearFestasEl.innerHTML = `<p class="empty-state">No festas found within ${state.radiusKm} km of your towns for the rest of the season. 🎉</p>`;
      calendarExportBtn.hidden = true;
      return;
    }

    const today = todayLocal();
    const buckets = {};
    upcoming.forEach((item) => {
      const days = daysBetween(today, item.date);
      const key = urgencyBucket(days);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(item);
    });

    let html = "";
    BUCKET_ORDER.forEach((key) => {
      if (!buckets[key]) return;
      html += `<div class="month-heading">${BUCKET_LABELS[key]}</div>`;
      buckets[key].forEach((item) => {
        html += festaCardHtml({ f: item.f, date: item.date, dist: item.closest.dist, showLoudness: true });
      });
    });
    nearFestasEl.innerHTML = html;
    calendarExportBtn.hidden = false;
    calendarExportBtn.dataset.count = String(upcoming.length);
  }

  function renderList() {
    const today = todayLocal();
    let items = state.festas.map((f) => {
      const closest = festaClosestTown(f);
      return { f, date: parseDate(f.date), dist: closest ? closest.dist : null };
    });

    if (state.upcomingOnly) {
      items = items.filter((x) => x.date >= today);
    }

    items.sort((a, b) => a.date - b.date);
    fullListCountEl.textContent = `(${items.length})`;

    festaListEl.innerHTML = "";

    if (items.length === 0) {
      festaListEl.innerHTML = `<p class="empty-state">No festas match your filters.</p>`;
      return;
    }

    let currentMonth = null;
    let html = "";
    items.forEach(({ f, date, dist }) => {
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (monthKey !== currentMonth) {
        currentMonth = monthKey;
        html += `<div class="month-heading">${MONTHS[date.getMonth()]} ${date.getFullYear()}</div>`;
      }
      html += festaCardHtml({ f, date, dist, showLoudness: false });
    });
    festaListEl.innerHTML = html;
  }

  function render() {
    renderCountdown();
    renderNearFestas();
    renderList();
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function icsDateStamp(d) {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  }

  function icsAllDay(d) {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }

  function escapeIcs(text) {
    return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }

  function buildIcs(items) {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Festa Fireworks Alert//EN", "CALSCALE:GREGORIAN"];
    const stamp = icsDateStamp(new Date());
    items.forEach(({ f, date, closest }) => {
      const loc = state.localityById.get(f.localityId);
      const dtStart = icsAllDay(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      const dtEnd = icsAllDay(endDate);
      const descParts = [`~${closest.dist.toFixed(1)} km away.`];
      if (f.notes) descParts.push(f.notes);
      if (f.confidence !== "high") descParts.push("Date/scale not fully confirmed - double check closer to the day.");
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${f.id}@festa-fireworks-alert`);
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
      lines.push(`SUMMARY:${escapeIcs(`🎆 ${loc ? loc.name : f.localityId} — ${f.title}`)}`);
      lines.push(`DESCRIPTION:${escapeIcs(descParts.join(" "))}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function downloadIcs(icsText, filename) {
    const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function attachEvents() {
    townAddSelect.addEventListener("change", () => {
      const id = townAddSelect.value;
      if (!id) return;
      if (!state.towns.includes(id)) state.towns.push(id);
      persist();
      populateTownAddSelect();
      renderTownsChips();
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
      renderList();
    });
    calendarExportBtn.addEventListener("click", () => {
      const upcoming = getNearUpcomingFestas();
      if (!upcoming.length) return;
      const ics = buildIcs(upcoming);
      downloadIcs(ics, "festa-fireworks-alert.ics");
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
    restoreFromUrlOrStorage();
    populateTownAddSelect();
    renderTownsChips();
    attachEvents();
    render();
  }

  init();
})();
