// Finnhub's free tier covers US equities and crypto quotes well, but not
// true index/commodity futures. Real futures contracts (unlike the ETF
// proxies this used to use) trade nearly around the clock, so they don't
// go stale overnight/weekends the way a stock-market-hours-only ETF does.
// We pull those from Yahoo Finance's public chart endpoint instead — it's
// unofficial (no key, no formal support from Yahoo) but widely relied on
// for exactly this, and is what most \"free futures ticker\" sites use
// under the hood.
//
// Requires env var FINNHUB_API_KEY (set in Netlify site settings ->
// Environment variables — do NOT hardcode the key here).
//
// Propane is a separate government data source: EIA's Weekly Heating Oil
// and Propane Survey publishes a Massachusetts residential propane price
// (series W_EPLLPA_PRS_SMA_DPG). Requires env var EIA_API_KEY (also free,
// from eia.gov/opendata).

const KEY = process.env.FINNHUB_API_KEY;
const EIA_KEY = process.env.EIA_API_KEY;

// Real futures contracts, via Yahoo's chart endpoint.
const FUTURES = [
  { symbol: "YM=F", name: "Dow futures" },
  { symbol: "ES=F", name: "S&P 500 futures" },
  { symbol: "NQ=F", name: "Nasdaq futures" },
];
const COMMODITY_FUTURES = [
  { symbol: "CL=F", name: "WTI Crude" },
  { symbol: "NG=F", name: "Nat Gas" },
  { symbol: "GC=F", name: "Gold" },
  { symbol: "SI=F", name: "Silver" },
  { symbol: "PL=F", name: "Platinum" },
];

const NAMED = { tsla: "TSLA", spcx: "SPCX" };
const WATCHLIST = [
  "MSFT", "NVDA", "GOOGL", "AMZN", "AAPL", "CAT", "AVGO", "PANW", "LLY", "TSM",
  "IBM", "DELL", "META", "V", "GOOG", "GEV", "TER", "DE", "WMT", "TSLA",
];
const CRYPTO = [
  { symbol: "BINANCE:BTCUSDT", name: "Bitcoin" },
  { symbol: "BINANCE:ETHUSDT", name: "Ethereum" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function quote(symbol, attempt = 0) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${KEY}`;
  const res = await fetch(url);
  if (res.status === 429) {
    if (attempt >= 3) throw new Error(`${symbol} -> rate limited (429) after retries`);
    await sleep(500 * (attempt + 1)); // backoff: 500ms, 1000ms, 1500ms
    return quote(symbol, attempt + 1);
  }
  if (!res.ok) throw new Error(`${symbol} -> HTTP ${res.status}`);
  const d = await res.json();
  if (d.c === 0 && d.pc === 0) throw new Error(`${symbol} -> no data`);
  return {
    price: d.c,
    pts: +(d.c - d.pc).toFixed(2),
    changePct: d.dp,
    high: d.h,
    low: d.l,
    up: d.c >= d.pc,
  };
}

// Yahoo's unofficial chart endpoint. meta.regularMarketPrice reflects the
// latest trade (updates overnight for real futures, unlike an ETF), and
// meta.previousClose/chartPreviousClose gives us the prior settlement to
// compute change from.
async function yahooQuote(symbol, attempt = 0) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MorningLedger/1.0)" } });
  if (res.status === 429) {
    if (attempt >= 2) throw new Error(`${symbol} -> rate limited (429) after retries`);
    await sleep(500 * (attempt + 1));
    return yahooQuote(symbol, attempt + 1);
  }
  if (!res.ok) throw new Error(`${symbol} -> HTTP ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) {
    const err = data.chart?.error?.description || "no data";
    throw new Error(`${symbol} -> ${err}`);
  }
  const meta = result.meta;
  const price = meta.regularMarketPrice;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose;
  if (price === undefined || price === null || !prevClose) {
    throw new Error(`${symbol} -> incomplete data from Yahoo`);
  }
  const pts = +(price - prevClose).toFixed(2);
  return {
    price,
    pts,
    changePct: (pts / prevClose) * 100,
    high: meta.regularMarketDayHigh ?? price,
    low: meta.regularMarketDayLow ?? price,
    up: price >= prevClose,
  };
}

// Run quote lookups in small batches with a short pause between batches,
// rather than firing everything at once, to stay under Finnhub's per-second
// burst limit on the free tier (separate from its 60/minute cap).
async function batchQuotes(items, getSymbol, getName, batchSize = 6, pauseMs = 350) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => safeQuote(getSymbol(item), getName(item)))
    );
    results.push(...batchResults);
    if (i + batchSize < items.length) await sleep(pauseMs);
  }
  return results;
}

