const path = require("path");

function envFlag(name, defaultValue = false) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function getCorsConfig() {
  const allowAll = envFlag("CORS_ALLOW_ALL", false);
  const raw = String(process.env.FRONTEND_ORIGIN || "http://localhost:3000");
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    allowAll,
    origins: allowAll ? ["*"] : origins,
  };
}

function getStorageConfig() {
  return {
    uploadsDir: path.resolve(
      process.cwd(),
      String(process.env.UPLOADS_DIR || "uploads").trim()
    ),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
    memoryFallback: envFlag("STORAGE_MEMORY_FALLBACK", true),
  };
}

function getGenericSqlTables() {
  const raw = String(process.env.GENERIC_SQL_TABLES || "GenericRecord").trim();
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  getCorsConfig,
  getStorageConfig,
  getGenericSqlTables,
  envFlag,
};
