const { findApiKeyByPlainKey, touchApiKeyLastUsed } = require("../services/platform/apiKeys.service");
const { getUserById } = require("../services/platform/auth.service");
const { extractBearerToken } = require("../services/platform/tokens");
const { getBillingConfig } = require("../config/billing.config");

const SH_API_KEY = () => String(process.env.SH_API_KEY || "").trim();

async function requireApiKey(req, res, next) {
  try {
    const token =
      extractBearerToken(req) ||
      String(req.headers["x-api-key"] || req.headers["x-sh-api-key"] || "").trim();

    if (!token) {
      return res.status(401).json({ error: "Missing API key. Use Authorization: Bearer sk_live_..." });
    }

    if (token.startsWith("sk_live_")) {
      const record = await findApiKeyByPlainKey(token);
      if (!record) {
        return res.status(401).json({ error: "Invalid or expired API key" });
      }

      const user = await getUserById(record.user_id);
      if (!user || !user.is_active) {
        return res.status(403).json({ error: "User account inactive" });
      }

      req.apiKey = record;
      req.platformUser = user;
      touchApiKeyLastUsed(record.id).catch(() => {});
      return next();
    }

    if (getBillingConfig().legacyShKeyEnabled && SH_API_KEY() && token === SH_API_KEY()) {
      req.legacyMasterKey = true;
      return next();
    }

    return res.status(401).json({ error: "Invalid API key" });
  } catch (err) {
    return res.status(500).json({ error: "API key validation failed", details: err.message });
  }
}

module.exports = { requireApiKey };
