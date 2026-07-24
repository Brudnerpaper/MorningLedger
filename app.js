const $ = (id) => document.getElementById(id);

function esc(s) {
  if (s === null || s === undefined) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

function loadingHTML() {
  return `<div class="loading">
    <div class="loading-line" style="width:85%"></div>
    <div class="loading-line" style="width:70%"></div>
    <div class="loading-line" style="width:75%"></div>
  </div>`;
}

function errorHTML(what, message, retryFn) {
  const id = "retry-" + Math.random().toString(36).slice(2);
  setTimeout(() => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", retryFn);
  }, 0);
  return `<div class="error-note">
    <p>The ${esc(what)} wire did not come through this morning.</p>
    ${message ? `<p class="error-detail">(${esc(message)})</p>` : ""}
    <button class="retry" id="${id}">Request again</button>
  </div>`;
}

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ---------- Weather & Marine ----------
function townHTML(t) {
  const rows = (t.forecast || [])
    .map((d) => `<tr><td class="mono">${esc(d.day)}</td><td>${esc(d.condition)}</td><td class="mono num">${esc(d.high)}° / ${esc(d.low)}°</td></tr>`)
    .join("");
  return `<div class="town">
    <div class="town-head">
      <span class="town-name">${esc(t.label)}</span>
      <span class="town-now"><span class="big-temp">${t.tempF ?? "—"}°</span> ${esc(t.condition)}</span>
    </div>
    <div class="town-wind">Wind ${esc(t.wind)}</div>
    <table class="mini-table"><tbody>${rows}</tbody></table>
  </div>`;
}

async function loadWeather() {
  $("weather-body").innerHTML = loadingHTML();
  try {
    const data = await getJSON("/.netlify/functions/weather");
    $("weather-body").innerHTML = ["upton", "lincoln", "truro"].map((k) => townHTML(data[k])).join("");
    const ear = $("ear-weather").querySelector(".ear-big");
    ear.textContent = data.upton?.tempF ? `${data.upton.tempF}° ${data.upton.condition}` : "—";
  } catch (e) {
    $("weather-body").innerHTML = errorHTML("weather", e.message, loadWeather);
  }
}

async function loadMarine() {
  $("marine-body").innerHTML = loadingHTML();
  try {
    const data = await getJSON("/.netlify/functions/marine");
    const f = data.forecast;
    const b = data.buoy;
    let html = `<div class="marine-head">Provincetown · Cape Cod Bay</div>`;
    if (f) {
      const hasAdvisory = f.advisories && !/none/i.test(f.advisories);
      html += hasAdvisory
        ? `<div class="advisory">⚑ ${esc(f.advisories)}</div>`
        : `<div class="no-advisory">No advisories in effect</div>`;
      const rows = (f.periods || [])
        .map((p) => `<tr><td class="mono">${esc(p.label)}</td><td>${esc(p.text)}</td></tr>`)
        .join("");
      html += `<table class="mini-table"><tbody>${rows}</tbody></table>`;
    } else {
      html += `<p class="dim" style="font-size:12.5px">Forecast unavailable (${esc(data.forecastError)})</p>`;
    }
    if (b) {
      html += `<div class="buoy">
        <div class="sub-label">Buoy ${esc(b.id)} — Cape Cod Bay · ${esc(b.time)}</div>
        <table class="mini-table"><tbody>
          <tr><td class="mono">Wind</td><td>${esc(b.wind || "n/a")}${b.gusts ? `, gusts ${esc(b.gusts)}` : ""}</td></tr>
          <tr><td class="mono">Seas</td><td>${esc(b.waves || "n/a")}${b.period ? ` @ ${esc(b.period)}` : ""}</td></tr>
          <tr><td class="mono">Temp</td><td>air ${esc(b.airTemp || "n/a")} · water ${esc(b.waterTemp || "n/a")}</td></tr>
        </tbody></table>
      </div>`;
    } else {
      html += `<p class="dim" style="font-size:12.5px">Buoy 44090 unavailable (${esc(data.buoyError)})</p>`;
    }
    $("marine-body").innerHTML = html;
  } catch (e) {
    $("marine-body").innerHTML = errorHTML("marine", e.message, loadMarine);
  }
}

