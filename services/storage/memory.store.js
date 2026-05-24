const crypto = require("crypto");

const store = new Map();
const expirations = new Map();

function nowMs() {
  return Date.now();
}

function scheduleExpiry(key, ttlSeconds) {
  const ttl = Number(ttlSeconds);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    expirations.delete(key);
    return;
  }

  const expiresAt = nowMs() + ttl * 1000;
  expirations.set(key, expiresAt);
}

function purgeExpired(key) {
  const expiresAt = expirations.get(key);
  if (expiresAt && expiresAt <= nowMs()) {
    store.delete(key);
    expirations.delete(key);
    return true;
  }
  return false;
}

function memoryGet(key) {
  purgeExpired(key);
  if (!store.has(key)) return null;
  const raw = store.get(key);
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function memorySet(key, value, ttlSeconds) {
  const payload =
    typeof value === "string" ? value : JSON.stringify(value ?? null);
  store.set(key, payload);
  scheduleExpiry(key, ttlSeconds);
  return true;
}

function memoryDel(key) {
  store.delete(key);
  expirations.delete(key);
  return true;
}

function memoryStats() {
  return { keys: store.size };
}

function makeRecordId() {
  return `rec_${crypto.randomBytes(8).toString("hex")}`;
}

module.exports = {
  memoryGet,
  memorySet,
  memoryDel,
  memoryStats,
  makeRecordId,
};
