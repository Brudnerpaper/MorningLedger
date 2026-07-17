# The Morning Ledger — standalone site

A real website version of your morning briefing: weather (Upton, Lincoln, Truro),
Cape Cod Bay marine forecast + buoy 44090, Yankees, and markets. No Claude
sign-in required — loads straight from NWS/NOAA, the MLB Stats API, and Finnhub.

## Deploy to Netlify (5 minutes)

1. Go to **app.netlify.com** and log in (or create a free account).
2. Click **Add new site → Deploy manually**.
3. Drag this entire `morning-ledger-site` folder onto the upload box.
   (Netlify will detect `netlify.toml` and wire up the functions automatically.)
4. Once it's deployed, go to **Site configuration → Environment variables**.
5. Add a variable:
   - Key: `FINNHUB_API_KEY`
   - Value: *your Finnhub key*
6. Go to **Deploys** and trigger **Deploy site** again (env vars only apply
   to new deploys).
7. Your site is live at the `*.netlify.app` URL Netlify gives you. Rename it
   under **Site configuration → General → Site details → Change site name**
   to something like `steve-morning-ledger.netlify.app`.

## Add it to your iPhone home screen

1. Open the site URL in **Safari** on your iPhone.
2. Tap the **Share** icon → **Add to Home Screen**.
3. It'll appear as a "Ledger" icon that opens full-screen, no browser bar.

## Notes on data sources

- **Weather**: National Weather Service (api.weather.gov) — no key required.
- **Marine + buoy**: NWS coastal forecast (zone ANZ231) + NOAA NDBC buoy
  44090 realtime feed. If buoy 44018 comes back online, edit `BUOY_ID` in
  `netlify/functions/marine.js`.
- **Yankees**: MLB Stats API (statsapi.mlb.com) — no key required.
- **Markets**: Finnhub free tier. Dow/S&P/Nasdaq and the commodities are
  shown via liquid ETF proxies (DIA, SPY, QQQ, GLD, SLV, PPLT, USO, UNG)
  since true futures contracts aren't on the free tier — this is disclosed
  on the page itself.

## Refreshing

The page fetches live on every load, and the "Fresh Edition" button re-fetches
on demand. Netlify also edge-caches each function response for 10 minutes
(see `netlify.toml`) so repeat visits within that window are instant.

## Security note

Never commit your Finnhub key into this code or into a public GitHub repo —
it's read from the `FINNHUB_API_KEY` environment variable at runtime, kept
server-side in the Netlify function, and never sent to the browser.
