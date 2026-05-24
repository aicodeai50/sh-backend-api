const { getRedisConfig, cacheGet, cacheSet, cacheDel } = require("../database/redis");
const { getStorageConfig } = require("../../config/platform.config");
const { memoryGet, memorySet, memoryDel, memoryStats } = require("./memory.store");

async function getCache(key) {
  if (getRedisConfig().enabled) {
    return cacheGet(key);
  }

  if (getStorageConfig().memoryFallback) {
    return memoryGet(key);
  }

  return null;
}

async function setCache(key, value, ttlSeconds) {
  if (getRedisConfig().enabled) {
    return cacheSet(key, value, ttlSeconds);
  }

  if (getStorageConfig().memoryFallback) {
    return memorySet(key, value, ttlSeconds);
  }

  return false;
}

async function deleteCache(key) {
  if (getRedisConfig().enabled) {
    return cacheDel(key);
  }

  if (getStorageConfig().memoryFallback) {
    return memoryDel(key);
    }

  return false;
}

function getCacheBackend() {
  if (getRedisConfig().enabled) return "redis";
  if (getStorageConfig().memoryFallback) return "memory";
  return "none";
}

function getCacheStats() {
  return {
    backend: getCacheBackend(),
    memory: memoryStats(),
  };
}

module.exports = {
  getCache,
  setCache,
  deleteCache,
  getCacheBackend,
  getCacheStats,
};
