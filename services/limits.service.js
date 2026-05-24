// services/limits.service.js

const limitsByPlan = {
  trial: {
    maxConcurrentVMs: 1,
    createPerMinute: 6,
  },
  free: {
    maxConcurrentVMs: 1,
    createPerMinute: 6,
  },
  pro: {
    maxConcurrentVMs: 3,
    createPerMinute: 30,
  },
  team: {
    maxConcurrentVMs: 5,
    createPerMinute: 60,
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
  const plan = String(user?.plan || "trial").toLowerCase();
  return limitsByPlan[plan] || limitsByPlan.trial;
}

function getActiveVmLimitError(user, activeCount) {
  const limits = getLimitsForUser(user);
  if (activeCount >= limits.maxConcurrentVMs) {
    return {
      error: "VM limit reached for your plan",
      plan: user?.plan || "trial",
      limit: limits.maxConcurrentVMs,
      active: activeCount,
    };
  }
  return null;
}

module.exports = {
  getLimitsForUser,
  getActiveVmLimitError,
  GLOBAL_MAX_CONCURRENT_VMS,
  limitsByPlan,
};
