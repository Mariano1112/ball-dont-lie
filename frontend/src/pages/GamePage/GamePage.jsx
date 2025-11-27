import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/nbaClient";
import styles from "./GamePage.module.css";

export default function GamePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [loading, setLoading] = useState(true);


  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    if (theme === "dark") document.body.classList.add("dark-theme");
    else document.body.classList.remove("dark-theme");

    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };


  // ================== LOAD GAME + STATS ==================
  async function loadGame() {
    try {
      // 1) Load base game info
      const g = await api("/games", { id });
      const gameObj = g?.[0] || null;

      // Pre-declare teams BEFORE stats processing
      const home = gameObj.teams.home;
      const away = gameObj.teams.visitors;

      const homeScore = gameObj.scores?.home?.points ?? 0;
      const awayScore = gameObj.scores?.visitors?.points ?? 0;

      // 2) Load team stats (quarters, totals)
      const statsRes = await api("/games/statistics", { id });
      let statsObj = statsRes?.[0] || { statistics: [] };

      const homeId = home.id;
      const awayId = away.id;

      // 3) Always load player stats separately
      const season = gameObj.season ?? 2025;

      const playersRaw = await api("/players/statistics", {
        game: id,
        season
      });

      const homePlayers = playersRaw.filter(p => p.team.id === homeId);
      const awayPlayers = playersRaw.filter(p => p.team.id === awayId);

      // 4) Merge teams + players + quarter stats
      statsObj.statistics = [
        {
          team: home,
          players: homePlayers,
          points: statsObj.statistics?.[0]?.points ?? {
            quarter_1: 0, quarter_2: 0, quarter_3: 0, quarter_4: 0, total: homeScore
          }
        },
        {
          team: away,
          players: awayPlayers,
          points: statsObj.statistics?.[1]?.points ?? {
            quarter_1: 0, quarter_2: 0, quarter_3: 0, quarter_4: 0, total: awayScore
          }
        }
      ];

      console.log("FINAL_STATS:", JSON.stringify(statsObj, null, 2));

      // Apply state
      setGame(gameObj);
      setStats(statsObj);

      if (!selectedTeam) {
        setSelectedTeam(homeId);
      }

      setLoading(false);
    } catch (err) {
      console.error("LOAD ERROR:", err);
    }
  }

  useEffect(() => {
    loadGame();
  }, [id]);


  // ================== AUTO REFRESH FOR LIVE GAMES ==================
  useEffect(() => {
    if (!game) return;

    const short = game.status?.short;
    const live =
      ["LIVE", "1Q", "2Q", "3Q", "4Q", "OT", "AOT"].includes(short) ||
      game.status?.long?.toLowerCase().includes("live");

    if (!live) return;

    const interval = setInterval(loadGame, 10000);
    return () => clearInterval(interval);
  }, [game]);

  if (loading || !game) return <div>Loading...</div>;


  // ================== LOCAL VARIABLES FROM GAME ==================
  const home = game.teams.home;
  const away = game.teams.visitors;

  const homeScore = game.scores?.home?.points ?? 0;
  const awayScore = game.scores?.visitors?.points ?? 0;
  const notStarted = ["NS", "0", 0, "scheduled", "Scheduled"].includes(game.status?.short)
    || game.status?.long?.toLowerCase().includes("sched");


  // ================== CLEAN STATS ==================
  const cleanedStats = stats.statistics;
  const teamStats = cleanedStats.find(t => t.team.id === selectedTeam);
  // If match not started → show 0–0–0 fake players table
  let players = teamStats?.players ?? [];

  if (notStarted) {
    players = [
      {
        player: { firstname: "-", lastname: "-" },
        minutes: "0",
        points: 0,
        totReb: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        personalFouls: 0,
        plusMinus: 0,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
        ftm: 0,
        fta: 0
      }
    ];
  }



  // ================== HELPERS ==================
  function percent(made, attempts) {
    if (!attempts) return "0%";
    return Math.round((made / attempts) * 100) + "%";
  }

  function get2PT(p) {
    return {
      twoPM: p.fgm - p.tpm,
      twoPA: p.fga - p.tpa
    };
  }


  function getPeriodLabel() {
    const p = game.periods?.current;

    if (!p || p === 0) return null;

    // 1–4 → Q1-Q4
    if (p >= 1 && p <= 4) {
      return `Q${p}`;
    }

    // 5+ → OT1, OT2, OT3…
    if (p >= 5) {
      return `OT${p - 4}`;
    }

    return null;
  }


  return (
    <div className={styles.body}>

      <header className={styles.navbar}>
        <div className={styles.leftBlock} onClick={() => navigate("/")}>
          <img src="/WEB-Logo/Basketball.png" className={styles.navLogo} />
          <span className={styles.navTitle}>Ball Don't Lie</span>
        </div>

        <button className={styles.themeBtn} onClick={toggleTheme}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </header>

      <div className={styles.gameWrapper}>

        {/* ================== HEADER ================== */}
        <div className={styles.header}>
          <div className={styles.teamSide}>
            <img src={home.logo} className={styles.logo} />
            <div className={styles.teamName}>{home.name}</div>
          </div>

          <div className={styles.centerBox}>
            {notStarted ? (
              <>
                <div className={styles.matchDate}>
                  {new Date(game.date.start).toLocaleDateString()}
                </div>



                <div className={styles.vs}>VS</div>

                <div className={styles.matchTime}>
                  {new Date(game.date.start).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </>
            ) : (
              <>
                <div className={styles.score}>{homeScore} - {awayScore}</div>

                {game.status?.long && (
                  <div className={styles.status}>{game.status.long}</div>
                )}

                {game.status.clock && (
                  <div className={styles.clock}>
                    {getPeriodLabel()} - {game.status.clock}
                  </div>
                )}

              </>
            )}

          </div>

          <div className={styles.teamSide}>
            <img src={away.logo} className={styles.logo} />
            <div className={styles.teamName}>{away.name}</div>
          </div>
        </div>

        {/* ================== QUARTERS TABLE ================== */}
        <div className={styles.quartersTable}>
          <table>
            <thead>
              <tr>
                <th>Team</th>

                {/* Generate Q1–Q4 + OT dynamically */}
                {(() => {
                  const homeLS = game.scores?.home?.linescore ?? [];
                  const colCount = homeLS.length;

                  return Array.from({ length: colCount }).map((_, i) => {
                    if (i < 4) return <th key={i}>Q{i + 1}</th>;
                    return <th key={i}>OT{i - 3}</th>;
                  });
                })()}

                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {/* HOME TEAM */}
              <tr>
                <td>{home.name}</td>

                {(game.scores?.home?.linescore ?? []).map((v, i) => (
                  <td key={i}>{v ?? 0}</td>
                ))}

                <td>{homeScore}</td>
              </tr>

              {/* AWAY TEAM */}
              <tr>
                <td>{away.name}</td>

                {(game.scores?.visitors?.linescore ?? []).map((v, i) => (
                  <td key={i}>{v ?? 0}</td>
                ))}

                <td>{awayScore}</td>
              </tr>
            </tbody>
          </table>
        </div>


        {/* ================== TEAM SWITCH ================== */}
        <div className={styles.switchButtons}>
          <button
            className={selectedTeam === home.id ? styles.activeSwitch : styles.switch}
            onClick={() => setSelectedTeam(home.id)}
          >
            {home.name}
          </button>

          <button
            className={selectedTeam === away.id ? styles.activeSwitch : styles.switch}
            onClick={() => setSelectedTeam(away.id)}
          >
            {away.name}
          </button>
        </div>

        {/* ================== PLAYER TABLE ================== */}
        <h2 className={styles.statsTitle}>Statistics</h2>

        <div className={styles.tableWrapper}>
          <table className={styles.statsTable}>
            <thead>
              <tr>
                <th>Player</th>
                <th>MIN</th>
                <th>PTS</th>
                <th>REB</th>
                <th>AST</th>
                <th>STL</th>
                <th>BLK</th>
                <th>TOV</th>
                <th>PF</th>
                <th>+/-</th>
                <th>FG</th>
                <th>FG%</th>
                <th>3PT</th>
                <th>3PT%</th>
                <th>FT</th>
                <th>FT%</th>
              </tr>
            </thead>

            <tbody>
              {players.map((p) => (
                <tr key={p.player.id}>
                  <td>{p.player.firstname} {p.player.lastname}</td>
                  <td>{p.minutes ?? p.min ?? "-"}</td>
                  <td>{p.points ?? 0}</td>
                  <td>{p.totReb ?? 0}</td>
                  <td>{p.assists ?? 0}</td>
                  <td>{p.steals ?? 0}</td>
                  <td>{p.blocks ?? 0}</td>
                  <td>{p.turnovers ?? 0}</td>
                  <td>{p.personalFouls ?? 0}</td>
                  <td>{p.plusMinus ?? 0}</td>
                  <td>{p.fgm}/{p.fga}</td>
                  <td>{percent(p.fgm, p.fga)}</td>
                  <td>{p.tpm}/{p.tpa}</td>
                  <td>{percent(p.tpm, p.tpa)}</td>
                  <td>{p.ftm}/{p.fta}</td>
                  <td>{percent(p.ftm, p.fta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
