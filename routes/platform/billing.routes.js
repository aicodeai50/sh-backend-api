const express = require("express");
const { requirePlatformUser } = require("../../middleware/platformAuth");
const {
  getUserBalance,
  listTransactions,
  addCredits,
} = require("../../services/platform/billing.service");
const { getUsageSummary } = require("../../services/platform/usage.service");
const {
  isStripeConfigured,
  createTopupPaymentIntent,
  confirmTopupFromPaymentIntent,
} = require("../../services/platform/stripe.service");
const { getBillingConfig } = require("../../config/billing.config");

function buildBillingRouter() {
  const router = express.Router();
  router.use(requirePlatformUser());

  router.get("/balance", async (req, res) => {
    try {
      const data = await getUserBalance(req.platformUser.id);
      res.json({
        ok: true,
        balance: Number(data.balance),
        total_spent: Number(data.total_spent),
        currency: getBillingConfig().currency,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/usage", async (req, res) => {
    try {
      const summary = await getUsageSummary(req.platformUser.id, {
        startDate: req.query.start_date || req.query.startDate,
        endDate: req.query.end_date || req.query.endDate,
      });
      res.json({ ok: true, ...summary });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/transactions", async (req, res) => {
    try {
      const rows = await listTransactions(req.platformUser.id, {
        limit: req.query.limit,
      });
      res.json({ ok: true, transactions: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/topup", async (req, res) => {
    try {
      const amount = Number(req.body?.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      if (isStripeConfigured()) {
        const payment = await createTopupPaymentIntent({
          userId: req.platformUser.id,
          amountUsd: amount,
          email: req.platformUser.email,
        });

        if (req.body?.stripe_payment_intent_id) {
          const credited = await confirmTopupFromPaymentIntent(
            req.body.stripe_payment_intent_id
          );
          return res.json({
            ok: true,
            new_balance: credited.balance,
            transaction_id: credited.transaction_id,
          });
        }

        return res.json({
          ok: true,
          stripe: true,
          client_secret: payment.client_secret,
          payment_intent_id: payment.payment_intent_id,
          amount: payment.amount,
          publishable_key: getBillingConfig().stripePublishableKey || undefined,
        });
      }

      const credited = await addCredits({
        userId: req.platformUser.id,
        amount,
        description: "Manual top-up (Stripe not configured)",
      });

      res.json({
        ok: true,
        new_balance: credited.balance,
        transaction_id: credited.transaction_id,
        note: "Stripe not configured — credits added directly (dev only)",
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/invoice", async (req, res) => {
    try {
      const summary = await getUsageSummary(req.platformUser.id, {
        startDate: req.query.start_date,
        endDate: req.query.end_date,
      });
      const balance = await getUserBalance(req.platformUser.id);

      res.json({
        ok: true,
        invoice: {
          user_id: req.platformUser.id,
          email: req.platformUser.email,
          period: {
            start: req.query.start_date || null,
            end: req.query.end_date || null,
          },
          total_tokens: summary.total_tokens,
          total_cost: summary.total_cost,
          current_balance: Number(balance.balance),
          generated_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = buildBillingRouter;
