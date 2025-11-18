// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  // load .env, .env.local, etc. for this mode
  const env = loadEnv(mode, process.cwd(), ""); // no prefix filter

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/nba": {
          target: "https://v2.nba.api-sports.io",
          changeOrigin: true,
          secure: true,
          headers: {
            // ✅ now actually populated
            "x-apisports-key": env.NBA_API_KEY || env.VITE_NBA_API_KEY || "",
            Accept: "application/json",
          },
          rewrite: (p) => p.replace(/^\/nba/, ""),
          // Optional: quick sanity logging while debugging
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              // comment out after you confirm it’s true
              console.log(
                "[proxy] →",
                proxyReq.getHeader("host"),
                proxyReq.path,
                "key?",
                !!proxyReq.getHeader("x-apisports-key")
              );
            });
          },
        },
      },
    },
  };
});


