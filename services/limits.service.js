// services/limits.service.js

const limitsByPlan = {
  free: {
    maxConcurrentVMs: 1,
    createPerMinute: 6,
  },
  pro: {
    maxConcurrentVMs: 3,
    createPerMinute: 30,
  },
  enterprise: {
    maxConcurrentVMs: 10,
    createPerMinute: 120,
  },
};

const GLOBAL_MAX_CONCURRENT_VMS = Number(
  process.env.GLOBAL_MAX_CONCURRENT_VMS || 20
);

function getLimitsForUser(user) {
  const plan = String(user?.plan || "free").toLowerCase();
  return limitsByPlan[plan] || limitsByPlan.free;
}

module.exports = {
  getLimitsForUser,
  GLOBAL_MAX_CONCURRENT_VMS,
};
