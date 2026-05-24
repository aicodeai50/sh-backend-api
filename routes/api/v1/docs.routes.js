const express = require("express");
const {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  getDocumentBackend,
} = require("../../../services/storage/document.store");

function buildDocsRouter() {
  const router = express.Router();

  router.get("/:collection", async (req, res) => {
    const collection = String(req.params.collection || "").trim();
    if (!collection) return res.status(400).json({ error: "Missing collection" });

    const limit = req.query.limit;
    const result = await listDocuments(collection, { limit });
    return res.json({
      ok: true,
      collection,
      backend: result.backend,
      count: result.docs.length,
      docs: result.docs,
    });
  });

  router.get("/:collection/:id", async (req, res) => {
    const collection = String(req.params.collection || "").trim();
    const id = String(req.params.id || "").trim();
    if (!collection || !id) {
      return res.status(400).json({ error: "Missing collection or id" });
    }

    const result = await getDocument(collection, id);
    if (!result) return res.status(404).json({ error: "Document not found" });

    return res.json({
      ok: true,
      backend: result.backend,
      doc: result.doc,
    });
  });

  router.post("/:collection", async (req, res) => {
    const collection = String(req.params.collection || "").trim();
    if (!collection) return res.status(400).json({ error: "Missing collection" });

    const payload = req.body?.doc ?? req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }

    const ownerUserId = req.user?.id || null;
    const result = await createDocument(collection, payload, ownerUserId);

    return res.status(201).json({
      ok: true,
      backend: result.backend,
      id: result.id,
    });
  });

  router.patch("/:collection/:id", async (req, res) => {
    const collection = String(req.params.collection || "").trim();
    const id = String(req.params.id || "").trim();
    if (!collection || !id) {
      return res.status(400).json({ error: "Missing collection or id" });
    }

    const payload = req.body?.doc ?? req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }

    const result = await updateDocument(collection, id, payload);
    if (!result) return res.status(404).json({ error: "Document not found" });

    return res.json({
      ok: true,
      backend: result.backend,
      id: result.id,
    });
  });

  router.delete("/:collection/:id", async (req, res) => {
    const collection = String(req.params.collection || "").trim();
    const id = String(req.params.id || "").trim();
    if (!collection || !id) {
      return res.status(400).json({ error: "Missing collection or id" });
    }

    const deleted = await deleteDocument(collection, id);
    if (!deleted) return res.status(404).json({ error: "Document not found" });

    return res.json({
      ok: true,
      deleted: true,
      backend: getDocumentBackend(),
    });
  });

  return router;
}

module.exports = buildDocsRouter;
