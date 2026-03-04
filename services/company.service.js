// services/company.service.js
const crypto = require("crypto");
const { Company, CompanyMember, User } = require("../database");

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

async function createCompanyAndAdmin({ name, userId, seats = 5, plan = "team" }) {
  const company = await Company.create({
    id: makeId("co"),
    name,
    seats,
    plan,
    created_at: new Date(),
  });

  await CompanyMember.create({
    id: makeId("cm"),
    company_id: company.id,
    user_id: userId,
    role: "company_admin",
    created_at: new Date(),
  });

  await User.update(
    { role: "company_admin", company_id: company.id },
    { where: { id: userId } }
  );

  return company;
}

async function ensureCompanyAdminSeatAvailable(companyId) {
  const company = await Company.findByPk(companyId);
  if (!company) throw new Error("Company not found");

  const count = await CompanyMember.count({ where: { company_id: companyId } });
  if (count >= company.seats) throw new Error("No seats available");

  return company;
}

module.exports = {
  createCompanyAndAdmin,
  ensureCompanyAdminSeatAvailable,
};