// ---------- Sports ----------
async function loadSports() {
  $("sports-body").innerHTML = loadingHTML();
  try {
    const data = await getJSON("/.netlify/functions/yankees");
    const lastTwo = (data.lastTwo || [])
      .map((g) => `<div class="game-line"><span class="mono dim">${esc(g.date)}</span> ${esc(g.opponent)}<span class="mono result ${g.result?.startsWith("W") ? "win" : "loss"}">${esc(g.result)}</span></div>`)
      .join("");
    const nextTwo = (data.nextTwo || [])
      .map((g) => `<div class="game-line"><span class="mono dim">${esc(g.date)}</span> ${esc(g.opponent)}<span class="mono result">${esc(g.time)}</span></div>`)
      .join("");
    const standingsRows = (data.standings || [])
      .map((t) => `<tr class="${/yankees/i.test(t.team) ? "nyy" : ""}"><td>${esc(t.team)}</td><td class="mono num">${esc(t.w)}</td><td class="mono num">${esc(t.l)}</td><td class="mono num">${esc(t.gb)}</td></tr>`)
      .join("");
    $("sports-body").innerHTML = `
      <div class="score-headline">${esc(data.lastNight?.headline)}</div>
      ${data.lastNight?.recap ? `<div class="score-note">${esc(data.lastNight.recap)}</div>` : ""}
      <div class="two-col">
        <div><div class="sub-label">Last two</div>${lastTwo || '<p class="dim" style="font-size:12.5px">No recent games</p>'}</div>
        <div><div class="sub-label">Up next</div>${nextTwo || '<p class="dim" style="font-size:12.5px">TBD</p>'}</div>
      </div>
      <div class="sub-label" style="margin-top:14px">American League East</div>
      <table class="standings"><thead><tr><th>Club</th><th class="num">W</th><th class="num">L</th><th class="num">GB</th></tr></thead>
        <tbody>${standingsRows}</tbody>
      </table>`;
  } catch (e) {
    $("sports-body").innerHTML = errorHTML("baseball", e.message, loadSports);
  }
}

// ---------- Markets ----------
function quoteRow(q, extraClass) {
  if (q.error) {
    return `<tr><td>${esc(q.name)}</td><td colspan="2" class="dim" style="font-size:11px">unavailable (${esc(q.error)})</td></tr>`;
  }
  const arrow = q.up ? "▲" : "▼";
  const arrowClass = q.up ? "up" : "down";
  return `<tr class="${extraClass || ""}">
    <td>${esc(q.name)}</td>
    <td class="mono num">${esc(q.value)}</td>
    <td class="mono num ${q.up ? "win" : "loss"}"><span class="arrow ${arrowClass}">${arrow}</span> ${esc(q.pts)} · ${esc(q.change)}</td>
  </tr>${q.range ? `<tr class="range-row"><td colspan="3" class="mono dim">session range ${esc(q.range)}</td></tr>` : ""}`;
}

async function loadMarkets() {
  $("markets-body").innerHTML = loadingHTML();
  try {
    const [data, vstr] = await Promise.all([
      getJSON("/.netlify/functions/markets"),
      getJSON("/.netlify/functions/vstr").catch((e) => ({ error: e.message })),
    ]);
    const futuresRows = (data.futures || []).map((f) => quoteRow(f)).join("");
    const tslaRow = data.tsla ? quoteRow(data.tsla, "tsla-row") : "";
    const spcxRow = data.spcx ? quoteRow(data.spcx) : "";
    const commodityRows = (data.commodities || []).map((c) => quoteRow(c)).join("");
    const watchlistRows = (data.watchlist || []).map((w) => quoteRow(w)).join("");

    const vstrHTML = vstr && !vstr.error
      ? `<div class="sub-label">Your Portfolio</div>
         <table class="quotes"><tbody>${quoteRow(vstr, "vstr-row")}</tbody></table>
         <div class="vstr-note">${esc(vstr.note)} · YTD ${esc(vstr.ytdChange)}</div>`
      : `<div class="sub-label">Your Portfolio</div><p class="dim" style="font-size:12.5px">VSTR unavailable${vstr?.error ? ` (${esc(vstr.error)})` : ""}</p>`;

    $("markets-body").innerHTML = `
      ${vstrHTML}
      <div class="sub-label" style="margin-top:14px">Futures</div>
      <table class="quotes"><tbody>${futuresRows}${tslaRow}${spcxRow}</tbody></table>
      <div class="sub-label" style="margin-top:14px">Commodities &amp; Crypto</div>
      <table class="quotes"><tbody>${commodityRows}</tbody></table>
      <div class="sub-label" style="margin-top:14px">Watchlist</div>
      <table class="quotes"><tbody>${watchlistRows}</tbody></table>
      <p class="proxy-note">Futures update nearly around the clock (unlike stocks), so overnight and pre-market moves should show here, not just yesterday's close.</p>`;

    const up = (data.futures || []).filter((f) => f.up).length;
    const ear = $("ear-markets").querySelector(".ear-big");
    ear.textContent = up >= 2 ? "▲ Futures firm" : "▼ Futures soft";
  } catch (e) {
    $("markets-body").innerHTML = errorHTML("markets", e.message, loadMarkets);
  }
}

