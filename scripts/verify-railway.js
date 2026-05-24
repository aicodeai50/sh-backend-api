const { request } = require("./http-client");
const { loadProjectEnv } = require("./env-utils");

const env = loadProjectEnv();
const KEY = (env.SH_API_KEY || process.env.SH_API_KEY || "").trim();
const BASE =
  process.env.API_BASE || "https://sh-backend-api-production.up.railway.app";

(async () => {
  const health = await request("GET", BASE, "/health", { apiKey: KEY });
  const platform = await request("GET", BASE, "/api/v1/platform/health", { apiKey: KEY });
  const manifest = await request("GET", BASE, "/api/v1/platform/manifest", { apiKey: KEY });

  console.log(
    JSON.stringify(
      {
        url: BASE,
        health: {
          status: health.status,
          ok: health.body?.ok,
          build: health.body?.build,
        },
        platform: {
          status: platform.status,
          ok: platform.body?.ok,
          sql: platform.body?.databases?.sql,
          storage: platform.body?.storage,
        },
        manifest: {
          status: manifest.status,
          version: manifest.body?.version,
          cacheBackend: manifest.body?.storage?.cache?.backend,
          docsBackend: manifest.body?.storage?.documents?.backend,
          filesBackend: manifest.body?.storage?.files?.backend,
        },
        configured: platform.body?.configured,
        uploadsDir: platform.body?.storage?.uploadsDir,
      },
      null,
      2
    )
  );
})();
