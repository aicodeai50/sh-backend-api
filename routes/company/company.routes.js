// routes/company/company.routes.js
const express = require("express");
const router = express.Router();

const { Company, CompanyMember, User, Vm } = require("../../database");

const {
  listMembers,
  addMemberByEmail,
  removeMember,
} = require("../../services/company.members");

// NOTE: requireUser() is already applied in server.js for /company

function requireRole(allowed = []) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: "Missing user role" });
    if (!allowed.includes(role))
      return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(
    16
  )}`;
}

// POST /company/teams  -> create company + set caller as admin
router.post("/teams", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const seats = Number(req.body?.seats || 5);

    if (!name) return res.status(400).json({ error: "Missing company name" });
    if (!Number.isFinite(seats) || seats < 1 || seats > 500) {
      return res.status(400).json({ error: "Invalid seats" });
    }

    const company = await Company.create({
      id: makeId("co"),
      name,
      plan: "team",
      seats,
      created_at: new Date(),
    });

    await CompanyMember.create({
      id: makeId("cm"),
      company_id: company.id,
      user_id: req.user.id,
      role: "company_admin",
      created_at: new Date(),
    });

    await User.update(
      { role: "company_admin", company_id: company.id },
      { where: { id: req.user.id } }
    );

    res.json({ company });
  } catch (err) {
    console.error("POST /company/teams error:", err);
    res.status(500).json({ error: "Failed to create company" });
  }
});

// ===============================
// COMPANY MEMBERS (ADMIN ONLY)
// ===============================

// GET /company/members  -> list members in company
router.get("/members", requireRole(["company_admin"]), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: "No company on user" });

    const members = await listMembers(companyId);
    res.json({ company_id: companyId, members });
  } catch (err) {
    console.error("GET /company/members error:", err);
    res.status(500).json({ error: err?.message || "Failed to list members" });
  }
});

// POST /company/members  -> add member by email (user must exist)
router.post("/members", requireRole(["company_admin"]), async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    const result = await addMemberByEmail({ adminUser: req.user, email });

    res.json({
      ok: true,
      already: result.already,
      member: { user_id: result.user.id, email: result.user.email },
      company: { id: result.company.id, seats: result.company.seats },
    });
  } catch (err) {
    console.error("POST /company/members error:", err);
    res.status(400).json({ error: err?.message || "Failed to add member" });
  }
});

// DELETE /company/members/:userId -> remove member from company
router.delete(
  "/members/:userId",
  requireRole(["company_admin"]),
  async (req, res) => {
    try {
      const result = await removeMember({
        adminUser: req.user,
        userId: req.params.userId,
      });
      res.json(result);
    } catch (err) {
      console.error("DELETE /company/members/:userId error:", err);
      res.status(400).json({ error: err?.message || "Failed to remove member" });
    }
  }
);

// GET /company/analytics (admin only)
router.get("/analytics", requireRole(["company_admin"]), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: "No company on user" });

    const members = await CompanyMember.count({
      where: { company_id: companyId },
    });

    // v1: count VMs by the admin user (expand later to all members)
    const vmCount = await Vm.count({ where: { owner_user_id: req.user.id } });

    res.json({
      company_id: companyId,
      members,
      vm_runs_admin: vmCount,
      notes: "v1 analytics; expand later to all members",
    });
  } catch (err) {
    console.error("GET /company/analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

// POST /company/skill-matrix (admin only) - placeholder v1
router.post("/skill-matrix", requireRole(["company_admin"]), async (req, res) => {
  try {
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ error: "No company on user" });

    const members = await CompanyMember.findAll({
      where: { company_id: companyId },
      include: [{ model: User }],
    });

    const matrix = members.map((m) => ({
      user_id: m.user_id,
      name: m.User?.name || m.User?.email || "Member",
      role: m.role,
      skills: { javascript: 0, react: 0, backend: 0, devops: 0 },
    }));

    res.json({ company_id: companyId, matrix });
  } catch (err) {
    console.error("POST /company/skill-matrix error:", err);
    res.status(500).json({ error: "Failed to build skill matrix" });
  }
});

// POST /company/upskill-plan (admin only) - placeholder v1
router.post("/upskill-plan", requireRole(["company_admin"]), async (req, res) => {
  try {
    const targetRole = String(req.body?.target_role || "Fullstack").trim();
    const timeframeWeeks = Number(req.body?.timeframe_weeks || 8);
    const weeksCount = Math.min(
      12,
      Math.max(1, Number.isFinite(timeframeWeeks) ? timeframeWeeks : 8)
    );

    const plan = {
      target_role: targetRole,
      timeframe_weeks: weeksCount,
      weeks: Array.from({ length: weeksCount }).map((_, i) => ({
        week: i + 1,
        focus: "Core skill building",
        activities: ["Quizzes", "Project practice", "Interview drills"],
      })),
    };

    res.json({ company_id: req.user.company_id, plan });
  } catch (err) {
    console.error("POST /company/upskill-plan error:", err);
    res.status(500).json({ error: "Failed to create upskill plan" });
  }
});

// POST /company/interview-score (admin only) - placeholder v1
router.post(
  "/interview-score",
  requireRole(["company_admin"]),
  async (req, res) => {
    try {
      const employeeUserId = Number(req.body?.user_id);
      if (!employeeUserId)
        return res.status(400).json({ error: "Missing user_id" });

      const score = {
        user_id: employeeUserId,
        overall: 65,
        categories: {
          communication: 60,
          problem_solving: 70,
          technical_depth: 65,
        },
        notes: ["Good structure", "Needs stronger examples"],
      };

      res.json({ company_id: req.user.company_id, score });
    } catch (err) {
      console.error("POST /company/interview-score error:", err);
      res.status(500).json({ error: "Failed to score interview" });
    }
  }
);

module.exports = router;
