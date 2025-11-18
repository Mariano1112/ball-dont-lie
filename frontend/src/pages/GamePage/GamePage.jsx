import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import styles from "./GamePage.module.css";

export default function GamePage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);

  useEffect(() => {
    (async () => {
      const g = await getGameById(id);
      setGame(g);
    })();
  }, [id]);

  if (!game) return <p>Loading...</p>;

  const home = game.teams.home;
  const away = game.teams.visitors;

  return (
    <div className={styles.page}>
      <h1>{home.name} vs {away.name}</h1>

      <div className={styles.block}>
        <img src={home.logo} />
        <span className={styles.score}>
          {game.scores.home.points} - {game.scores.visitors.points}
        </span>
        <img src={away.logo} />
      </div>

      <p>Status: {game.status.long}</p>
      <p>Date: {game.date.start}</p>
    </div>
  );
}