function fmtPts(pts) {
  return (pts >= 0 ? "+" : "") + pts.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function fmtPct(pct) {
  if (pct === null || pct === undefined) return "n/a";
  return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}
function fmtPrice(p) {
  return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function safeQuote(symbol, name) {
  try {
    const q = await quote(symbol);
    return {
      name,
      value: fmtPrice(q.price),
      pts: fmtPts(q.pts),
      change: fmtPct(q.changePct),
      up: q.up,
      range: `${fmtPrice(q.low)}-${fmtPrice(q.high)}`,
    };
  } catch (e) {
    return { name, error: e.message };
  }
}

async function safeYahooQuote(symbol, name) {
  try {
    const q = await yahooQuote(symbol);
    return {
      name,
      value: fmtPrice(q.price),
      pts: fmtPts(q.pts),
      change: fmtPct(q.changePct),
      up: q.up,
      range: `${fmtPrice(q.low)}-${fmtPrice(q.high)}`,
    };
  } catch (e) {
    return { name, error: e.message };
  }
}

async function batchYahooQuotes(items, batchSize = 4, pauseMs = 300) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((item) => safeYahooQuote(item.symbol, item.name)));
    results.push(...batchResults);
    if (i + batchSize < items.length) await sleep(pauseMs);
  }
  return results;
}

// EIA's weekly MA residential propane series, via the v2 API's
// backward-compatible /seriesid/ path. Returns the two most recent weekly
// readings so we can show week-over-week change (propane doesn't have an
// intraday "quote" the way stocks do — it updates once a week).
async function loadPropane() {
  if (!EIA_KEY) return { name: "Propane (MA avg)", error: "EIA_API_KEY not set" };

  // Primary: v1-style series ID via v2's backward-compat path. Full v1 IDs
  // need the category prefix + frequency suffix (category.series.freq) —
  // just the middle segment 404s as "series not found".
  const legacyUrl = `https://api.eia.gov/v2/seriesid/PET.W_EPLLPA_PRS_SMA_DPG.W?api_key=${EIA_KEY}`;
  let rows = null;
  let lastError = null;

  try {
    const res = await fetch(legacyUrl);
    if (res.ok) {
      const data = await res.json();
      rows = data.response?.data || null;
    } else {
      lastError = `legacy path HTTP ${res.status}`;
    }
  } catch (e) {
    lastError = `legacy path ${e.message}`;
  }

  // Fallback: query the native v2 route + facets directly if the legacy
  // series-ID path didn't pan out.
  if (!rows || !rows.length) {
    try {
      const nativeUrl = `https://api.eia.gov/v2/petroleum/pri/wfr/data/?api_key=${EIA_KEY}&frequency=weekly&data[0]=value&facets[duoarea][]=SMA&facets[product][]=EPLLPA&facets[process][]=PRS&sort[0][column]=period&sort[0][direction]=desc&length=2`;
      const res2 = await fetch(nativeUrl);
      if (res2.ok) {
        const data2 = await res2.json();
        const nativeRows = data2.response?.data || [];
        if (nativeRows.length) {
          rows = nativeRows.map((r) => ({ period: r.period, value: r.value }));
        } else {
          lastError = `${lastError || ""} · native route returned no rows`.trim();
        }
      } else {
        lastError = `${lastError || ""} · native route HTTP ${res2.status}`.trim();
      }
    } catch (e) {
      lastError = `${lastError || ""} · native route ${e.message}`.trim();
    }
  }

  if (!rows || !rows.length) {
    return { name: "Propane (MA avg)", error: lastError || "no data returned" };
  }

  rows.sort((a, b) => (a.period < b.period ? 1 : -1));
  const latest = parseFloat(rows[0].value);
  const prior = rows[1] ? parseFloat(rows[1].value) : null;
  const pts = prior !== null ? +(latest - prior).toFixed(3) : null;
  const pct = prior ? (pts / prior) * 100 : null;
  return {
    name: "Propane (MA avg)",
    value: `$${latest.toFixed(3)}/gal`,
    pts: pts !== null ? fmtPts(pts) : "n/a",
    change: pct !== null ? fmtPct(pct) : "n/a",
    up: pts !== null ? pts >= 0 : null,
    asOf: rows[0].period,
  };
}

exports.handler = async () => {
  if (!KEY) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "FINNHUB_API_KEY is not set in Netlify environment variables." }),
    };
  }

  // Fetch in this order, each batch pausing briefly before the next, so we
  // never burst more than ~6 requests at Finnhub in the same instant.
  const futures = await batchYahooQuotes(FUTURES);
  const [tsla, spcx, propane] = await Promise.all([
    safeQuote(NAMED.tsla, "Tesla"),
    safeQuote(NAMED.spcx, "SpaceX"),
    loadPropane(),
  ]);
  const commodities = await batchYahooQuotes(COMMODITY_FUTURES);
  const crypto = await batchQuotes(CRYPTO, (c) => c.symbol, (c) => c.name);
  const watchlist = await batchQuotes(WATCHLIST, (s) => s, (s) => s);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ futures, tsla, spcx, commodities: [...commodities, propane, ...crypto], watchlist }),
  };
};
