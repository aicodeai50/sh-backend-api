const { DataTypes } = require("sequelize");
const { createSequelize } = require("./services/database/sequelize.factory");
const { connectMongo } = require("./services/database/mongodb");
const { connectRedis } = require("./services/database/redis");

const sequelize = createSequelize();

const User = sequelize.define("User", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: true },

  password_hash: { type: DataTypes.STRING, allowNull: false },

  plan: { type: DataTypes.STRING, allowNull: false, defaultValue: "trial" },
  trial_started_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  trial_ends_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },

  vm_runs_used: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

  role: { type: DataTypes.STRING, allowNull: false, defaultValue: "student" },

  company_id: { type: DataTypes.STRING, allowNull: true },

  authToken: { type: DataTypes.STRING, allowNull: true },
});

const VmFactory = require("./models/Vm");
const Vm = VmFactory(sequelize);

const VmFileFactory = require("./models/VmFile");
const VmFile = VmFileFactory(sequelize);

const Company = sequelize.define(
  "Company",
  {
    id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },

    plan: { type: DataTypes.STRING, allowNull: false, defaultValue: "team" },
    seats: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },

    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: "companies", timestamps: false }
);

const CompanyMember = sequelize.define(
  "CompanyMember",
  {
    id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    company_id: { type: DataTypes.STRING, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },

    role: { type: DataTypes.STRING, allowNull: false, defaultValue: "employee" },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { tableName: "company_members", timestamps: false }
);

User.hasMany(Vm, { foreignKey: "owner_user_id" });
Vm.belongsTo(User, { foreignKey: "owner_user_id" });

Vm.hasMany(VmFile, { foreignKey: "vm_id" });
VmFile.belongsTo(Vm, { foreignKey: "vm_id" });

User.hasMany(VmFile, { foreignKey: "owner_user_id" });
VmFile.belongsTo(User, { foreignKey: "owner_user_id" });

Company.hasMany(CompanyMember, { foreignKey: "company_id" });
CompanyMember.belongsTo(Company, { foreignKey: "company_id" });

User.hasMany(CompanyMember, { foreignKey: "user_id" });
CompanyMember.belongsTo(User, { foreignKey: "user_id" });

Company.hasMany(User, { foreignKey: "company_id" });
User.belongsTo(Company, { foreignKey: "company_id" });

const GenericRecord = sequelize.define(
  "GenericRecord",
  {
    id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    namespace: { type: DataTypes.STRING, allowNull: false },
    data: { type: DataTypes.TEXT, allowNull: false },
    owner_user_id: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "generic_records",
    timestamps: false,
    indexes: [{ fields: ["namespace"] }, { fields: ["owner_user_id"] }],
  }
);

async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log("🗄️ SQL database connected");

    const force = String(process.env.FORCE_DB_SYNC || "").trim() === "1";
    const dialect = sequelize.getDialect();

    if (dialect === "sqlite") {
      await sequelize.query("PRAGMA foreign_keys = OFF;");
    }

    if (force) {
      console.log("⚠️ FORCE_DB_SYNC=1 → dropping & recreating all tables");
      await sequelize.sync({ force: true });
      console.log("📦 Database force-synced");
    } else {
      await sequelize.sync({ alter: true });
      console.log("📦 Database synced");
    }

    if (dialect === "sqlite") {
      await sequelize.query("PRAGMA foreign_keys = ON;");
    }

    const mongo = await connectMongo();
    if (mongo.enabled) console.log("🍃 MongoDB connected");

    const redis = await connectRedis();
    if (redis.enabled) console.log("🔴 Redis connected");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

module.exports = {
  sequelize,
  connectDatabase,
  User,
  Vm,
  VmFile,
  Company,
  CompanyMember,
  GenericRecord,
};
