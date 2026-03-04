// middleware/rateLimit.js

const buckets = new Map();

/**
 * Simple in-memory rate limiter.
 * Safe for single-instance Railway.
 */
function rateLimit({ keyFn, limit, windowMs }) {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > limit) {
      const retryAfter = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "Rate limited",
        message: `Too many requests. Try again in ${retryAfter}s.`,
      });
    }

    next();
  };
}

module.exports = { rateLimit };
