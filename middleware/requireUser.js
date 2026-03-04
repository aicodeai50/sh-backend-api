const jwt = require("jsonwebtoken");
const { getUserById } = require("../services/user.service");

const JWT_SECRET = (process.env.JWT_SECRET || "").trim();

function requireUser() {
  return async (req, res, next) => {
    try {
      if (!JWT_SECRET) {
        return res.status(500).json({ error: "JWT_SECRET missing on server" });
      }

      const auth = String(req.headers.authorization || "");
      const match = auth.match(/^Bearer\s+(.+)$/i);
      if (!match) return res.status(401).json({ error: "Missing Bearer token" });

      const token = match[1].trim();

      let payload;
      try {
        payload = jwt.verify(token, JWT_SECRET);
      } catch (e) {
        return res.status(401).json({ error: "Invalid token", details: e?.message });
      }

      const userId = payload?.userId;
      if (!userId) return res.status(401).json({ error: "Invalid token payload" });

      let user;
      try {
        user = await getUserById(userId);
      } catch (e) {
        // ✅ DB/schema errors should NOT be reported as "Invalid token"
        const msg = e?.message || String(e);

        if (
          msg.includes("SQLITE_ERROR") ||
          msg.includes("Sequelize") ||
          msg.includes("no such column") ||
          msg.includes("no such table")
        ) {
          return res.status(500).json({
            error: "Database error while validating user",
            details: msg,
          });
        }

        // unknown error
        return res.status(500).json({
          error: "Server error while validating user",
          details: msg,
        });
      }

      if (!user) return res.status(401).json({ error: "User not found" });

      req.user = user;
      next();
    } catch (err) {
      // fallback
      return res.status(500).json({
        error: "Server error",
        details: err?.message || String(err),
      });
    }
  };
}

module.exports = { requireUser };