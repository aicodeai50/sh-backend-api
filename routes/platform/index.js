const express = require("express");
const buildPlatformAuthRouter = require("./auth.routes");
const buildKeysRouter = require("./keys.routes");
const buildBillingRouter = require("./billing.routes");
const buildAdminRouter = require("./admin.routes");
const buildGenerateRouter = require("./generate.routes");
const { requireApiKey } = require("../../middleware/apiKeyAuth");
const { checkBalance } = require("../../middleware/billing");
const { attachUsageTracker } = require("../../middleware/usageTracking");
const { apiKeyRateLimit } = require("../../middleware/apiKeyRateLimit");
const { isSupabaseConfigured } = require("../../services/supabase/client");

function buildMonetizedRouter({ openai, model }) {
  const router = express.Router();

  router.get("/docs", (_req, res) => {
    res.json({
      ok: true,
      name: "SH Monetized API",
      version: "1.0.0",
      supabase_configured: isSupabaseConfigured(),
      endpoints: {
        auth: {
          signup: "POST /api/auth/signup",
          login: "POST /api/auth/login",
          me: "GET /api/auth/me",
        },
        keys: {
          create: "POST /api/keys",
          list: "GET /api/keys",
          update: "PATCH /api/keys/:id",
          revoke: "DELETE /api/keys/:id",
        },
        billing: {
          balance: "GET /api/billing/balance",
          usage: "GET /api/billing/usage",
          topup: "POST /api/billing/topup",
          invoice: "GET /api/billing/invoice",
        },
        generate: "POST /api/generate",
        admin: {
          users: "GET /admin/users",
          user: "GET /admin/users/:id",
          usage: "GET /admin/usage",
          pricing: "GET|POST /admin/pricing",
          revenue: "GET /admin/revenue",
        },
      },
      authentication: {
        dashboard: "Authorization: Bearer <JWT from /api/auth/login>",
        api: "Authorization: Bearer sk_live_...",
      },
    });
  });

  router.use("/auth", buildPlatformAuthRouter());
  router.use("/keys", buildKeysRouter());
  router.use("/billing", buildBillingRouter());

  const billable = [
    requireApiKey,
    apiKeyRateLimit(),
    checkBalance(),
    attachUsageTracker(),
  ];

  router.use("/generate", ...billable, buildGenerateRouter({ openai, model }));

  return router;
}

module.exports = buildMonetizedRouter;
