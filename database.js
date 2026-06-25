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
  { tableName: "company_members", timestamps: false, indexes: [{ unique: true, fields: ["company_id", "user_id"] }] }
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

const OmsorgCourse = sequelize.define(
  "OmsorgCourse",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    department: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
    due_at: { type: DataTypes.DATE, allowNull: true },
    created_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "omsorg_courses",
    timestamps: false,
    indexes: [{ fields: ["status"] }, { fields: ["department"] }],
  }
);

const OmsorgActivity = sequelize.define(
  "OmsorgActivity",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    course_id: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
    required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "omsorg_activities",
    timestamps: false,
    indexes: [{ fields: ["course_id"] }, { fields: ["status"] }],
  }
);

const OmsorgCheckoff = sequelize.define(
  "OmsorgCheckoff",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    course_id: { type: DataTypes.UUID, allowNull: false },
    activity_id: { type: DataTypes.UUID, allowNull: false },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    checked_by_user_id: { type: DataTypes.INTEGER, allowNull: false },
    checked_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    note: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "omsorg_checkoffs",
    timestamps: false,
    indexes: [
      { fields: ["course_id"] },
      { fields: ["activity_id"] },
      { fields: ["employee_id"] },
      { fields: ["checked_at"] },
    ],
  }
);

const OmsorgComment = sequelize.define(
  "OmsorgComment",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    course_id: { type: DataTypes.UUID, allowNull: true },
    activity_id: { type: DataTypes.UUID, allowNull: true },
    employee_id: { type: DataTypes.INTEGER, allowNull: true },
    author_user_id: { type: DataTypes.INTEGER, allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "omsorg_comments",
    timestamps: false,
    indexes: [
      { fields: ["course_id"] },
      { fields: ["activity_id"] },
      { fields: ["employee_id"] },
      { fields: ["author_user_id"] },
      { fields: ["created_at"] },
    ],
  }
);

const OmsorgAuditLog = sequelize.define(
  "OmsorgAuditLog",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    actor_user_id: { type: DataTypes.INTEGER, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: false },
    entity_type: { type: DataTypes.STRING, allowNull: false },
    entity_id: { type: DataTypes.STRING, allowNull: true },
    ip_address: { type: DataTypes.STRING, allowNull: true },
    metadata: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "omsorg_audit_logs",
    timestamps: false,
    indexes: [{ fields: ["actor_user_id"] }, { fields: ["entity_type"] }, { fields: ["created_at"] }],
  }
);

const OmsorgHealthTool = sequelize.define(
  "OmsorgHealthTool",
  {
    id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "planlagt" },
    baerum_relevant: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    digital_tilsyn_relevant: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    integration_notes: { type: DataTypes.TEXT, allowNull: false },
    source_url: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "omsorg_health_tools",
    timestamps: false,
    indexes: [{ fields: ["category"] }, { fields: ["status"] }, { fields: ["baerum_relevant"] }],
  }
);

const OmsorgDigitalSupervisionRoom = sequelize.define(
  "OmsorgDigitalSupervisionRoom",
  {
    id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    room_name: { type: DataTypes.STRING, allowNull: false },
    department: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "ok" },
    last_event_at: { type: DataTypes.DATE, allowNull: true },
    next_check_at: { type: DataTypes.DATE, allowNull: true },
    sensor_types: { type: DataTypes.TEXT, allowNull: false, defaultValue: "[]" },
    open_tasks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "omsorg_digital_supervision_rooms",
    timestamps: false,
    indexes: [{ fields: ["department"] }, { fields: ["status"] }, { fields: ["next_check_at"] }],
  }
);

const OmsorgDeviation = sequelize.define(
  "OmsorgDeviation",
  {
    id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    severity: { type: DataTypes.STRING, allowNull: false, defaultValue: "middels" },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "apen" },
    department: { type: DataTypes.STRING, allowNull: false },
    source: { type: DataTypes.STRING, allowNull: false },
    reported_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    due_at: { type: DataTypes.DATE, allowNull: true },
    responsible_role: { type: DataTypes.STRING, allowNull: false },
    related_room: { type: DataTypes.STRING, allowNull: true },
    tiltak: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "omsorg_deviations",
    timestamps: false,
    indexes: [{ fields: ["status"] }, { fields: ["severity"] }, { fields: ["department"] }, { fields: ["reported_at"] }],
  }
);

