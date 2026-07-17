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

async function quote(symbol) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${KEY}`;
  const res = await fetch(url);
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

  const [futures, tsla, spcx, commodities, crypto, watchlist] = await Promise.all([
    Promise.all(STOCKS.map((s) => safeQuote(s.symbol, s.name))),
    safeQuote(NAMED.tsla, "Tesla"),
    safeQuote(NAMED.spcx, "SpaceX"),
    Promise.all(COMMODITIES.map((c) => safeQuote(c.symbol, c.name))),
    Promise.all(CRYPTO.map((c) => safeQuote(c.symbol, c.name))),
    Promise.all(WATCHLIST.map((symbol) => safeQuote(symbol, symbol))),
  ]);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ futures, tsla, spcx, commodities: [...commodities, ...crypto], watchlist }),
  };
};
