// Pulls current conditions + 3-day forecast from the National Weather Service
// (api.weather.gov) for three towns. NWS is a two-step API: first resolve
// lat/lon to a forecast grid via /points/, then fetch /forecast from that
// grid. We resolve dynamically (rather than hardcoding grid offsets) since
// office grid boundaries occasionally shift and a wrong guess 404s outright.

const TOWNS = {
  upton: { label: "Upton, Mass.", lat: 42.1876, lon: -71.6054, obsStation: "KORH" }, // Worcester Rgnl (nearest ASOS)
  lincoln: { label: "Lincoln, N.H.", lat: 44.0464, lon: -71.6687, obsStation: "KLIN" }, // Lincoln/Hanover NH
  truro: { label: "Truro, Mass.", lat: 41.9834, lon: -70.0497, obsStation: "KPVC" }, // Provincetown Airport
};

const HEADERS = {
  "User-Agent": "MorningLedger/1.0 (personal use)",
  Accept: "application/geo+json",
};

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function cToF(c) {
  if (c === null || c === undefined) return null;
  return Math.round((c * 9) / 5 + 32);
}

function dirToCompass(deg) {
  if (deg === null || deg === undefined) return "";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function shortCondition(s) {
  if (!s) return "—";
  return s.length > 22 ? s.slice(0, 22) + "…" : s;
}

async function loadTown(cfg) {
  const errors = [];

  // Step 1: resolve lat/lon -> forecast grid URL
  let forecastUrl = null;
  try {
    const point = await fetchJson(`https://api.weather.gov/points/${cfg.lat},${cfg.lon}`);
    forecastUrl = point.properties.forecast;
  } catch (e) {
    errors.push(`points lookup: ${e.message}`);
  }

  // Step 2 (parallel): forecast periods + latest observation
  const [forecastRes, obsRes] = await Promise.allSettled([
    forecastUrl ? fetchJson(forecastUrl) : Promise.reject(new Error("no forecast URL")),
    fetchJson(`https://api.weather.gov/stations/${cfg.obsStation}/observations/latest`),
  ]);

  let tempF = null;
  let condition = "—";
  let wind = "—";
  if (obsRes.status === "fulfilled") {
    const p = obsRes.value.properties;
    tempF = cToF(p.temperature?.value);
    condition = p.textDescription || condition;
    const windSpeed = p.windSpeed?.value;
    if (windSpeed !== null && windSpeed !== undefined) {
      const mph = Math.round(windSpeed * 0.621371);
      wind = mph === 0 ? "Calm" : `${dirToCompass(p.windDirection?.value)} ${mph} mph`;
    }
  } else {
    errors.push(`observation: ${obsRes.reason?.message}`);
  }

  let days = [];
  if (forecastRes.status === "fulfilled") {
    const periods = forecastRes.value.properties.periods || [];
    const dayPeriods = periods.filter((p) => p.isDaytime).slice(0, 3);
    days = dayPeriods.map((p) => {
      const idx = periods.indexOf(p);
      const nightPeriod = periods[idx + 1] && !periods[idx + 1].isDaytime ? periods[idx + 1] : null;
      return {
        day: p.name.split(" ")[0].slice(0, 3),
        high: p.temperature,
        low: nightPeriod ? nightPeriod.temperature : null,
        condition: shortCondition(p.shortForecast),
      };
    });
  } else {
    errors.push(`forecast: ${forecastRes.reason?.message}`);
  }

  return { label: cfg.label, tempF, condition, wind, forecast: days, _errors: errors };
}

exports.handler = async () => {
  try {
    const entries = await Promise.all(
      Object.entries(TOWNS).map(async ([key, cfg]) => [key, await loadTown(cfg)])
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(entries)),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
