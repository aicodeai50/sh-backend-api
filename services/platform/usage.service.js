const { getSupabase } = require("../supabase/client");

async function logUsage({
  userId,
  apiKeyId,
  endpoint,
  method,
  tokensInput = 0,
  tokensOutput = 0,
  tokensTotal = 0,
  cost = 0,
  responseTimeMs,
  statusCode,
}) {
  const supabase = getSupabase();
  const total =
    Number(tokensTotal) || Number(tokensInput || 0) + Number(tokensOutput || 0);

  const { data, error } = await supabase
    .from("api_usage")
    .insert({
      user_id: userId,
      api_key_id: apiKeyId || null,
      endpoint,
      method,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      tokens_total: total,
      cost,
      response_time_ms: responseTimeMs,
      status_code: statusCode,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function getUsageSummary(userId, { startDate, endDate } = {}) {
  const supabase = getSupabase();
  let query = supabase
    .from("api_usage")
    .select("tokens_total, cost, created_at, endpoint")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data || [];
  const total_tokens = rows.reduce((sum, r) => sum + Number(r.tokens_total || 0), 0);
  const total_cost = rows.reduce((sum, r) => sum + Number(r.cost || 0), 0);

  const byDay = {};
  for (const row of rows) {
    const day = String(row.created_at).slice(0, 10);
    if (!byDay[day]) byDay[day] = { date: day, tokens: 0, cost: 0 };
    byDay[day].tokens += Number(row.tokens_total || 0);
    byDay[day].cost += Number(row.cost || 0);
  }

  return {
    total_tokens,
    total_cost: Number(total_cost.toFixed(6)),
    usage_by_day: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    recent: rows.slice(0, 100),
  };
}

async function getGlobalUsageStats({ startDate, endDate } = {}) {
  const supabase = getSupabase();
  let query = supabase
    .from("api_usage")
    .select("tokens_total, cost, created_at, endpoint, user_id")
    .order("created_at", { ascending: false })
    .limit(10000);

  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data || [];
  return {
    total_requests: rows.length,
    total_tokens: rows.reduce((s, r) => s + Number(r.tokens_total || 0), 0),
    total_cost: Number(
      rows.reduce((s, r) => s + Number(r.cost || 0), 0).toFixed(6)
    ),
    unique_users: new Set(rows.map((r) => r.user_id)).size,
  };
}

module.exports = { logUsage, getUsageSummary, getGlobalUsageStats };
