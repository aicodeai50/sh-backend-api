// services/company.members.js
const crypto = require("crypto");
const { sequelize, Company, CompanyMember, User } = require("../database");
const { ensureCompanyAdminSeatAvailable } = require("./company.service");

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

async function requireAdminCompany(user) {
  const companyId = user?.company_id;
  if (!companyId) throw new Error("No company on user");
  if (user.role !== "company_admin") throw new Error("Forbidden");
  const company = await Company.findByPk(companyId);
  if (!company) throw new Error("Company not found");
  return company;
}

async function getMemberCount(companyId) {
  return CompanyMember.count({ where: { company_id: companyId } });
}

async function listMembers(companyId) {
  const rows = await CompanyMember.findAll({
    where: { company_id: companyId },
    order: [["created_at", "ASC"]],
    include: [{ model: User }],
  });

  return rows.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    email: m.User?.email || null,
    name: m.User?.name || null,
    plan: m.User?.plan || null,
    vm_runs_used: m.User?.vm_runs_used ?? 0,
    created_at: m.created_at,
  }));
}

async function addMemberByEmail({ adminUser, email }) {
  const company = await requireAdminCompany(adminUser);

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Missing email");

  const user = await User.findOne({ where: { email: normalizedEmail } });
  if (!user) throw new Error("User not found (must register first)");

  if (user.company_id && user.company_id !== company.id) {
    throw new Error("User already belongs to another company");
  }

  const existing = await CompanyMember.findOne({
    where: { company_id: company.id, user_id: user.id },
  });
  if (existing) return { company, user, member: existing, already: true };

  await ensureCompanyAdminSeatAvailable(company.id);

  return sequelize.transaction(async (transaction) => {
    const member = await CompanyMember.create(
      {
        id: makeId("cm"),
        company_id: company.id,
        user_id: user.id,
        role: "employee",
        created_at: new Date(),
      },
      { transaction }
    );

    await User.update(
      { role: "employee", company_id: company.id, plan: "team" },
      { where: { id: user.id }, transaction }
    );

    return { company, user, member, already: false };
  });
}

async function removeMember({ adminUser, userId }) {
  const company = await requireAdminCompany(adminUser);

  const uid = Number(userId);
  if (!uid) throw new Error("Missing userId");
  if (uid === adminUser.id) throw new Error("Admin cannot remove self");

  const member = await CompanyMember.findOne({
    where: { company_id: company.id, user_id: uid },
  });
  if (!member) throw new Error("Member not found");

  await sequelize.transaction(async (transaction) => {
    await CompanyMember.destroy({ where: { id: member.id }, transaction });
    await User.update(
      { company_id: null, role: "student", plan: "pro" },
      { where: { id: uid }, transaction }
    );
  });

  return { ok: true };
}

module.exports = {
  listMembers,
  addMemberByEmail,
  removeMember,
  getMemberCount,
};
