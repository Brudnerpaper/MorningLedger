// Astronomical calculations via astronomy-engine (no API key, no network call —
// pure math). Gives moon phase/illumination, dark-sky windows, visible-planet
// directions, and flags any active meteor showers, tuned to each town's
// actual viewing horizon.
const Astronomy = require("astronomy-engine");

const TOWNS = {
  truro: { label: "Truro, Mass.", lat: 41.9834, lon: -70.0497, primaryDirs: ["S"] },
  lincoln: { label: "Lincoln, N.H.", lat: 44.0464, lon: -71.6687, primaryDirs: ["W"] },
  upton: { label: "Upton, Mass.", lat: 42.1876, lon: -71.6054, primaryDirs: ["N", "S"] },
};

const PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

// Major annual meteor showers: peak date (MM-DD, approximate — shifts by a
// day some years), active window, radiant direction, typical rate.
const METEOR_SHOWERS = [
  { name: "Quadrantids", peak: "01-03", startOffset: -2, endOffset: 1, radiant: "N", zhr: 110 },
  { name: "Lyrids", peak: "04-22", startOffset: -3, endOffset: 2, radiant: "E", zhr: 18 },
  { name: "Eta Aquariids", peak: "05-05", startOffset: -3, endOffset: 3, radiant: "E", zhr: 50 },
  { name: "Perseids", peak: "08-12", startOffset: -5, endOffset: 3, radiant: "NE", zhr: 100 },
  { name: "Orionids", peak: "10-21", startOffset: -4, endOffset: 3, radiant: "E", zhr: 20 },
  { name: "Leonids", peak: "11-17", startOffset: -3, endOffset: 2, radiant: "E", zhr: 15 },
  { name: "Geminids", peak: "12-14", startOffset: -4, endOffset: 3, radiant: "NE", zhr: 120 },
  { name: "Ursids", peak: "12-22", startOffset: -2, endOffset: 1, radiant: "N", zhr: 10 },
];

const DIR_DEGREES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function azToCompass(az) {
  return COMPASS[Math.round(((az % 360) + 360) % 360 / 45) % 8];
}

function angularDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function matchesTownView(town, azimuth) {
  return town.primaryDirs.some((dir) => angularDiff(azimuth, DIR_DEGREES[dir]) <= 67.5);
}

function phaseName(angle) {
  const a = ((angle % 360) + 360) % 360;
  if (a < 22.5 || a >= 337.5) return "New Moon";
  if (a < 67.5) return "Waxing Crescent";
  if (a < 112.5) return "First Quarter";
  if (a < 157.5) return "Waxing Gibbous";
  if (a < 202.5) return "Full Moon";
  if (a < 247.5) return "Waning Gibbous";
  if (a < 292.5) return "Last Quarter";
  return "Waning Crescent";
}

function fmtTime(date) {
  if (!date) return null;
  return date.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
}

function mmdd(date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function activeShowersOn(date) {
  const target = mmdd(date);
  const targetNum = parseInt(target.replace("-", ""), 10);
  return METEOR_SHOWERS.filter((sh) => {
    const [pm, pd] = sh.peak.split("-").map(Number);
    const peakDate = new Date(Date.UTC(date.getUTCFullYear(), pm - 1, pd));
    const diffDays = Math.round((date - peakDate) / 86400000);
    return diffDays >= sh.startOffset && diffDays <= sh.endOffset;
  }).map((sh) => {
    const [pm, pd] = sh.peak.split("-").map(Number);
    const peakDate = new Date(Date.UTC(date.getUTCFullYear(), pm - 1, pd));
    const isPeak = Math.round((date - peakDate) / 86400000) === 0;
    return { ...sh, isPeak };
  });
}

function moonInfo(observer, date) {
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
  let moonrise = null, moonset = null;
  try { moonrise = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, 1, date, 1)?.date; } catch (e) {}
  try { moonset = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, -1, date, 1)?.date; } catch (e) {}
  return {
    phase: phaseName(illum.phase_angle),
    illumPct: Math.round(illum.phase_fraction * 100),
    moonrise: fmtTime(moonrise),
    moonset: fmtTime(moonset),
  };
}

function darkWindow(observer, date) {
  let duskStart = null, dawnEnd = null;
  try { duskStart = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, date, 1, -18)?.date; } catch (e) {}
  if (duskStart) {
    try { dawnEnd = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, 1, new Date(duskStart.getTime() + 3600000), 1, -18)?.date; } catch (e) {}
  }
  return { start: duskStart, end: dawnEnd };
}

function planetsVisible(observer, dark) {
  if (!dark.start || !dark.end) return [];
  const sampleTimes = [dark.start, new Date((dark.start.getTime() + dark.end.getTime()) / 2), dark.end];
  const found = [];
  for (const planet of PLANETS) {
    let best = null;
    for (const t of sampleTimes) {
      const eq = Astronomy.Equator(Astronomy.Body[planet], t, observer, true, true);
      const hor = Astronomy.Horizon(t, observer, eq.ra, eq.dec, "normal");
      if (hor.altitude > 10 && (!best || hor.altitude > best.altitude)) {
        best = { altitude: hor.altitude, azimuth: hor.azimuth, time: t };
      }
    }
    if (best) {
      found.push({
        name: planet,
        direction: azToCompass(best.azimuth),
        altitude: Math.round(best.altitude),
        bestTime: fmtTime(best.time),
      });
    }
  }
  return found;
}

function nightSummary(town, date) {
  const observer = new Astronomy.Observer(town.lat, town.lon, 0);
  const moon = moonInfo(observer, date);
  const dark = darkWindow(observer, date);
  const planets = planetsVisible(observer, dark);
  const matchingPlanets = planets.filter((p) => matchesTownView(town, DIR_DEGREES[p.direction] ?? 0));
  const showers = activeShowersOn(date);
  const matchingShowers = showers.filter((sh) => matchesTownView(town, DIR_DEGREES[sh.radiant]));

  let bestViewing = null;
  if (dark.start && dark.end) {
    bestViewing = moon.moonrise && moon.moonset
      ? `${fmtTime(dark.start)}–${fmtTime(dark.end)} (darkest skies once the moon is down)`
      : `${fmtTime(dark.start)}–${fmtTime(dark.end)}`;
  }

  return {
    date: mmdd(date),
    moon,
    darkWindow: { start: fmtTime(dark.start), end: fmtTime(dark.end) },
    bestViewing,
    planets,
    planetsInView: matchingPlanets,
    showers,
    showersInView: matchingShowers,
  };
}

exports.handler = async () => {
  try {
    const today = new Date();
    const out = {};
    for (const [key, town] of Object.entries(TOWNS)) {
      const nights = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(today.getTime() + i * 86400000);
        nights.push(nightSummary(town, d));
      }
      out[key] = { label: town.label, viewDirection: town.primaryDirs.join("/"), nights };
    }
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(out) };
  } catch (err) {
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: err.message }) };
  }
};
