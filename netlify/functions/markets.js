// Finnhub's free tier covers US equities/ETFs and crypto quotes, but not
// true index futures or metals/energy futures. We use liquid ETF proxies
// that track those instruments closely (DIA~Dow, SPY~S&P500, QQQ~Nasdaq100,
// GLD~gold, SLV~silver, PPLT~platinum, USO~WTI crude, UNG~nat gas) and
// label them clearly on the frontend so there's no confusion with the
// artifact version's raw futures quotes.
//
// Requires env var FINNHUB_API_KEY (set in Netlify site settings -> 
// Environment variables — do NOT hardcode the key here).

const KEY = process.env.FINNHUB_API_KEY;

const STOCKS = [
  { symbol: "DIA", name: "Dow (DIA proxy)" },
  { symbol: "SPY", name: "S&P 500 (SPY proxy)" },
  { symbol: "QQQ", name: "Nasdaq (QQQ proxy)" },
];
const NAMED = { tsla: "TSLA", spcx: "SPCX" };
const WATCHLIST = [
  "MSFT", "NVDA", "GOOGL", "AMZN", "AAPL", "CAT", "AVGO", "PANW", "LLY", "TSM",
  "IBM", "DELL", "META", "V", "GOOG", "GEV", "TER", "DE", "WMT", "TSLA",
];
const COMMODITIES = [
  { symbol: "USO", name: "WTI Crude" },
  { symbol: "UNG", name: "Nat Gas" },
  { symbol: "GLD", name: "Gold" },
  { symbol: "SLV", name: "Silver" },
  { symbol: "PPLT", name: "Platinum" },
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
  const futures = await batchQuotes(STOCKS, (s) => s.symbol, (s) => s.name);
  const [tsla, spcx] = await Promise.all([safeQuote(NAMED.tsla, "Tesla"), safeQuote(NAMED.spcx, "SpaceX")]);
  const commodities = await batchQuotes(COMMODITIES, (c) => c.symbol, (c) => c.name);
  const crypto = await batchQuotes(CRYPTO, (c) => c.symbol, (c) => c.name);
  const watchlist = await batchQuotes(WATCHLIST, (s) => s, (s) => s);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ futures, tsla, spcx, commodities: [...commodities, ...crypto], watchlist }),
  };
};
