const jwt = require("jsonwebtoken");
const { verifyPlatformToken, getUserById } = require("../services/platform/auth.service");
const { extractBearerToken } = require("../services/platform/tokens");
const { getBillingConfig } = require("../config/billing.config");

const JWT_SECRET = () => String(process.env.JWT_SECRET || "").trim();

function requirePlatformUser() {
  return async (req, res, next) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ error: "Missing Bearer token" });
      }

      if (token.startsWith("sk_live_")) {
        return res.status(401).json({
          error: "Use dashboard JWT for this endpoint, not an API key",
        });
      }

      let userId = null;
      const platformPayload = verifyPlatformToken(token);
      if (platformPayload?.userId) {
        userId = platformPayload.userId;
      } else if (JWT_SECRET()) {
        try {
          const legacy = jwt.verify(token, JWT_SECRET());
          userId = legacy?.userId;
        } catch {
          /* fall through */
        }
      }

      if (!userId) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const user = await getUserById(userId);
      if (!user || !user.is_active) {
        return res.status(403).json({ error: "User inactive" });
      }

      req.platformUser = user;
      next();
    } catch (err) {
      res.status(500).json({ error: "Auth failed", details: err.message });
    }
  };
}

function requireAdmin() {
  return (req, res, next) => {
    const user = req.platformUser;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { adminUserIds } = getBillingConfig();
    const isAdmin = user.is_admin || adminUserIds.includes(user.id);

    if (!isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  };
}

module.exports = { requirePlatformUser, requireAdmin };
