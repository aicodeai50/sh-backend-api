const { getSqlConfig } = require("../../config/database.config");
const { pingMongo } = require("./mongodb");
const { pingRedis } = require("./redis");

async function getDatabaseHealth(sequelize) {
  const sql = getSqlConfig();

  let sqlStatus = { dialect: sql.dialect, ok: false };
  try {
    await sequelize.authenticate();
    sqlStatus = {
      dialect: sql.dialect,
      ok: true,
      database: sql.dialect === "sqlite" ? sql.storage : sql.database,
      host: sql.host || null,
    };
  } catch (err) {
    sqlStatus.error = err?.message || String(err);
  }

  const [mongo, redis] = await Promise.all([pingMongo(), pingRedis()]);

  return {
    sql: sqlStatus,
    mongodb: mongo,
    redis,
  };
}

module.exports = {
  getDatabaseHealth,
};
