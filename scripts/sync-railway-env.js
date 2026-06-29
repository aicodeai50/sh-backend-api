const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ENV_PATH = path.resolve(__dirname, "..", ".env");
const KEYS = [
  "SH_API_KEY",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "FRONTEND_ORIGIN",
  "COOKIE_NAME",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ADMIN_USER_IDS",
];

/** Non-secret platform toggles (safe defaults; never commit real secrets) */
const RAILWAY_BILLING_DEFAULTS = {
  ENABLE_BILLING: "true",
  SH_COST_PER_TOKEN: "0.0001",
  SH_COST_PER_REQUEST: "0.001",
  SIGNUP_BONUS_BALANCE: "10",
  PRIVATE_API_ONLY: "true",
  ENABLE_LEGACY_SH_KEY: "true",
  BILLING_CURRENCY: "usd",
};

/** Railway service references (set once per project; not read from local .env) */
const RAILWAY_PLATFORM_VARS = {
  DATABASE_URL: "${{Postgres.DATABASE_URL}}",
  DB_DIALECT: "postgres",
  REDIS_URL: "${{Redis.REDIS_URL}}",
  REDIS_ENABLED: "true",
  MONGODB_URI: "${{MongoDB.MONGO_URL}}",
  MONGODB_ENABLED: "true",
  MONGODB_DB: "shynvo",
  UPLOADS_DIR: "/app/uploads",
  GENERIC_SQL_TABLES: "GenericRecord",
  STORAGE_MEMORY_FALLBACK: "true",
  MAX_UPLOAD_BYTES: "10485760",
  REDIS_KEY_PREFIX: "sh:",
  REDIS_DEFAULT_TTL_SECONDS: "3600",
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function setVar(key, value) {
  const result = spawnSync(
    "railway",
    [
      "variable",
      "set",
      `${key}=${value}`,
      "--service",
      "sh-backend-api",
      "--skip-deploys",
    ],
    { encoding: "utf8", shell: true }
  );

  if (result.error || result.status !== 0) {
    const err = result.stderr || result.stdout || result.error?.message || "unknown";
    throw new Error(`Failed to set ${key}: ${String(err).trim()}`);
  }
}

const local = parseEnvFile(ENV_PATH);
let count = 0;

setVar("NODE_ENV", "production");
count++;

for (const key of KEYS) {
  let value = local[key];
  if (key === "FRONTEND_ORIGIN" && !value) {
    value =
      "http://localhost:3000,https://shynvo-web.vercel.app,https://shynvo.app";
  }
  if (!value) continue;
  setVar(key, value);
  count++;
}

for (const [key, value] of Object.entries(RAILWAY_PLATFORM_VARS)) {
  setVar(key, value);
  count++;
}

for (const [key, value] of Object.entries(RAILWAY_BILLING_DEFAULTS)) {
  setVar(key, value);
  count++;
}

console.log(`Synced ${count} variables to Railway (secrets read from local .env only, never committed).`);
