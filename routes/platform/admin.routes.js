const express = require("express");
const { requirePlatformUser, requireAdmin } = require("../../middleware/platformAuth");
const {
  listUsers,
  getUserDetails,
  upsertPricing,
  getRevenueStats,
} = require("../../services/platform/admin.service");
const { getGlobalUsageStats } = require("../../services/platform/usage.service");
const { getSupabase } = require("../../services/supabase/client");

function buildAdminRouter() {
  const router = express.Router();
  router.use(requirePlatformUser(), requireAdmin());

  router.get("/users", async (req, res) => {
    try {
      const users = await listUsers({ limit: req.query.limit });
      res.json({ ok: true, users });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/users/:id", async (req, res) => {
    try {
      const details = await getUserDetails(req.params.id);
      res.json({ ok: true, ...details });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  router.get("/usage", async (req, res) => {
    try {
      const stats = await getGlobalUsageStats({
        startDate: req.query.start_date,
        endDate: req.query.end_date,
      });
      res.json({ ok: true, stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/pricing", async (req, res) => {
    try {
      const row = await upsertPricing({
        endpoint: req.body?.endpoint || "default",
        costPerToken: req.body?.cost_per_token ?? req.body?.costPerToken,
        costPerRequest: req.body?.cost_per_request ?? req.body?.costPerRequest,
      });
      res.json({ ok: true, pricing: row });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/pricing", async (_req, res) => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from("pricing").select("*").order("endpoint");
      if (error) throw new Error(error.message);
      res.json({ ok: true, pricing: data || [] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/revenue", async (_req, res) => {
    try {
      const revenue = await getRevenueStats();
      res.json({ ok: true, revenue });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = buildAdminRouter;
