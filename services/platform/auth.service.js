const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getSupabase } = require("../supabase/client");
const { getBillingConfig } = require("../../config/billing.config");

const JWT_SECRET = () => String(process.env.JWT_SECRET || "").trim();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

function signPlatformToken(userId) {
  if (!JWT_SECRET()) throw new Error("JWT_SECRET missing");
  return jwt.sign({ userId, scope: "platform" }, JWT_SECRET(), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function verifyPlatformToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET());
    if (!payload?.userId || payload.scope !== "platform") return null;
    return payload;
  } catch {
    return null;
  }
}

async function createUser({ email, password, name }) {
  const supabase = getSupabase();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const passwordPlain = String(password || "");

  if (!normalizedEmail) throw new Error("Email required");
  if (passwordPlain.length < 8) throw new Error("Password must be at least 8 characters");

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existing) throw new Error("Email already registered");

  const password_hash = await bcrypt.hash(passwordPlain, 12);
  const { signupBonusBalance } = getBillingConfig();

  const { data: user, error } = await supabase
    .from("users")
    .insert({
      email: normalizedEmail,
      password_hash,
      name: name ? String(name).trim() : null,
      balance: signupBonusBalance,
    })
    .select("id, email, name, balance, total_spent, is_active, created_at")
    .single();

  if (error) throw new Error(error.message);

  if (signupBonusBalance > 0) {
    await supabase.from("billing_transactions").insert({
      user_id: user.id,
      type: "topup",
      amount: signupBonusBalance,
      description: "Signup bonus credits",
    });
  }

  return user;
}

async function loginUser({ email, password }) {
  const supabase = getSupabase();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const passwordPlain = String(password || "");

  const { data: user, error } = await supabase
    .from("users")
    .select("id, email, name, password_hash, balance, total_spent, is_active, is_admin, created_at")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!user || !user.is_active) throw new Error("Invalid email or password");

  const ok = await bcrypt.compare(passwordPlain, user.password_hash);
  if (!ok) throw new Error("Invalid email or password");

  const token = signPlatformToken(user.id);
  delete user.password_hash;

  return { token, user };
}

async function getUserById(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, balance, total_spent, is_active, is_admin, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

module.exports = {
  signPlatformToken,
  verifyPlatformToken,
  createUser,
  loginUser,
  getUserById,
};
