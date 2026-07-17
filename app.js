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

async function loadForecast() {
  const data = await fetchJson(`https://api.weather.gov/zones/forecast/${ZONE}/forecast`);
  const periods = data.properties.periods || [];
  const pick = (name) => {
    const p = periods.find((p) => p.name.toLowerCase().includes(name));
    return p ? p.detailedForecast : null;
  };
  const advisoryPeriod = periods.find((p) => /small craft|advisory|warning/i.test(p.detailedForecast || ""));
  return {
    advisories: advisoryPeriod ? "Small craft advisory / warning language present — read forecast" : "None flagged",
    today: pick("today") || pick("this afternoon"),
    tonight: pick("tonight"),
    tomorrow: periods[2]?.detailedForecast || null,
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
