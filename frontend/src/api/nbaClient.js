const BASE_URL = 
  import.meta.env.DEV ? "/nba" : "/api/nba";

const HEADERS = {
  Accept: "application/json",
};



// Saves data so app lessens the request limiters per minute
// ChatGPT suggestion
const _cache = new Map(); // key -> { ts, data }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function cacheKey(path, params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => usp.set(k, String(v)));
  return `${path}?${usp.toString()}`;
}

function getCached(path, params) {
  const key = cacheKey(path, params);
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return hit.data;
}

function setCached(path, params, data) {
  _cache.set(cacheKey(path, params), { ts: Date.now(), data });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- utils ----------
// CHATGPT suggestion
function ensureArray(x) {
  return Array.isArray(x) ? x : [];
}

// Helps fight the request limits
// ChatGPT Suggestion
async function fetchJSON(url, options = {}, { maxRetries = 4 } = {}) {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, options);

    // If API-Sports signals rate limiting in headers, you could read them here too.
    // We'll inspect body for "rateLimit" errors below.
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";
    const body = contentType.includes("application/json") ? JSON.parse(text || "{}") : text;

    if (res.ok && !(body?.errors && body.errors.rateLimit)) {
      return body;
    }

    // Handle API error payloads
    const isRateLimited = body?.errors?.rateLimit || res.status === 429;
    if (isRateLimited && attempt < maxRetries) {
      // exponential backoff with jitter
      const backoff = Math.min(1000 * Math.pow(2, attempt), 8000) + Math.floor(Math.random() * 500);
      // Optional: read 'x-ratelimit-requests-remaining' / 'x-ratelimit-requests-reset' headers if exposed
      await sleep(backoff);
      attempt += 1;
      continue;
    }

    // Otherwise throw
    const errText = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`API error ${res.status}: ${errText || res.statusText}`);
  }
}

// Normalize so UI can safely read leagues.standard.team.logo & name
// CHATGPT suggestion
function normalizePlayers(players) {
  return ensureArray(players).map(p => {
    const out = { ...p };

    if (!out.name && (out.firstname || out.lastname)) {
      out.name = [out.firstname, out.lastname].filter(Boolean).join(" ").trim();
    }

    const teamLogo = p?.team?.logo ?? p?.leagues?.standard?.team?.logo;
    if (teamLogo) {
      out.leagues = out.leagues ?? {};
      out.leagues.standard = out.leagues.standard ?? {};
      out.leagues.standard.team = out.leagues.standard.team ?? {};
      if (!out.leagues.standard.team.logo) {
        out.leagues.standard.team.logo = teamLogo;
      }
    }
    return out;
  });
}

// Send and return the API data information
// Half ChatGPT half me
async function api(path, params = {}) {
  // Start the url header
  const base =
    BASE_URL.startsWith("http")
      ? BASE_URL
      : (globalThis?.location?.origin ?? "") + BASE_URL;

  // Since recalling info is long, save the data coming in as cache and return it
  const cached = getCached(path, params);
  if (cached) return cached;

  // Populate JSON with the parameters
  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  // Send the request to the API
  const json = await fetchJSON(url.toString(), { headers: HEADERS, method: "GET" });

  // Check if there were any issiues in the API request
  if (json?.errors && Object.keys(json.errors).length && !json.errors.rateLimit) {
    throw new Error(`API returned errors: ${JSON.stringify(json.errors)}`);
  }

  const payload = json?.response ?? json ?? [];
  const out = (path === "/players") ? normalizePlayers(payload) : payload;

  // Save new information coming in
  setCached(path, params, out);
  return out;
}

// Simple concurrency limiter to be gentle on rate limits
// CHATGPT suggestion
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

/*
* ============================ Note from Artur ======================================
* Use these functions in the other web pages
* These are programed to get params, and then use the above functions to search and return data right to you
*
* If more information needed or more params to be passed, Create a new function and add them
* Read more information on the documentation using their website : https://api-sports.io/documentation/nba/v2
*/

