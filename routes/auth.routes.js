const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { createUser, getUserAuthByEmail, getUserById } = require("../services/user.service");

const router = express.Router();

const JWT_SECRET = (process.env.JWT_SECRET || "").trim();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
const COOKIE_NAME = process.env.COOKIE_NAME || "shynvo_session";
const IS_PROD = process.env.NODE_ENV === "production";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? "none" : "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  };
}

function signToken(userId) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET missing on server");
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    if (!JWT_SECRET) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function shapeUser(u) {
  if (!u) return null;

  const trialEnds = u.trial_ends_at || null;
  const plan = u.plan || "trial";
  const trialActive = trialEnds ? new Date() < new Date(trialEnds) : false;
  const access = plan === "pro" || plan === "team" || (plan === "trial" && trialActive);

  return {
    id: u.id,
    name: u.name || null,
    email: u.email,
    plan,
    trialEndsAt: trialEnds,
    trialActive,
    access,
    createdAt: u.createdAt || null,
  };
}

router.post("/register", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const passwordPlain = String(req.body?.password || "");
    const name = req.body?.name ? String(req.body.name).trim() : null;

    if (!email) return res.status(400).json({ error: "Email required" });
    if (!passwordPlain || passwordPlain.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await getUserAuthByEmail(email);
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const password_hash = await bcrypt.hash(passwordPlain, 12);

    const now = new Date();
    const trialEnds = new Date(now.getTime() + SEVEN_DAYS_MS);

    const user = await createUser({
      email,
      name,
      password_hash,
      plan: "trial",
      trial_started_at: now,
      trial_ends_at: trialEnds,
    });

    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, cookieOptions());

    const fullUser = await getUserById(user.id);
    return res.json({ ok: true, user: shapeUser(fullUser) });
  } catch (err) {
    return res.status(500).json({
      error: "Register failed",
      details: err?.message || String(err),
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const passwordPlain = String(req.body?.password || "");

    if (!email) return res.status(400).json({ error: "Email required" });
    if (!passwordPlain) return res.status(400).json({ error: "Password required" });

    const userRow = await getUserAuthByEmail(email);
    if (!userRow) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(passwordPlain, userRow.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const token = signToken(userRow.id);
    res.cookie(COOKIE_NAME, token, cookieOptions());

    const user = await getUserById(userRow.id);
    return res.json({ ok: true, user: shapeUser(user) });
  } catch (err) {
    return res.status(500).json({
      error: "Login failed",
      details: err?.message || String(err),
    });
  }
});

router.post("/logout", async (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  return res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    const payload = token ? verifyToken(token) : null;

    if (!payload?.userId) return res.json({ ok: true, user: null });

    const user = await getUserById(payload.userId);
    if (!user) return res.json({ ok: true, user: null });

    return res.json({ ok: true, user: shapeUser(user) });
  } catch (err) {
    return res.status(500).json({
      error: "Me failed",
      details: err?.message || String(err),
    });
  }
});

module.exports = router;
