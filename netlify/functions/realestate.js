// Active multi-family sale listings in Steve's target towns, via RentCast's
// free-tier API (50 calls/month — see netlify.toml for the long cache TTL
// on this specific function, which keeps monthly usage well under budget
// since real estate listings don't meaningfully change day to day).
//
// Requires env var RENTCAST_API_KEY (free signup at rentcast.io/api).
//
// Scored loosely against Steve's own past acquisition pattern: multi-family
// (2+ units), separate utilities preferred, GRM under ~12x is strong,
// avoid listings that read like heavy rehab projects.
const KEY = process.env.RENTCAST_API_KEY;

const TOWNS = ["Uxbridge", "Upton", "Northbridge"];
const STATE = "MA";

const REHAB_FLAGS = /\b(fixer|handyman|as-is|as is|needs work|tlc|investor special|cash only|gut|rehab)\b/i;

function fmtMoney(n) {
  if (n === null || n === undefined) return "n/a";
  return `$${Math.round(n).toLocaleString()}`;
}

async function fetchTownListings(city) {
  const url = `https://api.rentcast.io/v1/listings/sale?city=${encodeURIComponent(city)}&state=${STATE}&propertyType=Multi-Family&status=Active&limit=10`;
  const res = await fetch(url, { headers: { "X-Api-Key": KEY, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${city} -> HTTP ${res.status}`);
  const data = await res.json();
  const listings = Array.isArray(data) ? data : [];

  return listings.map((l) => {
    const price = l.price ?? null;
    const beds = l.bedrooms ?? null;
    const baths = l.bathrooms ?? null;
    const sqft = l.squareFootage ?? null;
    const units = l.unitCount ?? null;
    const daysOnMarket = l.daysOnMarket ?? null;
    const desc = l.description || "";
    const rehabFlag = REHAB_FLAGS.test(desc);

    return {
      address: l.formattedAddress || l.addressLine1 || "Address unavailable",
      price: fmtMoney(price),
      priceRaw: price,
      beds,
      baths,
      sqft,
      units,
      daysOnMarket,
      rehabFlag,
      listedDate: l.listedDate || null,
      url: l.listingUrl || null,
    };
  }).sort((a, b) => (a.priceRaw ?? Infinity) - (b.priceRaw ?? Infinity));
}

exports.handler = async () => {
  if (!KEY) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "RENTCAST_API_KEY is not set in Netlify environment variables." }),
    };
  }
  try {
    const entries = await Promise.all(
      TOWNS.map(async (town) => {
        try {
          const listings = await fetchTownListings(town);
          return [town, { listings }];
        } catch (e) {
          return [town, { listings: [], error: e.message }];
        }
      })
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
