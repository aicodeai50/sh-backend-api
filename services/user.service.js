// services/user.service.js
const { User } = require("../database");

/**
 * Return a plain JSON user object (never leak password fields).
 */
function toPublicUser(userInstance) {
  if (!userInstance) return null;

  const u = userInstance.toJSON ? userInstance.toJSON() : userInstance;

  // ✅ never leak any password field
  const { password, password_hash, ...safe } = u;
  return safe;
}

async function getUserById(userId) {
  if (!userId) return null;
  const user = await User.findByPk(userId);
  return toPublicUser(user);
}

async function getUserByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  const user = await User.findOne({ where: { email: normalized } });
  return toPublicUser(user);
}

/**
 * INTERNAL: returns Sequelize instance including password_hash
 * Use this for login password verification.
 */
async function getUserAuthByEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;

  return User.findOne({ where: { email: normalized } }); // includes password_hash
}

/**
 * Create user (trial fields supported)
 * NOTE: password_hash must already be bcrypt hashed.
 */
async function createUser({
  email,
  name,
  password_hash,
  plan = "trial",
  trial_started_at,
  trial_ends_at,
}) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) throw new Error("Email required");
  if (!password_hash) throw new Error("password_hash required");

  const now = new Date();

  const created = await User.create({
    email: normalized,
    name: name ? String(name).trim() : null,
    password_hash, // ✅ correct column
    plan: String(plan || "trial"),
    trial_started_at: trial_started_at || now,
    trial_ends_at:
      trial_ends_at || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  });

  return toPublicUser(created);
}

async function setUserPlan(userId, plan) {
  if (!userId) throw new Error("userId required");
  const p = String(plan || "").trim();
  if (!p) throw new Error("plan required");

  await User.update({ plan: p }, { where: { id: userId } });
  return getUserById(userId);
}

async function setUserRoleAndCompany({ userId, role, company_id }) {
  if (!userId) throw new Error("userId required");

  const next = {};
  if (role !== undefined) next.role = String(role);
  if (company_id !== undefined)
    next.company_id = company_id ? String(company_id) : null;

  await User.update(next, { where: { id: userId } });
  return getUserById(userId);
}

async function incrementVmRunsUsed(userId, amount = 1) {
  if (!userId) throw new Error("userId required");
  const inc = Number(amount);
  if (!Number.isFinite(inc) || inc <= 0) throw new Error("amount must be > 0");

  await User.increment({ vm_runs_used: inc }, { where: { id: userId } });
  return getUserById(userId);
}

module.exports = {
  // read
  getUserById,
  getUserByEmail,

  // auth/internal
  getUserAuthByEmail,

  // write
  createUser,
  setUserPlan,
  setUserRoleAndCompany,
  incrementVmRunsUsed,
};