const { getDatabaseHealth } = require("./index");
const { getCacheBackend, getCacheStats } = require("../storage/cache.store");
const { getDocumentBackend } = require("../storage/document.store");
const { getFileBackend } = require("../storage/file.store");
const { getMongoConfig } = require("./mongodb");
const { getRedisConfig } = require("./redis");
const { getSqlConfig } = require("../../config/database.config");
const { getStorageConfig } = require("../../config/platform.config");

async function getPlatformStatus(sequelize) {
  const databases = await getDatabaseHealth(sequelize);
  const storage = getStorageConfig();

  return {
    ok: true,
    databases,
    storage: {
      cache: getCacheBackend(),
      documents: getDocumentBackend(),
      files: getFileBackend(),
      cacheStats: getCacheStats(),
      memoryFallback: storage.memoryFallback,
      uploadsDir: storage.uploadsDir,
    },
    configured: {
      sql: getSqlConfig().dialect,
      mongodb: getMongoConfig().enabled,
      redis: getRedisConfig().enabled,
    },
  };
}

module.exports = { getPlatformStatus };
