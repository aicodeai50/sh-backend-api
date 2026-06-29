const { getBillingConfig } = require("../config/billing.config");

/**
 * When PRIVATE_API_ONLY=true, only Railway internal network + health checks are public.
 */
function privateNetworkOnly() {
  return (req, res, next) => {
    if (!getBillingConfig().privateApiOnly) return next();

    if (req.path === "/health" || req.path === "/") return next();

    const host = String(req.headers.host || "").toLowerCase();
    const forwardedHost = String(req.headers["x-forwarded-host"] || "").toLowerCase();

    const isInternal =
      host.includes(".railway.internal") ||
      forwardedHost.includes(".railway.internal") ||
      String(req.headers["x-railway-request-id"] || "").length > 0;

    if (!isInternal) {
      return res.status(403).json({
        error: "Public access disabled",
        message: "This API is private. Use sh-backend-api.railway.internal from your Railway frontend.",
      });
    }

    next();
  };
}

module.exports = { privateNetworkOnly };
