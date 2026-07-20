// Top financial news headlines via Finnhub's free market-news endpoint.
// Headlines + source + link only (no article text) — keeps this well clear
// of any copyright concern and lets Steve click through for the full piece.
const KEY = process.env.FINNHUB_API_KEY;

exports.handler = async () => {
  if (!KEY) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "FINNHUB_API_KEY is not set in Netlify environment variables." }),
    };
  }
  try {
    const res = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${KEY}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const headlines = (Array.isArray(data) ? data : [])
      .filter((item) => item.headline && item.source)
      .slice(0, 8)
      .map((item) => ({
        headline: item.headline,
        source: item.source,
        url: item.url,
        datetime: item.datetime ? new Date(item.datetime * 1000).toISOString() : null,
      }));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headlines }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
