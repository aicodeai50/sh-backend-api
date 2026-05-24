require("dotenv").config();
const http = require("http");

const PORT = process.env.PORT || 8080;
const KEY = (process.env.SH_API_KEY || "").trim();

function request(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path,
        method,
        headers: {
          "x-sh-api-key": KEY,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const checks = {};

  checks.env = {
    port: PORT,
    hasShApiKey: Boolean(KEY),
    hasJwtSecret: Boolean((process.env.JWT_SECRET || "").trim()),
    hasOpenAiKey: Boolean((process.env.OPENAI_API_KEY || "").trim()),
    dbDialect: process.env.DB_DIALECT || "sqlite",
    mongodbConfigured: Boolean((process.env.MONGODB_URI || "").trim()),
    redisConfigured: Boolean((process.env.REDIS_URL || "").trim()),
  };

  try {
    checks.health = await request("/health");
  } catch (e) {
    checks.health = { error: e.message };
  }

  try {
    checks.platform = await request("/api/v1/platform/health");
  } catch (e) {
    checks.platform = { error: e.message };
  }

  try {
    checks.manifest = await request("/api/v1/platform/manifest");
  } catch (e) {
    checks.manifest = { error: e.message };
  }

  try {
    checks.authMe = await request("/auth/me");
  } catch (e) {
    checks.authMe = { error: e.message };
  }

  console.log(JSON.stringify(checks, null, 2));
})();
