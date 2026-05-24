// routes/company/company.routes.js
const express = require("express");
const router = express.Router();

const { CompanyMember, User } = require("../../database");
const requireRole = require("../../middleware/requireRole");
const {
  createCompanyAndAdmin,
  updateCompany,
  getCompanyProfile,
  getCompanyAnalytics,
  assertMemberInCompany,
  getCompanyMemberUserIds,
} = require("../../services/company.service");
const {
  listMembers,
  addMemberByEmail,
  removeMember,
} = require("../../services/company.members");
const { listVMsByOwner, countVMsForUsers } = require("../../services/vm.store");

function requireCompanyMember(req, res, next) {
  if (!req.user?.company_id) {
    return res.status(400).json({ error: "No company on user" });
  }
  next();
}

// POST /company/teams -> create company + set caller as admin
router.post("/teams", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const seats = Number(req.body?.seats || 5);

    if (!name) return res.status(400).json({ error: "Missing company name" });
    if (!Number.isFinite(seats) || seats < 1 || seats > 500) {
      return res.status(400).json({ error: "Invalid seats" });
    }

    const company = await createCompanyAndAdmin({
      name,
      userId: req.user.id,
      seats,
    });

    const profile = await getCompanyProfile(company.id);
    res.status(201).json({ ok: true, company: profile });
  } catch (err) {
    const msg = err?.message || "Failed to create company";
    const status = msg.includes("already belongs") ? 409 : 500;
    console.error("POST /company/teams error:", err);
    res.status(status).json({ error: msg });
  }
});

// GET /company -> company profile for any member
router.get("/", requireCompanyMember, async (req, res) => {
  try {
    const profile = await getCompanyProfile(req.user.company_id);
    if (!profile) return res.status(404).json({ error: "Company not found" });
    res.json({ ok: true, company: profile, role: req.user.role });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to load company" });
  }
});

// PATCH /company -> update name/seats (admin only)
router.patch("/", requireRole(["company_admin"]), async (req, res) => {
  try {
    const company = await updateCompany({
      adminUser: req.user,
      name: req.body?.name,
      seats: req.body?.seats,
    });
    res.json({ ok: true, company });
  } catch (err) {
    const status = err?.message === "Forbidden" ? 403 : 400;
    res.status(status).json({ error: err?.message || "Failed to update company" });
  }
});

// GET /company/members
router.get("/members", requireRole(["company_admin"]), async (req, res) => {
  try {
    const members = await listMembers(req.user.company_id);
    res.json({ company_id: req.user.company_id, members });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to list members" });
  }
});

// POST /company/members
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
    res.status(400).json({ error: err?.message || "Failed to add member" });
  }
});

// DELETE /company/members/:userId
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
      res.status(400).json({ error: err?.message || "Failed to remove member" });
    }
  }
);

// GET /company/analytics
router.get("/analytics", requireRole(["company_admin"]), async (req, res) => {
  try {
    const analytics = await getCompanyAnalytics(req.user.company_id);
    res.json({ ok: true, analytics });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to load analytics" });
  }
});

// GET /company/vms -> admin view of company VM activity
router.get("/vms", requireRole(["company_admin"]), async (req, res) => {
  try {
    const userIds = await getCompanyMemberUserIds(req.user.company_id);
    const users = await User.findAll({
      where: { id: userIds },
      attributes: ["id", "email", "name", "vm_runs_used"],
    });

    const summary = users.map((u) => ({
      user_id: u.id,
      email: u.email,
      name: u.name,
      vm_runs_used: u.vm_runs_used,
      active_vms: listVMsByOwner(u.id).filter(
        (vm) => vm.status === "queued" || vm.status === "running"
      ).length,
    }));

    res.json({
      ok: true,
      company_id: req.user.company_id,
      vm_total_runtime: countVMsForUsers(userIds),
      members: summary,
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to load company VMs" });
  }
});

// POST /company/skill-matrix
router.post("/skill-matrix", requireRole(["company_admin"]), async (req, res) => {
  try {
    const members = await listMembers(req.user.company_id);
    const matrix = members.map((m) => ({
      user_id: m.user_id,
      name: m.name || m.email || "Member",
      role: m.role,
      vm_runs_used: m.vm_runs_used,
      skills: { javascript: 0, react: 0, backend: 0, devops: 0 },
    }));

    res.json({ company_id: req.user.company_id, matrix });
  } catch (err) {
    res.status(500).json({ error: "Failed to build skill matrix" });
  }
});

// POST /company/upskill-plan
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
    res.status(500).json({ error: "Failed to create upskill plan" });
  }
});

// POST /company/interview-score
router.post(
  "/interview-score",
  requireRole(["company_admin"]),
  async (req, res) => {
    try {
      const employeeUserId = Number(req.body?.user_id);
      if (!employeeUserId) {
        return res.status(400).json({ error: "Missing user_id" });
      }

      await assertMemberInCompany(req.user.company_id, employeeUserId);

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
      const status = err?.message?.includes("not a member") ? 404 : 400;
      res.status(status).json({ error: err?.message || "Failed to score interview" });
    }
  }
);

module.exports = router;
