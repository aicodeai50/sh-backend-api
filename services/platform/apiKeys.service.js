const { getSupabase } = require("../supabase/client");
const { generateApiKey, hashApiKey, keyPreview } = require("./tokens");

async function createApiKey({ userId, name, rateLimit = 60, expiresAt = null }) {
  const supabase = getSupabase();
  const plainKey = generateApiKey();

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: userId,
      key_hash: hashApiKey(plainKey),
      key_preview: keyPreview(plainKey),
      name: String(name || "Default").trim() || "Default",
      rate_limit: Number(rateLimit) || 60,
      expires_at: expiresAt,
      is_active: true,
    })
    .select("id, name, key_preview, created_at, expires_at, is_active, rate_limit")
    .single();

  if (error) throw new Error(error.message);

  return { ...data, key: plainKey };
}

async function listApiKeys(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_preview, created_at, expires_at, is_active, rate_limit, last_used_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

async function revokeApiKey({ userId, keyId }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", keyId)
    .eq("user_id", userId)
    .select("id, is_active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("API key not found");
  return data;
}

async function updateApiKey({ userId, keyId, name, rateLimit, expiresAt, isActive }) {
  const supabase = getSupabase();
  const patch = {};

  if (name !== undefined) patch.name = String(name).trim() || "Default";
  if (rateLimit !== undefined) patch.rate_limit = Number(rateLimit) || 60;
  if (expiresAt !== undefined) patch.expires_at = expiresAt;
  if (isActive !== undefined) patch.is_active = Boolean(isActive);

  const { data, error } = await supabase
    .from("api_keys")
    .update(patch)
    .eq("id", keyId)
    .eq("user_id", userId)
    .select("id, name, key_preview, created_at, expires_at, is_active, rate_limit, last_used_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("API key not found");
  return data;
}

async function findApiKeyByPlainKey(plainKey) {
  const supabase = getSupabase();
  const digest = hashApiKey(plainKey);
  const preview = keyPreview(plainKey);

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_id, key_hash, key_preview, name, is_active, rate_limit, expires_at")
    .eq("key_hash", digest)
    .eq("key_preview", preview)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !data.is_active) return null;

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data;
}

async function touchApiKeyLastUsed(keyId) {
  const supabase = getSupabase();
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyId);
}

module.exports = {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  updateApiKey,
  findApiKeyByPlainKey,
  touchApiKeyLastUsed,
};
