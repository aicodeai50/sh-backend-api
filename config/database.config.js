const path = require("path");

const SUPPORTED_SQL_DIALECTS = ["sqlite", "postgres", "mysql", "mariadb", "mssql"];

function envFlag(name, defaultValue = false) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parseDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    const dialect = parsed.protocol.replace(":", "").replace("postgres", "postgres");
    const map = {
      postgres: "postgres",
      postgresql: "postgres",
      mysql: "mysql",
      mariadb: "mariadb",
      mssql: "mssql",
      sqlserver: "mssql",
      sqlite: "sqlite",
    };

    const normalized = map[dialect] || dialect;
    if (normalized === "sqlite") {
      const storage = decodeURIComponent(parsed.pathname || "").replace(/^\//, "");
      return { dialect: "sqlite", storage: storage || "database.sqlite" };
    }

    return {
      dialect: normalized,
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : undefined,
      database: decodeURIComponent((parsed.pathname || "").replace(/^\//, "")),
      username: decodeURIComponent(parsed.username || ""),
      password: decodeURIComponent(parsed.password || ""),
    };
  } catch {
    return null;
  }
}

function getSqlConfig() {
  const fromUrl = process.env.DATABASE_URL
    ? parseDatabaseUrl(process.env.DATABASE_URL)
    : null;

  const dialect = String(
    fromUrl?.dialect || process.env.DB_DIALECT || "sqlite"
  )
    .trim()
    .toLowerCase();

  if (!SUPPORTED_SQL_DIALECTS.includes(dialect)) {
    throw new Error(
      `Unsupported DB_DIALECT "${dialect}". Use: ${SUPPORTED_SQL_DIALECTS.join(", ")}`
    );
  }

  if (dialect === "sqlite") {
    return {
      dialect: "sqlite",
      storage:
        fromUrl?.storage ||
        process.env.DB_STORAGE ||
        path.resolve(process.cwd(), "database.sqlite"),
      logging: envFlag("DB_LOGGING", false),
    };
  }

  return {
    dialect,
    host: fromUrl?.host || process.env.DB_HOST || "localhost",
    port: fromUrl?.port || (process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined),
    database: fromUrl?.database || process.env.DB_NAME || "shynvo",
    username: fromUrl?.username || process.env.DB_USER || "",
    password: fromUrl?.password || process.env.DB_PASSWORD || "",
    logging: envFlag("DB_LOGGING", false),
    dialectOptions:
      dialect === "mssql"
        ? {
            options: {
              encrypt: envFlag("DB_ENCRYPT", true),
              trustServerCertificate: envFlag("DB_TRUST_SERVER_CERT", false),
            },
          }
        : dialect === "postgres" && envFlag("DB_SSL", false)
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : undefined,
    pool: {
      max: Number(process.env.DB_POOL_MAX || 10),
      min: Number(process.env.DB_POOL_MIN || 0),
      acquire: Number(process.env.DB_POOL_ACQUIRE_MS || 30000),
      idle: Number(process.env.DB_POOL_IDLE_MS || 10000),
    },
  };
}

function getMongoConfig() {
  const uri = String(process.env.MONGODB_URI || "").trim();
  const enabled = envFlag("MONGODB_ENABLED", Boolean(uri));
  const dbName = String(process.env.MONGODB_DB || "shynvo").trim();

  return { enabled: enabled && Boolean(uri), uri, dbName };
}

function getRedisConfig() {
  const url = String(process.env.REDIS_URL || "").trim();
  const enabled = envFlag("REDIS_ENABLED", Boolean(url));

  return {
    enabled: enabled && Boolean(url),
    url,
    keyPrefix: String(process.env.REDIS_KEY_PREFIX || "sh:").trim(),
    defaultTtlSeconds: Number(process.env.REDIS_DEFAULT_TTL_SECONDS || 3600),
  };
}

module.exports = {
  SUPPORTED_SQL_DIALECTS,
  getSqlConfig,
  getMongoConfig,
  getRedisConfig,
};
