import { useEffect, useState } from "react";

export default function Portal() {
  const [games, setGames] = useState([]);
  const [filteredGames, setFilteredGames] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch("http://localhost:4000/api/live");
        const data = await res.json();
        setGames(data.response);
        setFilteredGames(data.response);
      } catch (err) {
        setError("Failed to load games");
      }
    };
    fetchGames();
  }, []);

  // 🔍 Filter when typing
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredGames(games);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredGames(
        games.filter(
          (g) =>
            g.teams.home.name.toLowerCase().includes(term) ||
            g.teams.away.name.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, games]);

  if (error) return <p>{error}</p>;
  if (!games.length) return <p>Loading games...</p>;

  return (
    <div style={{ padding: "2rem" }}>
     <h1 style={{ fontSize: "1.8rem", fontWeight: "bold", margin: 0 }}>
  
</h1>
{/* 🧢 Header bar */}
<div
  style={{
    width: "100%",
    backgroundColor: "#111827",
    color: "white",
    padding: "1rem 2rem",
    marginBottom: "1.5rem",
    borderRadius: "0 0 12px 12px",
    boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }}
>
  {/* Left: App name */}
  <h1
    style={{
      fontSize: "1.8rem",
      fontWeight: "700",
      letterSpacing: "0.5px",
      margin: 0,
    }}
  >
    🏀 Ball Don’t Lie 
  </h1>

  {/* Right: Schedule day buttons */}
  <div style={{ display: "flex", gap: "0.7rem" }}>
    {[-1, 0, 1].map((offset) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      const day = date.getDate();
      const iso = date.toISOString().split("T")[0];

      return (
        <button
          key={offset}
          onClick={async () => {
            try {
              const res = await fetch(
                `http://localhost:4000/api/live?date=${iso}`
              );
              const data = await res.json();
              setGames(data.response || []);
              setFilteredGames(data.response || []);
            } catch (err) {
              console.error("Error loading schedule:", err);
            }
          }}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: offset === 0 ? "#2563eb" : "#374151",
            color: "white",
            border: "none",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          {day}
        </button>
      );
    })}
  </div>
</div>


{/* 🏷️ League Filters */}
<div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
  {["All", "NBA", "NCAA", "G League"].map((league) => (
    <button
      key={league}
      onClick={() => {
        if (league === "All") setFilteredGames(games);
        else
          setFilteredGames(
            games.filter((g) => g.league.name.includes(league))
          );
      }}
      style={{
        padding: "0.4rem 0.8rem",
        borderRadius: "8px",
        border: "1px solid #ccc",
        backgroundColor: "#fff",
        cursor: "pointer",
        fontWeight: "500",
      }}
    >
      {league}
    </button>
  ))}
</div>
      {/* 🔍 Search bar */}
      <div style={{ margin: "1rem 0" }}>
        <input
          type="text"
          placeholder="Search team..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "0.5rem 1rem",
            width: "100%",
            maxWidth: "400px",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />
      </div>

      {/* Games grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1rem",
        }}
      >
        {filteredGames.map((game) => (
          <div
            key={game.id}
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "1rem",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                alignItems: "center",
              }}
            >
              <div>
                <img
                  src={game.teams.home.logo}
                  alt={game.teams.home.name}
                  style={{ width: "60px", height: "60px" }}
                />
                <p>{game.teams.home.name}</p>
              </div>

              <div>
                <h3>
                  {game.scores.home.total ?? 0} :{" "}
                  {game.scores.away.total ?? 0}
                </h3>
              </div>

              <div>
                <img
                  src={game.teams.away.logo}
                  alt={game.teams.away.name}
                  style={{ width: "60px", height: "60px" }}
                />
                <p>{game.teams.away.name}</p>
              </div>
            </div>

            <p style={{ fontSize: "0.9rem", color: "#666" }}>
              {game.league.name}
            </p>
            <p style={{ fontSize: "0.9rem", color: "#888" }}>
              Status: {game.status.long}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
