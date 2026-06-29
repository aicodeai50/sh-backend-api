const crypto = require("crypto");

function hashApiKey(plainKey) {
  return crypto.createHash("sha256").update(plainKey).digest("hex");
}

function generateApiKey() {
  const body = crypto.randomBytes(32).toString("base64url");
  return `sk_live_${body}`;
}

function keyPreview(plainKey) {
  return plainKey.slice(-4);
}

function estimateTokens(text) {
  const value = String(text || "");
  if (!value) return 0;
  return Math.max(1, Math.ceil(value.length / 4));
}

function extractBearerToken(req) {
  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

module.exports = {
  hashApiKey,
  generateApiKey,
  keyPreview,
  estimateTokens,
  extractBearerToken,
};
