function envFlag(name, defaultValue = false) {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function getBillingConfig() {
  return {
    enabled: envFlag("ENABLE_BILLING", true),
    costPerToken: Number(process.env.SH_COST_PER_TOKEN || 0.0001),
    costPerRequest: Number(process.env.SH_COST_PER_REQUEST || 0.001),
    signupBonusBalance: Number(process.env.SIGNUP_BONUS_BALANCE || 10),
    currency: String(process.env.BILLING_CURRENCY || "usd").toLowerCase(),
    stripeSecretKey: String(process.env.STRIPE_SECRET_KEY || "").trim(),
    stripePublishableKey: String(process.env.STRIPE_PUBLISHABLE_KEY || "").trim(),
    stripeWebhookSecret: String(process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
    privateApiOnly: envFlag("PRIVATE_API_ONLY", false),
    legacyShKeyEnabled: envFlag("ENABLE_LEGACY_SH_KEY", true),
    adminUserIds: String(process.env.ADMIN_USER_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

module.exports = { getBillingConfig, envFlag };