// ---------- TEAMS ----------
export async function getTeams({ conference } = {}) {
  const result = await api("/teams");

  // List of Conference
  const eastCities = [
    "Atlanta",
    "Boston",
    "Brooklyn",
    "Charlotte",
    "Chicago",
    "Cleveland",
    "Detroit",
    "Indiana",
    "Miami",
    "Milwaukee",
    "New York",
    "Orlando",
    "Philadelphia",
    "Toronto",
    "Washington",
  ];

  const westCities = [
    "Dallas",
    "Denver",
    "Golden State",
    "Houston",
    "LA",
    "Los Angeles",
    "Memphis",
    "Minnesota",
    "New Orleans",
    "Oklahoma City",
    "Phoenix",
    "Portland",
    "Sacramento",
    "San Antonio",
    "Utah",
  ];

  //filter only real NBA teams
  const nbaTeams = result.filter((team) => {
    if (!team.city) return false;

    const isNBA =
      eastCities.includes(team.city) || westCities.includes(team.city);

    if (!isNBA) return false;

    //delete Utah Blue and Utah White
    if (
      team.city === "Utah" &&
      !team.name.toLowerCase().includes("jazz")
    ) {
      return false;
    }

    // If conference is passed, filter by it
    if (conference === "east") return eastCities.includes(team.city);
    if (conference === "west") return westCities.includes(team.city);

    return true;
  });

  //console.log("✅ Filtered NBA Teams:", nbaTeams.length, nbaTeams);

  return nbaTeams;
}


export async function getTeamById(id) {
  const teams = await getTeams();
  const team = teams.find(t => Number(t.id) === Number(id));
  return team ?? null;
}

// ---------- GAMES ----------
export async function getUpcomingGames(dateStr) {
  //console.log("📅 Loading games for", dateStr);

  const targetDate = dateStr; // пользовательская дата, без смещений

  const seasons = await api("/seasons");
  const currentSeason = seasons[seasons.length - 1];

  let games = await api("/games", { season: currentSeason });

  if (!Array.isArray(games) || games.length === 0) {
    console.warn(`⚠️ No games found for ${targetDate}`);
    return [];
  }

  // ✅Filtering by local time, taking into account "night" matches
  return games.filter(g => {
    const leagueOk = g.league === "standard" || g.league?.name === "NBA";
    if (!leagueOk) return false;
    if (!g.date?.start) return false;

    const startUTC = new Date(g.date.start);
    const local = new Date(startUTC); //automatically converts to local time

    let localY = local.getFullYear();
    let localM = String(local.getMonth() + 1).padStart(2, "0");
    let localD = String(local.getDate()).padStart(2, "0");

    // If the match started at night (before 5:00), we'll assign it to the previous day
    if (local.getHours() < 5) {
      const prev = new Date(local);
      prev.setDate(prev.getDate() - 1);
      localY = prev.getFullYear();
      localM = String(prev.getMonth() + 1).padStart(2, "0");
      localD = String(prev.getDate()).padStart(2, "0");
    }

    const localStr = `${localY}-${localM}-${localD}`;

    return localStr === targetDate;
  });
}




export async function getGamesByDate(dateStr) {
  const games = await api("/games", {
    season: 2024,
    date: dateStr, // YYYY-MM-DD
  });

  return games.filter(g => g.league?.name === "NBA");
}




// ---------- PLAYERS ----------
export async function getPlayers({ season, team, id, search } = {}) {
  // only send params the endpoint supports
  const params = {};
  if (season) params.season = season;
  if (team) params.team = team;
  if (id) params.id = id;
  if (search) params.search = search;

  return api("/players", params);
}

export async function searchPlayersByName(name, season) {
  const first = await getPlayers({ search: name, season });
  if (Array.isArray(first) && first.length) return first;
  // fallback w/o season
  return getPlayers({ search: name });
}

