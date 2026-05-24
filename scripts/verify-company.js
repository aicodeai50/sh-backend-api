const { request } = require("./http-client");
const { loadProjectEnv } = require("./env-utils");

const env = loadProjectEnv();
const API_KEY = (env.SH_API_KEY || process.env.SH_API_KEY || "").trim();
const BASE = process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 8080}`;

function assert(name, condition, detail) {
  if (!condition) throw new Error(`${name} failed: ${detail}`);
}

(async () => {
  const stamp = Date.now();
  const adminEmail = `admin_${stamp}@company.test`;
  const employeeEmail = `employee_${stamp}@company.test`;
  const password = "Password123!";
  const checks = [];

  const health = await request("GET", BASE, "/health", { apiKey: API_KEY });
  assert("health", health.status === 200 && health.body?.ok, health.status);
  checks.push("health");

  await request("POST", BASE, "/auth/register", {
    apiKey: API_KEY,
    body: { email: adminEmail, password, name: "Admin User" },
  });
  await request("POST", BASE, "/auth/register", {
    apiKey: API_KEY,
    body: { email: employeeEmail, password, name: "Employee User" },
  });

  const adminLogin = await request("POST", BASE, "/auth/login", {
    apiKey: API_KEY,
    body: { email: adminEmail, password },
  });
  assert("admin login", adminLogin.status === 200, adminLogin.status);
  const adminToken = adminLogin.body?.token;
  checks.push("auth");

  const me = await request("GET", BASE, "/auth/me", {
    apiKey: API_KEY,
    token: adminToken,
  });
  assert("auth/me bearer", me.status === 200 && me.body?.user?.email === adminEmail, me.status);
  checks.push("auth/me");

  const createTeam = await request("POST", BASE, "/company/teams", {
    apiKey: API_KEY,
    token: adminToken,
    body: { name: `Acme ${stamp}`, seats: 5 },
  });
  assert("create team", createTeam.status === 201, JSON.stringify(createTeam.body));
  checks.push("create team");

  const profile = await request("GET", BASE, "/company", {
    apiKey: API_KEY,
    token: adminToken,
  });
  assert(
    "company profile",
    profile.status === 200 && profile.body?.company?.seats === 5,
    profile.status
  );
  checks.push("company profile");

  const addMember = await request("POST", BASE, "/company/members", {
    apiKey: API_KEY,
    token: adminToken,
    body: { email: employeeEmail },
  });
  assert("add member", addMember.status === 200, JSON.stringify(addMember.body));
  checks.push("add member");

  const members = await request("GET", BASE, "/company/members", {
    apiKey: API_KEY,
    token: adminToken,
  });
  assert(
    "list members",
    members.status === 200 && members.body?.members?.length === 2,
    members.status
  );
  checks.push("list members");

  const analytics = await request("GET", BASE, "/company/analytics", {
    apiKey: API_KEY,
    token: adminToken,
  });
  assert(
    "analytics",
    analytics.status === 200 && analytics.body?.analytics?.members === 2,
    analytics.status
  );
  checks.push("analytics");

  const companyDoc = await request("POST", BASE, "/api/v1/docs/projects?scope=company", {
    apiKey: API_KEY,
    token: adminToken,
    body: { title: "Company project", status: "active" },
  });
  assert("company scoped doc", companyDoc.status === 201, JSON.stringify(companyDoc.body));
  checks.push("company scoped docs");

  const manifest = await request("GET", BASE, "/api/v1/platform/manifest", {
    apiKey: API_KEY,
  });
  assert("manifest company", manifest.body?.company?.createTeam, "missing company block");
  checks.push("manifest");

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        checks,
        companyId: profile.body?.company?.id,
      },
      null,
      2
    )
  );
})().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
