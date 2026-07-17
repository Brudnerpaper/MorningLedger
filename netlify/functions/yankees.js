// MLB Stats API is free and unauthenticated. Yankees teamId = 147,
// AL East divisionId = 201.
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
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${TEAM_ID}&startDate=${fmtDate(start)}&endDate=${fmtDate(end)}`
  );
  const games = (data.dates || []).flatMap((d) => d.games);

  const past = games
    .filter((g) => g.status.abstractGameState === "Final")
    .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
  const future = games
    .filter((g) => g.status.abstractGameState !== "Final")
    .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));

  const describeGame = (g, forPast) => {
    const isHome = g.teams.home.team.id === TEAM_ID;
    const opp = isHome ? g.teams.away.team : g.teams.home.team;
    const dateStr = new Date(g.gameDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (forPast) {
      const us = isHome ? g.teams.home : g.teams.away;
      const them = isHome ? g.teams.away : g.teams.home;
      const result = us.score > them.score ? "W" : "L";
      return { date: dateStr, opponent: `${isHome ? "vs" : "at"} ${opp.name}`, result: `${result} ${us.score}-${them.score}` };
    }
    const time = new Date(g.gameDate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    return { date: dateStr, opponent: `${isHome ? "vs" : "at"} ${opp.name}`, time };
  };

  const lastTwo = past.slice(-2).reverse().map((g) => describeGame(g, true));
  const nextTwo = future.slice(0, 2).map((g) => describeGame(g, false));

  const lastGame = past[past.length - 1];
  let lastNight = { played: false, headline: "No Yankees game recently — check schedule" };
  if (lastGame) {
    const gameDate = new Date(lastGame.gameDate);
    const hoursSince = (today - gameDate) / 36e5;
    if (hoursSince < 30) {
      const isHome = lastGame.teams.home.team.id === TEAM_ID;
      const us = isHome ? lastGame.teams.home : lastGame.teams.away;
      const them = isHome ? lastGame.teams.away : lastGame.teams.home;
      const result = us.score > them.score ? "W" : "L";
      lastNight = {
        played: true,
        headline: `Yankees ${result === "W" ? "beat" : "fell to"} ${them.team.name} ${us.score}-${them.score}`,
      };
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