export async function getPlayersByTeam(teamId, season) {
  return api("/players", { team: teamId, season });
}

export async function getPlayerById(id, season) {
  const data = await api("/players", { id, season });
  return data?.[0] ?? null;
}

export async function getSeasons() {
  return api("/seasons");
}

// A long ass calculation to get the top 15 players in the season
// half Chatgpt half me
export async function getTopPlayersBySeason({ season, limit = 15, metric = "pts" } = {}) {
  if (!season) throw new Error("season is required");

  // 1) teams (NBA franchises only)
  const allTeams = await getTeams();
  const nbaTeams = (Array.isArray(allTeams) ? allTeams : []).filter(
    t => t?.nbaFranchise === true || t?.leagues?.standard
  );
  const teamIds = nbaTeams.map(t => t?.id).filter(Boolean);

  // 2) players per team (reduces id space; cache will help on repeated visits)
  const playersByTeam = await mapLimit(teamIds, 2, async (tid) => {
    // small courtesy delay to spread requests
    await sleep(150);
    const list = await getPlayers({ season, team: tid });
    return Array.isArray(list) ? list : [];
  });
  const players = normalizePlayers(playersByTeam.flat());

  // Build lookup by player id for name/logo
  const byId = new Map(players.map(p => [p.id, p]));

  // 3) Get ALL per-game stats per team (≃ 30 requests total) and aggregate locally
  const teamStatsLists = await mapLimit(teamIds, 1, async (tid) => {
    // polite stagger
    await sleep(250);
    try {
      // API-Sports supports filtering statistics by team + season.
      // This returns per-game rows for every player on that team.
      const games = await api("/players/statistics", { season, team: tid });
      return Array.isArray(games) ? games : [];
    } catch {
      return [];
    }
  });

  const allGames = teamStatsLists.flat();

  // 4) Aggregate to season averages per player (only those we have player objects for)
  const sums = new Map();
  for (const g of allGames) {
    const pid = g?.player?.id ?? g?.id;
    if (!pid) continue;
    const cur = sums.get(pid) ?? { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, ftm: 0, fta: 0 };
    cur.gp += 1;
    cur.pts += g.points ?? g.pts ?? 0;
    cur.reb += g.totReb ?? g.rebounds ?? 0;
    cur.ast += g.assists ?? 0;
    cur.stl += g.steals ?? 0;
    cur.blk += g.blocks ?? 0;
    cur.tov += g.turnovers ?? 0;
    cur.fgm += g.fgm ?? 0;
    cur.fga += g.fga ?? 0;
    cur.ftm += g.ftm ?? 0;
    cur.fta += g.fta ?? 0;
    sums.set(pid, cur);
  }

  const playersWithAvg = [];
  for (const [pid, sum] of sums.entries()) {
    const gp = sum.gp || 1;
    const avg = {
      gp,
      pts: +(sum.pts / gp).toFixed(1),
      reb: +(sum.reb / gp).toFixed(1),
      ast: +(sum.ast / gp).toFixed(1),
      stl: +(sum.stl / gp).toFixed(1),
      blk: +(sum.blk / gp).toFixed(1),
      tov: +(sum.tov / gp).toFixed(1),
      fgm: +(sum.fgm / gp).toFixed(1),
      fga: +(sum.fga / gp).toFixed(1),
      ftm: +(sum.ftm / gp).toFixed(1),
      fta: +(sum.fta / gp).toFixed(1),
    };
    avg.eff = +((avg.pts + avg.reb + avg.ast + avg.stl + avg.blk)
      - (avg.fga - avg.fgm) - (avg.fta - avg.ftm) - avg.tov).toFixed(1);

    const p = byId.get(pid);
    if (p) playersWithAvg.push({ ...p, averages: avg });
  }

  const sortKey = metric === "eff" ? (p => p.averages.eff) : (p => p.averages.pts);
  playersWithAvg.sort((a, b) => sortKey(b) - sortKey(a));
  return playersWithAvg.slice(0, limit);
}
