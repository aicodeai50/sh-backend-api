const express = require("express");
const { requirePlatformUser } = require("../../middleware/platformAuth");
const {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
} = require("../../services/platform/apiKeys.service");

function buildKeysRouter() {
  const router = express.Router();
  router.use(requirePlatformUser());

  router.post("/", async (req, res) => {
    try {
      const created = await createApiKey({
        userId: req.platformUser.id,
        name: req.body?.name,
        rateLimit: req.body?.rate_limit ?? req.body?.rateLimit,
        expiresAt: req.body?.expires_at ?? req.body?.expiresAt ?? null,
      });

      res.status(201).json({
        ok: true,
        key: created.key,
        id: created.id,
        name: created.name,
        key_preview: created.key_preview,
        created_at: created.created_at,
        expires_at: created.expires_at,
        rate_limit: created.rate_limit,
        warning: "Store this key securely. It will not be shown again.",
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/", async (req, res) => {
    try {
      const keys = await listApiKeys(req.platformUser.id);
      res.json({ ok: true, keys });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const updated = await updateApiKey({
        userId: req.platformUser.id,
        keyId: req.params.id,
        name: req.body?.name,
        rateLimit: req.body?.rate_limit ?? req.body?.rateLimit,
        expiresAt: req.body?.expires_at ?? req.body?.expiresAt,
        isActive: req.body?.is_active ?? req.body?.isActive,
      });
      res.json({ ok: true, key: updated });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await revokeApiKey({ userId: req.platformUser.id, keyId: req.params.id });
      res.json({ ok: true, revoked: req.params.id });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  return router;
}

module.exports = buildKeysRouter;
