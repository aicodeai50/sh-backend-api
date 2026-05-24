const express = require("express");
const buildApiV1Router = require("../api/v1");
const {
  getCache,
  setCache,
  deleteCache,
  getCacheBackend,
} = require("../../services/storage/cache.store");
const {
  listDocuments,
  getDocument,
  createDocument,
  deleteDocument,
  getDocumentBackend,
} = require("../../services/storage/document.store");
const { getPlatformStatus } = require("../../services/database/platform.status");

function buildDataRouter({ sequelize, buildTag = "local" }) {
  const router = express.Router();

  router.use("/v1", buildApiV1Router({ sequelize, buildTag }));

  router.get("/health", async (_req, res) => {
    try {
      const status = await getPlatformStatus(sequelize);
      res.json({ ...status, build: buildTag });
    } catch (err) {
      res.status(500).json({
        error: "Database health check failed",
        details: err?.message || String(err),
      });
    }
  });

  router.get("/cache/:key(*)", async (req, res) => {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ error: "Missing cache key" });

    const value = await getCache(key);
    if (value == null) return res.status(404).json({ error: "Cache miss" });
    return res.json({ ok: true, key, value, backend: getCacheBackend() });
  });

  router.post("/cache/:key(*)", async (req, res) => {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ error: "Missing cache key" });

    const ttlSeconds = req.body?.ttlSeconds;
    const value = Object.prototype.hasOwnProperty.call(req.body || {}, "value")
      ? req.body.value
      : req.body;

    await setCache(key, value, ttlSeconds);
    return res.json({ ok: true, key, backend: getCacheBackend() });
  });

  router.delete("/cache/:key(*)", async (req, res) => {
    const key = String(req.params.key || "").trim();
    if (!key) return res.status(400).json({ error: "Missing cache key" });

    await deleteCache(key);
    return res.json({ ok: true, key, backend: getCacheBackend() });
  });

  router.get("/docs/:collection", async (req, res) => {
    const collection = String(req.params.collection || "").trim();
    if (!collection) return res.status(400).json({ error: "Missing collection" });

    const result = await listDocuments(collection, { limit: req.query.limit });
    return res.json({
      ok: true,
      collection,
      backend: result.backend,
      count: result.docs.length,
      docs: result.docs,
    });
  });

  router.get("/docs/:collection/:id", async (req, res) => {
    const collection = String(req.params.collection || "").trim();
    const id = String(req.params.id || "").trim();
    if (!collection || !id) {
      return res.status(400).json({ error: "Missing collection or id" });
    }

    const result = await getDocument(collection, id);
    if (!result) return res.status(404).json({ error: "Document not found" });
    return res.json({ ok: true, backend: result.backend, doc: result.doc });
  });

  router.post("/docs/:collection", async (req, res) => {
    const collection = String(req.params.collection || "").trim();
    if (!collection) return res.status(400).json({ error: "Missing collection" });

    const payload = req.body?.doc ?? req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }

    const result = await createDocument(collection, payload, req.user?.id || null);
    return res.status(201).json({
      ok: true,
      backend: result.backend,
      id: result.id,
    });
  });

  router.delete("/docs/:collection/:id", async (req, res) => {
    const collection = String(req.params.collection || "").trim();
    const id = String(req.params.id || "").trim();
    if (!collection || !id) {
      return res.status(400).json({ error: "Missing collection or id" });
    }

    const deleted = await deleteDocument(collection, id);
    if (!deleted) return res.status(404).json({ error: "Document not found" });

    return res.json({ ok: true, deleted: true, backend: getDocumentBackend() });
  });

  return router;
}

module.exports = buildDataRouter;
