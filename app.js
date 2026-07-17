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
    const data = await getJSON("/.netlify/functions/markets");
    const futuresRows = (data.futures || []).map((f) => quoteRow(f)).join("");
    const tslaRow = data.tsla ? quoteRow(data.tsla, "tsla-row") : "";
    const spcxRow = data.spcx ? quoteRow(data.spcx) : "";
    const commodityRows = (data.commodities || []).map((c) => quoteRow(c)).join("");
    const watchlistRows = (data.watchlist || []).map((w) => quoteRow(w)).join("");

    $("markets-body").innerHTML = `
      <table class="quotes"><tbody>${futuresRows}${tslaRow}${spcxRow}</tbody></table>
      <div class="sub-label" style="margin-top:14px">Commodities &amp; Crypto</div>
      <table class="quotes"><tbody>${commodityRows}</tbody></table>
      <div class="sub-label" style="margin-top:14px">Watchlist</div>
      <table class="quotes"><tbody>${watchlistRows}</tbody></table>
      <p class="proxy-note">Dow/S&amp;P/Nasdaq and commodities are shown via liquid ETF proxies (DIA, SPY, QQQ, GLD, SLV, PPLT, USO, UNG) — Finnhub's free tier doesn't carry raw futures contracts.</p>`;

    const up = (data.futures || []).filter((f) => f.up).length;
    const ear = $("ear-markets").querySelector(".ear-big");
    ear.textContent = up >= 2 ? "▲ Futures firm" : "▼ Futures soft";
  } catch (e) {
    $("markets-body").innerHTML = errorHTML("markets", e.message, loadMarkets);
  }
}

function loadAll() {
  loadWeather();
  loadMarine();
  loadSports();
  loadMarkets();
}

$("date-line").textContent = new Date()
  .toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
  .toUpperCase();
$("refresh-btn").addEventListener("click", loadAll);

loadAll();
