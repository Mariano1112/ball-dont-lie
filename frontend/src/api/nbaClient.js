const BASE_URL =
  import.meta.env.DEV ? "/nba" : "/api/nba";

const HEADERS = {
  "x-rapidapi-key": import.meta.env.VITE_NBA_API_KEY,
  "x-rapidapi-host": "v2.nba.api-sports.io"
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
export async function api(path, params = {}) {

  if (!path.includes("/games") && !path.includes("/players")) {
    const cached = getCached(path, params);
    if (cached) return cached;
  }


  const base =
    BASE_URL.startsWith("http")
      ? BASE_URL
      : (globalThis?.location?.origin ?? "") + BASE_URL;

  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  const json = await fetchJSON(url.toString(), { headers: HEADERS, method: "GET" });

  if (json?.errors && Object.keys(json.errors).length && !json.errors.rateLimit) {
    throw new Error(`API returned errors: ${JSON.stringify(json.errors)}`);
  }

  const payload = json?.response ?? json ?? [];
  const out = (path === "/players") ? normalizePlayers(payload) : payload;

  // Only cache NON-live endpoints
  if (!path.includes("/games")) {
    setCached(path, params, out);
  }

  return out;
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
  console.log("📅 Loading games for", dateStr);

  const games = await api(`/games`, { date: dateStr });
  if (!Array.isArray(games) || games.length === 0) return [];

  const fullGames = [];

  for (const g of games) {
    let homeStats = {};
    let awayStats = {};
    let quarter = g.periods?.current ?? 0;
    let clock = null;

    try {
      const statsRes = await api(`/games/statistics`, { id: g.id });
      const teamStats = statsRes?.[0]?.statistics || [];

      homeStats = teamStats.find(s => s.team?.id === g.teams?.home?.id) || {};
      awayStats = teamStats.find(s => s.team?.id === g.teams?.visitors?.id) || {};

      // correct quarter
      quarter = g.periods?.current || homeStats.period || awayStats.period || 0;

      // correct clock (from statistics only)
      // Correct LIVE clock from 3 possible sources:
      clock =
        g.status?.clock ||
        homeStats?.clock ||
        awayStats?.clock ||
        null;


    } catch (err) {
      console.warn("⚠ Stats unavailable for game", g.id, err);
    }

    const short = String(g.status?.short || "").toUpperCase();
    const long = String(g.status?.long || "").toLowerCase();

    const isLive =
      ["LIVE", "1Q", "2Q", "3Q", "4Q", "OT", "AOT"].includes(short) ||
      long.includes("live") ||
      (clock && clock !== "0:00");

    const isFinished =
      ["FT", "FINAL"].includes(short) ||
      long.includes("final") ||
      long.includes("ended");

    fullGames.push({
      id: g.id,
      date: g.date,
      teams: g.teams,

      scores: {
        home: { points: g.scores?.home?.points ?? homeStats.points ?? 0 },
        visitors: { points: g.scores?.visitors?.points ?? awayStats.points ?? 0 },
      },

      periods: {
        current: quarter,
      },

      status: {
        short,
        long,
        clock: clock,
      },

      live: isLive,
      finished: isFinished,
    });
  }

  return fullGames;
}


