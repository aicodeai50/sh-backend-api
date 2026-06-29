const express = require("express");
const { isSupabaseConfigured } = require("../../services/supabase/client");
const { createUser, loginUser } = require("../../services/platform/auth.service");
const { requirePlatformUser } = require("../../middleware/platformAuth");

function buildPlatformAuthRouter() {
  const router = express.Router();

  router.use((req, res, next) => {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        error: "Platform auth unavailable",
        message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      });
    }
    next();
  });

  router.post("/signup", async (req, res) => {
    try {
      const user = await createUser({
        email: req.body?.email,
        password: req.body?.password,
        name: req.body?.name,
      });

      res.status(201).json({
        ok: true,
        user_id: user.id,
        email: user.email,
        name: user.name,
        balance: Number(user.balance),
      });
    } catch (err) {
      const status = err.message.includes("already") ? 409 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const result = await loginUser({
        email: req.body?.email,
        password: req.body?.password,
      });

      res.json({
        ok: true,
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          balance: Number(result.user.balance),
        },
      });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  router.get("/me", requirePlatformUser(), async (req, res) => {
    res.json({ ok: true, user: req.platformUser });
  });

  return router;
}

module.exports = buildPlatformAuthRouter;
