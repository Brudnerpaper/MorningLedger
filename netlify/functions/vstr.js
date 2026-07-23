// VSTR — Steve's private "share class" for his 6-rental portfolio, built
// in Vestora. Price = (current rental marks + cumulative YTD NOI
// reinvested) / fixed share count. NOI reinvests continuously rather than
// paying out, so the price drifts up daily even between manual updates.
//
// FOR NOW this is a static baseline, hand-updated whenever fresh QuickBooks
// financials get pulled into Vestora — NOT a live feed. To update after a
// refresh in Vestora: change BASELINE below to the new date/price/NAV that
// Vestora shows on its Overview tab, then commit. Daily accrual keeps the
// number moving realistically in between those updates.

const BASELINE = {
  date: "2026-07-13",       // last QuickBooks pull reflected in this baseline
  price: 106.88,             // VSTR price as of that date, per Vestora Overview tab
  shares: 43304.6,           // fixed share count
  inceptionDate: "2026-01-01",
  inceptionPrice: 100.00,
  dailyAccrualPerShare: 0.014, // ~1.4¢/share/day reinvested-yield accrual
};

function daysBetween(a, b) {
  const msPerDay = 86400000;
  return Math.round((b - a) / msPerDay);
}

function easternTodayDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return new Date(Date.UTC(+get("year"), +get("month") - 1, +get("day")));
}

exports.handler = async () => {
  const today = easternTodayDate();
  const baselineDate = new Date(BASELINE.date + "T00:00:00Z");
  const inceptionDate = new Date(BASELINE.inceptionDate + "T00:00:00Z");

  const daysSinceBaseline = Math.max(0, daysBetween(baselineDate, today));
  const daysSinceYesterday = 1;

  const currentPrice = BASELINE.price + BASELINE.dailyAccrualPerShare * daysSinceBaseline;
  const yesterdayPrice = currentPrice - BASELINE.dailyAccrualPerShare * daysSinceYesterday;
  const pts = currentPrice - yesterdayPrice;
  const dailyPct = (pts / yesterdayPrice) * 100;

  const ytdPts = currentPrice - BASELINE.inceptionPrice;
  const ytdPct = (ytdPts / BASELINE.inceptionPrice) * 100;

  const nav = currentPrice * BASELINE.shares;

  const fmtMoney = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtPts = (n) => (n >= 0 ? "+" : "") + n.toFixed(3);
  const fmtPct = (n) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "VSTR (Rental Portfolio)",
      value: `$${fmtMoney(currentPrice)}`,
      pts: fmtPts(pts),
      change: fmtPct(dailyPct),
      up: pts >= 0,
      ytdChange: fmtPct(ytdPct),
      nav: `$${nav.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      shares: BASELINE.shares.toLocaleString(),
      asOf: BASELINE.date,
      note: `Marks as of ${BASELINE.date} QuickBooks pull; daily reinvested-yield accrual applied since.`,
    }),
  };
};
