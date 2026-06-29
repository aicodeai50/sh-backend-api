const express = require("express");
const { getStripe } = require("../../services/platform/stripe.service");
const { getBillingConfig } = require("../../config/billing.config");
const { confirmTopupFromPaymentIntent } = require("../../services/platform/stripe.service");

function buildStripeWebhookRouter() {
  const router = express.Router();

  router.post(
    "/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const secret = getBillingConfig().stripeWebhookSecret;
      if (!secret) {
        return res.status(503).json({ error: "Stripe webhook secret not configured" });
      }

      try {
        const stripe = getStripe();
        const sig = req.headers["stripe-signature"];
        const event = stripe.webhooks.constructEvent(req.body, sig, secret);

        if (event.type === "payment_intent.succeeded") {
          const intent = event.data.object;
          await confirmTopupFromPaymentIntent(intent.id);
        }

        res.json({ received: true });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  return router;
}

module.exports = buildStripeWebhookRouter;
