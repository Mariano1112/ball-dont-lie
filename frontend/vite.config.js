// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/nba": {
          target: "https://v2.nba.api-sports.io",
          changeOrigin: true,
          secure: true,
          headers: {
            "x-apisports-key": env.NBA_API_KEY || env.VITE_NBA_API_KEY || "",
            "x-rapidapi-host": "v2.nba.api-sports.io",   // ← ДОБАВЬ ЭТО
            Accept: "application/json",
          },
          rewrite: (p) => p.replace(/^\/nba/, ""),
        },
      },
    },
  };
});



