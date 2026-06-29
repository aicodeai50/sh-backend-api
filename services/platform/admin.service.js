const { getSupabase } = require("../supabase/client");

async function listUsers({ limit = 100 } = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, balance, total_spent, is_active, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(limit) || 100, 500));

  if (error) throw new Error(error.message);
  return data || [];
}

async function getUserDetails(userId) {
  const supabase = getSupabase();

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, balance, total_spent, is_active, is_admin, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user) throw new Error("User not found");

  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, key_preview, is_active, rate_limit, last_used_at, created_at")
    .eq("user_id", userId);

  const { data: recentUsage } = await supabase
    .from("api_usage")
    .select("endpoint, tokens_total, cost, created_at, status_code")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return { user, api_keys: keys || [], recent_usage: recentUsage || [] };
}

async function upsertPricing({ endpoint, costPerToken, costPerRequest }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("pricing")
    .upsert(
      {
        endpoint: String(endpoint || "default"),
        cost_per_token: Number(costPerToken),
        cost_per_request: Number(costPerRequest),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function getRevenueStats() {
  const supabase = getSupabase();

  const { data: usage } = await supabase
    .from("api_usage")
    .select("cost, created_at")
    .order("created_at", { ascending: false })
    .limit(10000);

  const { data: topups } = await supabase
    .from("billing_transactions")
    .select("amount, created_at")
    .eq("type", "topup")
    .order("created_at", { ascending: false })
    .limit(10000);

  const usageRows = usage || [];
  const topupRows = topups || [];

  return {
    total_usage_revenue: Number(
      usageRows.reduce((s, r) => s + Number(r.cost || 0), 0).toFixed(6)
    ),
    total_topups: Number(
      topupRows.reduce((s, r) => s + Number(r.amount || 0), 0).toFixed(6)
    ),
    requests_tracked: usageRows.length,
    topup_count: topupRows.length,
  };
}

module.exports = {
  listUsers,
  getUserDetails,
  upsertPricing,
  getRevenueStats,
};
