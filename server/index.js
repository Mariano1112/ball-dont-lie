import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ROUTE
app.get("/api/live", async (req, res) => {
  try {
    const date = req.query.date || "2025-11-12";

    const response = await axios.get(
      `https://v1.basketball.api-sports.io/games?date=${date}`,
      {
        headers: {
          "x-apisports-key": process.env.API_KEY,
          "x-apisports-host": "v1.basketball.api-sports.io",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching games:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

app.listen(4000, () => {
  console.log("🔥 Server running at http://localhost:4000");
});
