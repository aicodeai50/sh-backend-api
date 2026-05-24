const jwt = require("jsonwebtoken");
const { getUserById } = require("../services/user.service");

const JWT_SECRET = (process.env.JWT_SECRET || "").trim();

function optionalUser() {
  return async (req, res, next) => {
    try {
      if (!JWT_SECRET) return next();

      const auth = String(req.headers.authorization || "");
      const match = auth.match(/^Bearer\s+(.+)$/i);
      if (!match) return next();

      const token = match[1].trim();
      let payload;
      try {
        payload = jwt.verify(token, JWT_SECRET);
      } catch {
        return next();
      }

      const userId = payload?.userId;
      if (!userId) return next();

      const user = await getUserById(userId);
      if (user) req.user = user;

      next();
    } catch {
      next();
    }
  };
}

module.exports = { optionalUser };
