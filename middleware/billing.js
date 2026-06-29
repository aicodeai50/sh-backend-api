const { getBillingConfig } = require("../config/billing.config");
const { getUserBalance } = require("../services/platform/billing.service");

function checkBalance() {
  return async (req, res, next) => {
    if (!getBillingConfig().enabled) return next();
    if (req.legacyMasterKey) return next();
    if (!req.platformUser?.id) {
      return res.status(401).json({ error: "Authenticated user required for billing" });
    }

    try {
      const { balance } = await getUserBalance(req.platformUser.id);
      req.platformUser.balance = Number(balance);

      const minCost =
        Number(getBillingConfig().costPerRequest) +
        Number(getBillingConfig().costPerToken);

      if (Number(balance) < minCost) {
        return res.status(402).json({
          error: "Insufficient balance",
          balance: Number(balance),
          required_minimum: minCost,
        });
      }

      next();
    } catch (err) {
      res.status(500).json({ error: "Balance check failed", details: err.message });
    }
  };
}

module.exports = { checkBalance };
