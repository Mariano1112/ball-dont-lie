import styles from "./HomePage.module.css";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { getTeams } from "../../api/nbaClient";
import { getUpcomingGames } from "../../api/nbaClient";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";




export default function HomePage() {
  const navigate = useNavigate();


  // ---------- TEAMS ----------
  const [teamsData, setTeamsData] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [errorTeams, setErrorTeams] = useState("");

  // ---------- GAMES ----------
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [loadingGames, setLoadingGames] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date().toISOString().split("T")[0];
    return today;
  });

  // Search + filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [showFilterPopup, setShowFilterPopup] = useState(false);

  // === THEME SWITCH ===
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




  function handleSearch() {
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim().toLowerCase();

    const matched = teamsData.filter(t =>
      t.name?.toLowerCase().includes(query) ||
      t.full_name?.toLowerCase().includes(query) ||
      t.city?.toLowerCase().includes(query)
    );

    if (matched.length === 1) {
      const id = matched[0].id;

      setActiveFilters(prev =>
        prev.includes(id) ? prev : [...prev, id]
      );

      setSearchQuery("");
    } else if (matched.length > 1) {
      alert("Multiple teams found. Please type more specific");
    } else {
      alert("No team found");
    }
  }



  function handleSearchKey(e) {
    if (e.key === "Enter") handleSearch();
  }

  // Calendat open/close
  const [showCalendar, setShowCalendar] = useState(false);

  // close function calendar
  function handleDateChange(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const formatted = `${year}-${month}-${day}`;

    console.log("📅 Selected date (pure local):", formatted);
    setSelectedDate(formatted);
    setShowCalendar(false);
  }

  // Call API client handler to get information
  useEffect(() => {
    (async () => {
      setLoadingTeams(true);
      setErrorTeams("");
      try {
        const teams = await getTeams(); // all teams
        setTeamsData(teams || []);
      } catch (err) {
        setErrorTeams(err?.message || "Failed to load teams");
      } finally {
        setLoadingTeams(false);
      }
    })();
  }, []);

  // ---------- Load Games ----------
  useEffect(() => {
    let intervalId;

    const fetchGames = async () => {
      setLoadingGames(true);
      try {
        const games = await getUpcomingGames(selectedDate);
        setUpcomingGames(games || []);
      } catch (err) {
        console.error("❌ Failed to load games:", err);
      } finally {
        setLoadingGames(false);
      }
    };

    fetchGames();
    intervalId = setInterval(fetchGames, 10000); // updatre every 20sec

    return () => clearInterval(intervalId);
  }, [selectedDate]);


  // 🔁Automatic score update every 15 seconds, only if there are LIVE matches
  useEffect(() => {
    const liveGames = upcomingGames.filter(g => {
      const s = String(g.status?.short || "").toUpperCase();
      const l = String(g.status?.long || "").toLowerCase();
      return ["1Q", "2Q", "3Q", "4Q", "OT", "AOT", "LIVE"].includes(s) || l.includes("live") || l.includes("progress");
    });
    if (liveGames.length === 0) return;

    const interval = setInterval(async () => {
      try {
        console.log("🔄 Refreshing live scores...");
        const games = await getUpcomingGames(selectedDate);
        setUpcomingGames(games || []);
      } catch (err) {
        console.error("❌ Live refresh failed:", err);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [upcomingGames, selectedDate]);




  // Determinate the week around chosen day
  function getWeekDays(dateStr) {
    const date = new Date(`${dateStr}T12:00:00`);
    const start = new Date(date);
    const dayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat)
    start.setDate(date.getDate() - dayOfWeek);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      return {
        abbr: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
        num: d.getDate(),
        dateStr: formatted,
        isActive: formatted === dateStr,
      };
    });
  }

  const filteredGames =
    activeFilters.length === 0
      ? upcomingGames
      : upcomingGames.filter(g => {
        const homeId = g.teams?.home?.id;
        const visitorId = g.teams?.visitors?.id;
        return activeFilters.includes(homeId) || activeFilters.includes(visitorId);
      });

  return (
    <div className={styles.body}>
      {/* Navbar */}
      <header className={styles.navbar}>
        <div className={styles.leftBlock} onClick={() => navigate("/")}>
          <img src="/WEB-Logo/Basketball.png" className={styles.navLogo} />
          <span className={styles.navTitle}>Ball Don't Lie</span>
        </div>

        <button className={styles.themeBtn} onClick={toggleTheme}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </header>



      {/* Main container for all blocks */}
      <div className={styles.containers}>
        {/* Game/Search container */}
        <h1 className={styles.GamesTitle}>Latest games</h1>
        {/* 🔹 Date and week selection container */}
        <section className={styles.dateNavContainer}>
          {/* The left part is the date and icon */}
          <div className={styles.dateLeft} onClick={() => setShowCalendar(!showCalendar)}>
            <img src="/NavBar_icon/calendar.svg" alt="calendar" className={styles.calendarIcon} />
            {(() => {
              const [year, month, day] = selectedDate.split("-");
              const d = new Date(year, month - 1, day);
              return d.toLocaleDateString("en-US", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).toUpperCase();
            })()}
          </div>

          {/* The central part is the days of the week */}
          <div className={styles.weekDays}>
            {getWeekDays(selectedDate).map((day, idx) => (
              <div
                key={idx}
                className={`${styles.weekDay} ${day.isActive ? styles.activeDay : ""}`}
                onClick={() => setSelectedDate(day.dateStr)}
              >
                <div className={styles.dayAbbr}>{day.abbr}</div>
                <div className={styles.dayNum}>{day.num}</div>
              </div>
            ))}
          </div>

          {/* Right – filters & account */}
          <button className={styles.btnFilter} onClick={() => setShowFilterPopup(prev => !prev)}>
            Filter
          </button>

          {showFilterPopup && (
            <div className={styles.filterPopup}>
              <div className={styles.popupSearch}>
                <img src="/NavBar_icon/search.svg" className={styles.popupSearchIcon} />

                <input
                  type="text"
                  className={styles.popupSearchInput}
                  placeholder="Search for team's matches"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKey}
                />

                <button
                  className={styles.popupSearchBtn}
                  onClick={handleSearch}
                >
                  OK
                </button>
              </div>

              <hr className={styles.popupDivider} />

              {activeFilters.map((id) => {
                const team = teamsData.find(t => t.id === id);
                if (!team) return null;

                return (
                  <div key={id} className={styles.filterItem}>
                    <span>{team.name}</span>
                    <button
                      className={styles.removeFilterBtn}
                      onClick={() =>
                        setActiveFilters(prev => prev.filter(x => x !== id))
                      }
                    >
                      ✖
                    </button>
                  </div>
                );
              })}

              {activeFilters.length > 0 && (
                <button
                  className={styles.clearAllBtn}
                  onClick={() => setActiveFilters([])}
                >
                  Clear all
                </button>
              )}
            </div>
          )}


          {/* Drop-down calendar */}
          {showCalendar && (
            <div className={styles.calendarDropdown}>
              <Calendar
                locale="en-US"
                onChange={handleDateChange}
                value={new Date(`${selectedDate}T12:00:00`)}
                next2Label={null}
                prev2Label={null}
              />
            </div>
          )}
        </section>

        <section className={styles.gameContainer}>
          <section className={styles.upcomingGames}>
            <div className={styles.gamesGrid}>
              {!loadingGames && filteredGames.length > 0 ? (
                filteredGames.map((game, idx) => {

                  console.log("🔥 FULL GAME DATA:", JSON.stringify(game, null, 2));

                  const gameTime = new Date(game.date?.start);
                  // ---- Detect status using doc from  API-Sports ----
                  const short = String(game.status?.short || "").toUpperCase();
                  const long = String(game.status?.long || "").toLowerCase();
                  const clock = game.status?.clock || "";

                  const LIVE_STATUSES = [
                    "LIVE", "1Q", "2Q", "3Q", "4Q", "OT", "AOT", "HT", "IN PLAY"
                  ];

                  const isLive =
                    LIVE_STATUSES.includes(short) ||
                    long.includes("live") ||
                    long.includes("in play") ||
                    (clock && clock !== "0:00" && clock !== "00:00");

                  const FINISHED_STATUSES = ["FT", "FINAL"];
                  const isFinished =
                    FINISHED_STATUSES.includes(short) ||
                    long.includes("final") ||
                    long.includes("finished") ||
                    long.includes("ended");



                  const home = game.teams?.home || { name: "Home Team", code: "HOM", logo: "/fallback.png" };
                  const visitor = game.teams?.visitors || { name: "Visitor Team", code: "VIS", logo: "/fallback.png" };



                  return (
                    <div
                      key={game.id || game.gameId || idx}
                      className={styles.gameCard}
                      onClick={() => navigate(`/game/${game.id || game.gameId}`)}
                    >
                      {/* Left Team */}
                      <div className={styles.team}>
                        <img src={home.logo} alt={home.name} />
                        <span>{home.code}</span>
                      </div>

                      {/* Central Block */}
                      <div className={styles.centerBlock}>
                        {/* Time Start on Top */}
                        <div className={styles.gameTimeTop}>
                          {isLive ? (
                            <div className={styles.liveIndicator}>
                              <span className={styles.liveDot}></span>
                              <span className={styles.liveText}>LIVE</span>
                            </div>
                          ) : isFinished ? (
                            "Final"
                          ) : (
                            gameTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          )}
                        </div>



                        {/* Score or VS */}
                        <div className={styles.vs}>
                          {isLive
                            ? `${game.scores?.home?.points ?? 0} - ${game.scores?.visitors?.points ?? 0}`
                            : isFinished
                              ? `${game.scores?.home?.points ?? 0} - ${game.scores?.visitors?.points ?? 0}`
                              : "vs"}
                        </div>


                        {/* Date on bottom */}
                        {/* Date or clock info on bottom */}
                        <div className={styles.gameDateBottom}>
                          {isLive ? (
                            <>
                              Q{game.periods?.current || "?"} – {game.status?.clock || "--:--"}
                            </>
                          ) : isFinished ? (
                            "Final"
                          ) : (
                            gameTime.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          )}
                        </div>

                      </div>

                      {/* Right Team */}
                      <div className={styles.team}>
                        <img src={visitor.logo} alt={visitor.name} />
                        <span>{visitor.code}</span>
                      </div>
                    </div>
                  );

                })
              ) : !loadingGames ? (
                <p>No upcoming games.</p>
              ) : (
                <div>Loading games...</div>
              )}
            </div>
          </section>
        </section>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        This site is under development.
        <br /> If you have any suggestions or encounter any errors while using this site, please contact me by email aalavrynets@gmail.com.
        <br />Thank you for your feedback.
      </footer>
    </div>
  );
}

