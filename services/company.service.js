// services/company.service.js
const crypto = require("crypto");
const { sequelize, Company, CompanyMember, User, Vm } = require("../database");
const { countVMsForUsers, countActiveVMsForUsers } = require("./vm.store");

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

async function getCompanyProfile(companyId) {
  const company = await Company.findByPk(companyId);
  if (!company) return null;

  const membersUsed = await CompanyMember.count({ where: { company_id: companyId } });

  return {
    id: company.id,
    name: company.name,
    plan: company.plan,
    seats: company.seats,
    membersUsed,
    seatsAvailable: Math.max(company.seats - membersUsed, 0),
    created_at: company.created_at,
  };
}

async function createCompanyAndAdmin({ name, userId, seats = 5, plan = "team" }) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");
  if (user.company_id) throw new Error("User already belongs to a company");

  return sequelize.transaction(async (transaction) => {
    const company = await Company.create(
      {
        id: makeId("co"),
        name,
        seats,
        plan,
        created_at: new Date(),
      },
      { transaction }
    );

    await CompanyMember.create(
      {
        id: makeId("cm"),
        company_id: company.id,
        user_id: userId,
        role: "company_admin",
        created_at: new Date(),
      },
      { transaction }
    );

    await User.update(
      {
        role: "company_admin",
        company_id: company.id,
        plan: "team",
      },
      { where: { id: userId }, transaction }
    );

    return company;
  });
}

async function updateCompany({ adminUser, name, seats }) {
  if (adminUser.role !== "company_admin" || !adminUser.company_id) {
    throw new Error("Forbidden");
  }

  const company = await Company.findByPk(adminUser.company_id);
  if (!company) throw new Error("Company not found");

  const next = {};
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) throw new Error("Company name cannot be empty");
    next.name = trimmed;
  }

  if (seats !== undefined) {
    const nextSeats = Number(seats);
    if (!Number.isFinite(nextSeats) || nextSeats < 1 || nextSeats > 500) {
      throw new Error("Invalid seats");
    }
    const membersUsed = await CompanyMember.count({
      where: { company_id: company.id },
    });
    if (nextSeats < membersUsed) {
      throw new Error(`Seats cannot be less than current members (${membersUsed})`);
    }
    next.seats = nextSeats;
  }

  if (!Object.keys(next).length) throw new Error("No updates provided");

  await company.update(next);
  return getCompanyProfile(company.id);
}

async function ensureCompanyAdminSeatAvailable(companyId) {
  const company = await Company.findByPk(companyId);
  if (!company) throw new Error("Company not found");

  const count = await CompanyMember.count({ where: { company_id: companyId } });
  if (count >= company.seats) throw new Error("No seats available");

  return company;
}

async function assertMemberInCompany(companyId, userId) {
  const member = await CompanyMember.findOne({
    where: { company_id: companyId, user_id: userId },
  });
  if (!member) throw new Error("User is not a member of this company");
  return member;
}

async function getCompanyMemberUserIds(companyId) {
  const rows = await CompanyMember.findAll({
    where: { company_id: companyId },
    attributes: ["user_id"],
  });
  return rows.map((r) => r.user_id);
}

async function getCompanyAnalytics(companyId) {
  const company = await getCompanyProfile(companyId);
  if (!company) throw new Error("Company not found");

  const userIds = await getCompanyMemberUserIds(companyId);

  const vmRunsTotal = userIds.length
    ? await User.sum("vm_runs_used", { where: { id: userIds } })
    : 0;

  const vmCountDb = userIds.length
    ? await Vm.count({ where: { owner_user_id: userIds } })
    : 0;

  const vmActive = countActiveVMsForUsers(userIds);
  const vmTotal = countVMsForUsers(userIds);

  return {
    company,
    members: company.membersUsed,
    seats_available: company.seatsAvailable,
    vm_runs_total: Number(vmRunsTotal || 0),
    vm_records_db: vmCountDb,
    vm_active: vmActive,
    vm_total_runtime: vmTotal,
  };
}

module.exports = {
  createCompanyAndAdmin,
  updateCompany,
  getCompanyProfile,
  ensureCompanyAdminSeatAvailable,
  assertMemberInCompany,
  getCompanyMemberUserIds,
  getCompanyAnalytics,
};
