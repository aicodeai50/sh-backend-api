const { getSupabase } = require("../supabase/client");
const { getBillingConfig } = require("../../config/billing.config");

async function getPricing(endpoint) {
  const supabase = getSupabase();
  const path = String(endpoint || "default");

  const { data: exact } = await supabase
    .from("pricing")
    .select("endpoint, cost_per_token, cost_per_request")
    .eq("endpoint", path)
    .maybeSingle();

  if (exact) return exact;

  const { data: fallback } = await supabase
    .from("pricing")
    .select("endpoint, cost_per_token, cost_per_request")
    .eq("endpoint", "default")
    .maybeSingle();

  if (fallback) return fallback;

  const defaults = getBillingConfig();
  return {
    endpoint: "default",
    cost_per_token: defaults.costPerToken,
    cost_per_request: defaults.costPerRequest,
  };
}

function calculateCost({ pricing, tokensTotal, tokensInput = 0, tokensOutput = 0 }) {
  const total =
    Number(tokensTotal) ||
    Number(tokensInput || 0) + Number(tokensOutput || 0);

  const perToken = Number(pricing?.cost_per_token ?? getBillingConfig().costPerToken);
  const perRequest = Number(pricing?.cost_per_request ?? getBillingConfig().costPerRequest);

  const cost = total * perToken + perRequest;
  return Number(cost.toFixed(6));
}

async function getUserBalance(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("balance, total_spent")
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function deductBalance({ userId, cost, description, referenceId }) {
  const supabase = getSupabase();
  const amount = Number(cost);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid cost");

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("balance, total_spent")
    .eq("id", userId)
    .single();

  if (userError) throw new Error(userError.message);

  const balance = Number(user.balance);
  if (balance < amount) {
    const err = new Error("Insufficient balance");
    err.code = "INSUFFICIENT_BALANCE";
    err.balance = balance;
    err.required = amount;
    throw err;
  }

  const newBalance = Number((balance - amount).toFixed(6));
  const newSpent = Number((Number(user.total_spent) + amount).toFixed(6));

  const { error: updateError } = await supabase
    .from("users")
    .update({
      balance: newBalance,
      total_spent: newSpent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) throw new Error(updateError.message);

  await supabase.from("billing_transactions").insert({
    user_id: userId,
    type: "usage",
    amount: -amount,
    description: description || "API usage",
    reference_id: referenceId || null,
  });

  return { balance: newBalance, spent: amount };
}

async function addCredits({ userId, amount, description, referenceId }) {
  const supabase = getSupabase();
  const credit = Number(amount);
  if (!Number.isFinite(credit) || credit <= 0) throw new Error("Invalid top-up amount");

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("balance")
    .eq("id", userId)
    .single();

  if (userError) throw new Error(userError.message);

  const newBalance = Number((Number(user.balance) + credit).toFixed(6));

  const { error: updateError } = await supabase
    .from("users")
    .update({
      balance: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) throw new Error(updateError.message);

  const { data: tx } = await supabase
    .from("billing_transactions")
    .insert({
      user_id: userId,
      type: "topup",
      amount: credit,
      description: description || "Credit top-up",
      reference_id: referenceId || null,
    })
    .select("id")
    .single();

  return { balance: newBalance, transaction_id: tx?.id };
}

async function listTransactions(userId, { limit = 50 } = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("billing_transactions")
    .select("id, type, amount, description, reference_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(limit) || 50, 200));

  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = {
  getPricing,
  calculateCost,
  getUserBalance,
  deductBalance,
  addCredits,
  listTransactions,
};