const OmsorgImplementationState = sequelize.define(
  "OmsorgImplementationState",
  {
    id: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
    state_json: { type: DataTypes.TEXT, allowNull: false },
    schema_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    updated_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "omsorg_implementation_states",
    timestamps: false,
    indexes: [{ fields: ["updated_at"] }, { fields: ["updated_by_user_id"] }],
  }
);

const OmsorgPushSubscription = sequelize.define(
  "OmsorgPushSubscription",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    endpoint: { type: DataTypes.TEXT, allowNull: false, unique: true },
    subscription_json: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "omsorg_push_subscriptions",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }],
  }
);

OmsorgCourse.hasMany(OmsorgActivity, { foreignKey: "course_id" });
OmsorgActivity.belongsTo(OmsorgCourse, { foreignKey: "course_id" });

OmsorgCourse.hasMany(OmsorgCheckoff, { foreignKey: "course_id" });
OmsorgActivity.hasMany(OmsorgCheckoff, { foreignKey: "activity_id" });
OmsorgCheckoff.belongsTo(OmsorgCourse, { foreignKey: "course_id" });
OmsorgCheckoff.belongsTo(OmsorgActivity, { foreignKey: "activity_id" });
OmsorgCheckoff.belongsTo(User, { as: "employee", foreignKey: "employee_id" });
OmsorgCheckoff.belongsTo(User, { as: "checkedBy", foreignKey: "checked_by_user_id" });
User.hasMany(OmsorgPushSubscription, { foreignKey: "user_id" });
OmsorgPushSubscription.belongsTo(User, { foreignKey: "user_id" });

OmsorgComment.belongsTo(OmsorgCourse, { foreignKey: "course_id" });
OmsorgComment.belongsTo(OmsorgActivity, { foreignKey: "activity_id" });
OmsorgComment.belongsTo(User, { as: "employee", foreignKey: "employee_id" });
OmsorgComment.belongsTo(User, { as: "author", foreignKey: "author_user_id" });

OmsorgAuditLog.belongsTo(User, { as: "actor", foreignKey: "actor_user_id" });

OmsorgImplementationState.belongsTo(User, { as: "updatedBy", foreignKey: "updated_by_user_id" });

async function connectMongoWithRetry(maxAttempts = 8) {
  const { getMongoConfig } = require("./services/database/mongodb");
  if (!getMongoConfig().enabled) return { enabled: false };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await connectMongo();
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      console.warn(
        `MongoDB connect attempt ${attempt}/${maxAttempts} failed, retrying...`
      );
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function connectRedisWithRetry(maxAttempts = 8) {
  const { getRedisConfig } = require("./services/database/redis");
  if (!getRedisConfig().enabled) return { enabled: false };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await connectRedis();
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      console.warn(
        `Redis connect attempt ${attempt}/${maxAttempts} failed, retrying...`
      );
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function connectDatabase() {
  const dialect = sequelize.getDialect();
  const isProd = String(process.env.NODE_ENV || "").trim() === "production";
  const maxAttempts = dialect === "postgres" ? 8 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sequelize.authenticate();
      console.log(`🗄️ SQL database connected (${dialect})`);
      break;
    } catch (error) {
      if (attempt >= maxAttempts) throw error;
      console.warn(
        `Database connect attempt ${attempt}/${maxAttempts} failed, retrying...`
      );
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  try {
    const force = String(process.env.FORCE_DB_SYNC || "").trim() === "1";

    if (dialect === "sqlite") {
      await sequelize.query("PRAGMA foreign_keys = OFF;");
    }

    if (force) {
      console.log("⚠️ FORCE_DB_SYNC=1 → dropping & recreating all tables");
      await sequelize.sync({ force: true });
      console.log("📦 Database force-synced");
    } else if (isProd && dialect !== "sqlite") {
      await sequelize.sync();
      console.log("📦 Database synced (production)");
    } else {
      await sequelize.sync({ alter: true });
      console.log("📦 Database synced");
    }

    if (dialect === "sqlite") {
      await sequelize.query("PRAGMA foreign_keys = ON;");
    }

    const mongo = await connectMongoWithRetry();
    if (mongo.enabled) console.log("🍃 MongoDB connected");

    const redis = await connectRedisWithRetry();
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
  OmsorgCourse,
  OmsorgActivity,
  OmsorgCheckoff,
  OmsorgComment,
  OmsorgAuditLog,
  OmsorgHealthTool,
  OmsorgDigitalSupervisionRoom,
  OmsorgDeviation,
  OmsorgImplementationState,
  OmsorgPushSubscription,
};