// ---------- Night Sky ----------
function nightHTML(town, night, isDetail) {
  const planetsList = (night.planetsInView || []).length
    ? night.planetsInView.map((p) => `${esc(p.name)} (${esc(p.direction)}, best ~${esc(p.bestTime)})`).join(", ")
    : (night.planets || []).length
      ? `${night.planets.length} planet(s) up, but not toward your usual view`
      : "no bright planets well-placed tonight";
  const showerNote = (night.showersInView || []).length
    ? night.showersInView.map((s) => `${esc(s.name)}${s.isPeak ? " (peak tonight!)" : ""} — radiant ${esc(s.radiant)}, ~${s.zhr}/hr under dark skies`).join("; ")
    : null;

  if (isDetail) {
    return `<div class="night-town">
      <div class="night-town-head">${esc(town.label)} <span class="dim" style="font-size:11px">(facing ${esc(town.viewDirection)})</span></div>
      <div class="night-line">🌙 ${esc(night.moon.phase)}, ${night.moon.illumPct}% illuminated${night.moon.moonrise ? ` · rises ${esc(night.moon.moonrise)}` : ""}${night.moon.moonset ? `, sets ${esc(night.moon.moonset)}` : ""}</div>
      <div class="night-line">Dark skies: ${esc(night.darkWindow.start || "—")}–${esc(night.darkWindow.end || "—")}</div>
      <div class="night-line"><strong>Best viewing:</strong> ${esc(night.bestViewing || "—")}</div>
      <div class="night-line">Visible toward your sky: ${planetsList}</div>
      ${showerNote ? `<div class="night-line shower-flag">☄ ${showerNote}</div>` : ""}
    </div>`;
  }
  return night;
}

async function loadNightSky() {
  $("nightsky-body").innerHTML = loadingHTML();
  try {
    const data = await getJSON("/.netlify/functions/nightsky");
    const towns = ["truro", "lincoln", "upton"];
    const detailHTML = `<div class="night-grid">${towns.map((k) => nightHTML(data[k], data[k].nights[0], true)).join("")}</div>`;

    // 2-week outlook table: moon phase + any meteor shower, per town isn't
    // needed separately since moon phase is the same everywhere — just
    // flag showers per town's matching view.
    const rows = data.truro.nights.map((n, i) => {
      const showersAnywhere = towns
        .map((k) => data[k].nights[i].showersInView.map((s) => `${s.name} (${data[k].label.split(",")[0]})`))
        .flat();
      return `<tr>
        <td class="mono">${esc(n.date)}</td>
        <td>${esc(n.moon.phase)} (${n.moon.illumPct}%)</td>
        <td>${showersAnywhere.length ? `<span class="shower-flag">${esc(showersAnywhere.join(", "))}</span>` : "—"}</td>
      </tr>`;
    }).join("");

    $("nightsky-body").innerHTML = `
      ${detailHTML}
      <div class="sub-label" style="margin-top:16px">14-Day Outlook</div>
      <table class="outlook-table"><thead><tr><th>Date</th><th>Moon</th><th>Notable</th></tr></thead>
        <tbody>${rows}</tbody></table>
      <p class="proxy-note">Planet visibility and moon data are calculated directly (no cloud forecast beyond ~7 days out, so treat the back half of the outlook as astronomy only, not a sky-clarity guarantee).</p>`;
  } catch (e) {
    $("nightsky-body").innerHTML = errorHTML("night sky", e.message, loadNightSky);
  }
}

// ---------- Financial News ----------
async function loadNews() {
  $("news-body").innerHTML = loadingHTML();
  try {
    const data = await getJSON("/.netlify/functions/news");
    const items = (data.headlines || [])
      .map((h) => `<div class="news-item"><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.headline)}</a><span class="news-source">${esc(h.source)}</span></div>`)
      .join("");
    $("news-body").innerHTML = items || '<p class="dim" style="font-size:12.5px">No headlines available right now.</p>';
  } catch (e) {
    $("news-body").innerHTML = errorHTML("financial news", e.message, loadNews);
  }
}

// ---------- On This Day ----------
async function loadOnThisDay() {
  $("onthisday-body").innerHTML = loadingHTML();
  try {
    const data = await getJSON("/.netlify/functions/onthisday");
    $("onthisday-body").innerHTML = `
      ${data.event ? `<div class="otd-event">${esc(data.event)}</div>` : ""}
      <div class="otd-quote">"${esc(data.quote)}"</div>
      <div class="otd-attribution">— ${esc(data.attribution)}</div>`;
  } catch (e) {
    $("onthisday-body").innerHTML = errorHTML("history", e.message, loadOnThisDay);
  }
}

function loadAll() {
  loadWeather();
  loadMarine();
  loadSports();
  loadMarkets();
  loadNightSky();
  loadNews();
  loadOnThisDay();
}

$("date-line").textContent = new Date()
  .toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  .toUpperCase();
$("refresh-btn").addEventListener("click", loadAll);

loadAll();
