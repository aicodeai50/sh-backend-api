const Redis = require("ioredis");
const { getRedisConfig } = require("../../config/database.config");

let client = null;

function getRedisClient() {
  const config = getRedisConfig();
  if (!config.enabled) return null;

  if (!client) {
    client = new Redis(config.url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    client.on("error", (err) => {
      console.error("Redis error:", err?.message || err);
    });
  }

  return client;
}

async function connectRedis() {
  const config = getRedisConfig();
  if (!config.enabled) {
    return { enabled: false, client: null };
  }

  const redis = getRedisClient();
  if (redis.status === "wait") {
    await redis.connect();
  }

  return { enabled: true, client: redis };
}

async function pingRedis() {
  const config = getRedisConfig();
  if (!config.enabled) {
    return { enabled: false, ok: false, message: "Redis not configured" };
  }

  try {
    const redis = getRedisClient();
    if (redis.status === "wait") await redis.connect();
    const pong = await redis.ping();
    return { enabled: true, ok: pong === "PONG" };
  } catch (err) {
    return {
      enabled: true,
      ok: false,
      error: err?.message || String(err),
    };
  }
}

function prefixKey(key) {
  const { keyPrefix } = getRedisConfig();
  return `${keyPrefix}${key}`;
}

async function cacheGet(key) {
  const redis = getRedisClient();
  if (!redis) return null;
  if (redis.status === "wait") await redis.connect();
  const raw = await redis.get(prefixKey(key));
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function cacheSet(key, value, ttlSeconds) {
  const redis = getRedisClient();
  if (!redis) return false;
  if (redis.status === "wait") await redis.connect();

  const config = getRedisConfig();
  const payload =
    typeof value === "string" ? value : JSON.stringify(value ?? null);
  const ttl = Number(ttlSeconds || config.defaultTtlSeconds);

  if (Number.isFinite(ttl) && ttl > 0) {
    await redis.set(prefixKey(key), payload, "EX", ttl);
  } else {
    await redis.set(prefixKey(key), payload);
  }

  return true;
}

async function cacheDel(key) {
  const redis = getRedisClient();
  if (!redis) return false;
  if (redis.status === "wait") await redis.connect();
  await redis.del(prefixKey(key));
  return true;
}

async function closeRedis() {
  if (client) {
    await client.quit();
  }
  client = null;
}

module.exports = {
  connectRedis,
  pingRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  closeRedis,
  getRedisConfig,
};
