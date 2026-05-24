const express = require("express");
const {
  getCache,
  setCache,
  deleteCache,
  getCacheBackend,
} = require("../../../services/storage/cache.store");

function buildCacheRouter() {
  const router = express.Router();

  router.get("/:key(*)", async (req, res) => {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ error: "Missing cache key" });

    const value = await getCache(key);
    if (value == null) {
      return res.status(404).json({
        error: "Cache miss",
        backend: getCacheBackend(),
      });
    }

    return res.json({ ok: true, key, value, backend: getCacheBackend() });
  });

  router.post("/:key(*)", async (req, res) => {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ error: "Missing cache key" });

    const ttlSeconds = req.body?.ttlSeconds;
    const value = Object.prototype.hasOwnProperty.call(req.body || {}, "value")
      ? req.body.value
      : req.body;

    await setCache(key, value, ttlSeconds);
    return res.json({ ok: true, key, backend: getCacheBackend() });
  });

  router.delete("/:key(*)", async (req, res) => {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ error: "Missing cache key" });

    await deleteCache(key);
    return res.json({ ok: true, key, backend: getCacheBackend() });
  });

  return router;
}

module.exports = buildCacheRouter;
