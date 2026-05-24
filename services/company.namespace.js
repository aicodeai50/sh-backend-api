function companyDocNamespace(user, collection) {
  const base = String(collection || "").trim();
  if (!base) return base;
  if (!user?.company_id) return base;
  const prefix = `company:${user.company_id}:`;
  if (base.startsWith(prefix)) return base;
  return `${prefix}${base}`;
}

function resolveCollectionScope(req) {
  const raw = String(req.params.collection || "").trim();
  const scope = String(req.query.scope || req.headers["x-company-scope"] || "")
    .trim()
    .toLowerCase();

  if (scope === "company" && req.user?.company_id) {
    return companyDocNamespace(req.user, raw);
  }

  return raw;
}

module.exports = {
  companyDocNamespace,
  resolveCollectionScope,
};
