// Cape Cod Bay marine forecast (NWS zone ANZ231) + latest observations from
// NOAA NDBC buoy 44090. Buoy 44018 (the original ask) has been offline since
// mid-2026; 44090 sits in Cape Cod Bay proper and is the live substitute.
// If 44018 comes back online, swap BUOY_ID back and the parser below still works.

const HEADERS = { "User-Agent": "MorningLedger/1.0 (personal use)", Accept: "application/geo+json" };
const ZONE = "ANZ231"; // Cape Cod Bay coastal waters
const BUOY_ID = "44090";

async function fetchText(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

// NWS marine zones are NOT served by the /zones/forecast/{id}/forecast JSON
// endpoint (that's land zones only). Marine forecasts are published as text
// bulletins ("Coastal Waters Forecast", product code CWF) by the issuing
// office (BOX = Boston) and cover multiple zones in one document. We fetch
// the latest CWF bulletin and parse out just the Cape Cod Bay (ANZ231) section.

async function loadForecast() {
  const list = await fetchJson("https://api.weather.gov/products/types/CWF/locations/BOX");
  const products = list["@graph"] || [];
  if (!products.length) throw new Error("no CWF bulletins found for BOX");
  const latest = await fetchJson(`https://api.weather.gov/products/${products[0].id}`);
  const text = latest.productText || "";

  // Isolate the ANZ231 (Cape Cod Bay) block: from its zone header to the
  // next zone header or the "$$" end-of-segment marker.
  const zoneMatch = text.match(/ANZ231-[\s\S]*?(?=\n\S*ANZ\d{3}-|\n\$\$|$)/);
  if (!zoneMatch) throw new Error("ANZ231 section not found in bulletin");
  let block = zoneMatch[0];

  // Advisory/warning language is wrapped in triple-dots, e.g.
  // "...SMALL CRAFT ADVISORY IN EFFECT FROM 4 PM EDT..."
  const advisoryMatch = block.match(/\.\.\.([A-Z0-9 ,'\/-]*ADVISORY[\s\S]*?)\.\.\./);
  const advisories = advisoryMatch ? advisoryMatch[1].replace(/\s+/g, " ").trim() : null;
  if (advisoryMatch) block = block.replace(advisoryMatch[0], " ");

  // Forecast periods are marked like ".TODAY...", ".TONIGHT...", ".WED...".
  const markerRe = /\.([A-Z][A-Z ]{2,30})\.\.\./g;
  const markers = [];
  let m;
  while ((m = markerRe.exec(block)) !== null) {
    markers.push({ label: m[1].trim(), start: markerRe.lastIndex });
  }
  const periods = markers.map((mk, i) => {
    const end = i + 1 < markers.length ? markers[i + 1].start - (markers[i + 1].label.length + 4) : block.length;
    return { label: mk.label, text: block.slice(mk.start, end).replace(/\s+/g, " ").trim() };
  }).filter((p) => p.text.length > 0);

  return {
    advisories: advisories || "None flagged",
    periods: periods.slice(0, 4),
  };
}

// NDBC realtime2 files are whitespace-delimited text, most recent row first.
// Columns: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE
function parseBuoyLatest(text) {
  const lines = text.trim().split("\n").filter((l) => !l.startsWith("#"));
  if (!lines.length) return null;
  const cols = lines[0].trim().split(/\s+/);
  const [YY, MM, DD, hh, mm, WDIR, WSPD, GST, WVHT, DPD, , , , ATMP, WTMP] = cols;
  const naOr = (v, fn) => (v === "MM" || v === undefined ? null : fn(v));
  const msToKt = (ms) => Math.round(parseFloat(ms) * 1.94384);
  const mToFt = (m) => (parseFloat(m) * 3.28084).toFixed(1);
  const cToF = (c) => Math.round((parseFloat(c) * 9) / 5 + 32);

  return {
    time: `${MM}/${DD} ${hh}:${mm} UTC`,
    wind: naOr(WSPD, (v) => `${msToKt(v)} kt`),
    gusts: naOr(GST, (v) => `${msToKt(v)} kt`),
    waves: naOr(WVHT, (v) => `${mToFt(v)} ft`),
    period: naOr(DPD, (v) => `${v} sec`),
    airTemp: naOr(ATMP, (v) => `${cToF(v)}°F`),
    waterTemp: naOr(WTMP, (v) => `${cToF(v)}°F`),
  };
}

async function loadBuoy() {
  const text = await fetchText(`https://www.ndbc.noaa.gov/data/realtime2/${BUOY_ID}.txt`);
  const parsed = parseBuoyLatest(text);
  if (!parsed) throw new Error("no buoy rows returned");
  return { id: BUOY_ID, ...parsed };
}

exports.handler = async () => {
  const [forecastRes, buoyRes] = await Promise.allSettled([loadForecast(), loadBuoy()]);
  const body = {
    forecast: forecastRes.status === "fulfilled" ? forecastRes.value : null,
    forecastError: forecastRes.status === "rejected" ? forecastRes.reason?.message : null,
    buoy: buoyRes.status === "fulfilled" ? buoyRes.value : null,
    buoyError: buoyRes.status === "rejected" ? buoyRes.reason?.message : null,
  };
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
};
