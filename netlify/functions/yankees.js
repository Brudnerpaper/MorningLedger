// MLB Stats API is free and unauthenticated. Yankees teamId = 147,
// AL East divisionId = 201.
//
// IMPORTANT: the bare /schedule endpoint does NOT include final scores —
// that requires hydrate=linescore. Score lives at game.linescore.teams.
// {home,away}.runs, not game.teams.{home,away}.score (which doesn't exist
// on this endpoint and was the source of the "undefined-undefined" bug).
// hydrate=decisions adds winning/losing/save pitcher for a real recap line.
const TEAM_ID = 147;
const AL_EAST_DIVISION_ID = 201;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

async function loadSchedule() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 5);
  const end = new Date(today);
  end.setDate(end.getDate() + 5);

  const data = await fetchJson(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${fmtDate(start)}&endDate=${fmtDate(end)}&hydrate=linescore,decisions`
  );
  const games = (data.dates || []).flatMap((d) => d.games);

  const past = games
    .filter((g) => g.status.abstractGameState === "Final")
    .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
  const future = games
    .filter((g) => g.status.abstractGameState !== "Final")
    .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));

  const getRuns = (g, side) => g.linescore?.teams?.[side]?.runs ?? g.teams?.[side]?.score ?? null;

  const describeGame = (g, forPast) => {
    const isHome = g.teams.home.team.id === TEAM_ID;
    const opp = isHome ? g.teams.away.team : g.teams.home.team;
    const dateStr = new Date(g.gameDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (forPast) {
      const usSide = isHome ? "home" : "away";
      const themSide = isHome ? "away" : "home";
      const usRuns = getRuns(g, usSide);
      const themRuns = getRuns(g, themSide);
      const result = usRuns !== null && themRuns !== null ? (usRuns > themRuns ? "W" : "L") : "?";
      const scoreStr = usRuns !== null && themRuns !== null ? `${result} ${usRuns}-${themRuns}` : "Final (score n/a)";
      return { date: dateStr, opponent: `${isHome ? "vs" : "at"} ${opp.name}`, result: scoreStr };
    }
    const time = new Date(g.gameDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    return { date: dateStr, opponent: `${isHome ? "vs" : "at"} ${opp.name}`, time };
  };

  const lastTwo = past.slice(-2).reverse().map((g) => describeGame(g, true));
  const nextTwo = future.slice(0, 2).map((g) => describeGame(g, false));

  const lastGame = past[past.length - 1];
  let lastNight = { played: false, headline: "No Yankees game recently — check schedule", recap: null };
  if (lastGame) {
    const gameDate = new Date(lastGame.gameDate);
    const hoursSince = (today - gameDate) / 36e5;
    if (hoursSince < 30) {
      const isHome = lastGame.teams.home.team.id === TEAM_ID;
      const usSide = isHome ? "home" : "away";
      const themSide = isHome ? "away" : "home";
      const usRuns = getRuns(lastGame, usSide);
      const themRuns = getRuns(lastGame, themSide);
      const opp = isHome ? lastGame.teams.away.team : lastGame.teams.home.team;

      let headline = `Yankees game vs ${opp.name} — score unavailable`;
      if (usRuns !== null && themRuns !== null) {
        const result = usRuns > themRuns ? "beat" : "fell to";
        headline = `Yankees ${result} ${opp.name} ${usRuns}-${themRuns}`;
      }

      let recap = null;
      const dec = lastGame.decisions;
      if (dec) {
        const parts = [];
        if (dec.winner) parts.push(`W: ${dec.winner.fullName}`);
        if (dec.loser) parts.push(`L: ${dec.loser.fullName}`);
        if (dec.save) parts.push(`SV: ${dec.save.fullName}`);
        if (parts.length) recap = parts.join(" · ");
      }

      lastNight = { played: true, headline, recap };
    }
  }

  return { lastNight, lastTwo, nextTwo };
}

async function loadStandings() {
  const season = new Date().getFullYear();
  const data = await fetchJson(
    `https://statsapi.mlb.com/api/v1/standings?leagueId=103&season=${season}&standingsTypes=regularSeason`
  );
  const division = (data.records || []).find((r) => r.division.id === AL_EAST_DIVISION_ID);
  if (!division) return [];
  return division.teamRecords
    .sort((a, b) => a.divisionRank - b.divisionRank)
    .map((t) => ({
      team: t.team.name.replace("New York Yankees", "Yankees").replace("Boston Red Sox", "Red Sox")
        .replace("Tampa Bay Rays", "Rays").replace("Toronto Blue Jays", "Blue Jays")
        .replace("Baltimore Orioles", "Orioles"),
      w: t.wins,
      l: t.losses,
      gb: t.gamesBack,
    }));
}

exports.handler = async () => {
  const [scheduleRes, standingsRes] = await Promise.allSettled([loadSchedule(), loadStandings()]);
  const body = {
    ...(scheduleRes.status === "fulfilled" ? scheduleRes.value : { error: scheduleRes.reason?.message }),
    standings: standingsRes.status === "fulfilled" ? standingsRes.value : [],
    standingsError: standingsRes.status === "rejected" ? standingsRes.reason?.message : null,
  };
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
};
