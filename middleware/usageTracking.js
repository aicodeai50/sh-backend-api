const { getBillingConfig } = require("../config/billing.config");
const { getPricing, calculateCost, deductBalance } = require("../services/platform/billing.service");
const { logUsage } = require("../services/platform/usage.service");
const { estimateTokens } = require("../services/platform/tokens");

function attachUsageTracker() {
  return (req, res, next) => {
    req.usageTracker = {
      tokensInput: 0,
      tokensOutput: 0,
      startedAt: Date.now(),
      setInput(text) {
        this.tokensInput = estimateTokens(text);
      },
      setOutput(text) {
        this.tokensOutput = estimateTokens(text);
      },
      setFromOpenAI(usage) {
        if (!usage) return;
        this.tokensInput = Number(usage.prompt_tokens || 0);
        this.tokensOutput = Number(usage.completion_tokens || 0);
      },
    };

    const originalJson = res.json.bind(res);

    res.json = (body) => {
      finalizeUsage(req, res, body).catch((err) => {
        console.error("usage_tracking_error:", err.message);
      });
      return originalJson(body);
    };

    next();
  };
}

async function finalizeUsage(req, res, body) {
  if (!getBillingConfig().enabled || req.legacyMasterKey) return;
  if (!req.platformUser?.id) return;
  if (res.statusCode >= 500) return;

  const tracker = req.usageTracker || {};
  const tokensInput = Number(tracker.tokensInput || 0);
  const tokensOutput = Number(tracker.tokensOutput || 0);
  const tokensTotal = tokensInput + tokensOutput;

  const pricing = await getPricing(req.path);
  const cost = calculateCost({ pricing, tokensInput, tokensOutput, tokensTotal });

  let usageRow = null;
  try {
    usageRow = await logUsage({
      userId: req.platformUser.id,
      apiKeyId: req.apiKey?.id,
      endpoint: req.path,
      method: req.method,
      tokensInput,
      tokensOutput,
      tokensTotal,
      cost,
      responseTimeMs: Date.now() - (tracker.startedAt || Date.now()),
      statusCode: res.statusCode,
    });
  } catch (err) {
    console.error("log_usage_failed:", err.message);
  }

  if (cost > 0) {
    try {
      const result = await deductBalance({
        userId: req.platformUser.id,
        cost,
        description: `${req.method} ${req.path}`,
        referenceId: usageRow?.id,
      });
      if (body && typeof body === "object") {
        body.tokens_used = tokensTotal;
        body.cost = cost;
        body.balance_remaining = result.balance;
      }
    } catch (err) {
      if (err.code === "INSUFFICIENT_BALANCE") {
        console.warn("insufficient_balance_after_request:", req.platformUser.id);
      }
    }
  } else if (body && typeof body === "object") {
    body.tokens_used = tokensTotal;
    body.cost = 0;
    body.balance_remaining = req.platformUser.balance;
  }
}

module.exports = { attachUsageTracker };
