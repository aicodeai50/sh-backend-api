const Stripe = require("stripe");
const { getBillingConfig } = require("../../config/billing.config");
const { addCredits } = require("./billing.service");

let stripe = null;

function getStripe() {
  const { stripeSecretKey } = getBillingConfig();
  if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY not configured");
  if (!stripe) stripe = new Stripe(stripeSecretKey);
  return stripe;
}

function isStripeConfigured() {
  return Boolean(getBillingConfig().stripeSecretKey);
}

async function createTopupPaymentIntent({ userId, amountUsd, email }) {
  const client = getStripe();
  const cents = Math.round(Number(amountUsd) * 100);

  if (!Number.isFinite(cents) || cents < 100) {
    throw new Error("Minimum top-up is $1.00");
  }

  const intent = await client.paymentIntents.create({
    amount: cents,
    currency: getBillingConfig().currency,
    metadata: { user_id: userId },
    receipt_email: email || undefined,
    automatic_payment_methods: { enabled: true },
  });

  return {
    client_secret: intent.client_secret,
    payment_intent_id: intent.id,
    amount: Number(amountUsd),
  };
}

async function confirmTopupFromPaymentIntent(paymentIntentId) {
  const client = getStripe();
  const intent = await client.paymentIntents.retrieve(paymentIntentId);

  if (intent.status !== "succeeded") {
    throw new Error(`Payment not completed (status: ${intent.status})`);
  }

  const userId = intent.metadata?.user_id;
  if (!userId) throw new Error("Missing user_id on payment intent");

  const amount = Number((intent.amount_received / 100).toFixed(2));
  return addCredits({
    userId,
    amount,
    description: "Stripe top-up",
    referenceId: intent.id,
  });
}

module.exports = {
  getStripe,
  isStripeConfigured,
  createTopupPaymentIntent,
  confirmTopupFromPaymentIntent,
};
