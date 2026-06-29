function apiKeyRateLimitDynamic() {
  const buckets = new Map();

  return (req, res, next) => {
    const limit = Number(req.apiKey?.rate_limit || 60);
    const key = req.apiKey?.id ? `key:${req.apiKey.id}` : `ip:${req.ip || "unknown"}`;
    const now = Date.now();
    const windowMs = 60_000;

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Rate limited",
        limit,
        retry_after_seconds: retryAfter,
      });
    }

    next();
  };
}

module.exports = { apiKeyRateLimit: apiKeyRateLimitDynamic };
