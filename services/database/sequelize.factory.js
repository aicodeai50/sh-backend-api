const { Sequelize } = require("sequelize");
const { getSqlConfig } = require("../../config/database.config");

function createSequelize() {
  const config = getSqlConfig();

  if (config.dialect === "sqlite") {
    return new Sequelize({
      dialect: "sqlite",
      storage: config.storage,
      logging: config.logging ? console.log : false,
    });
  }

  return new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: config.logging ? console.log : false,
    dialectOptions: config.dialectOptions,
    pool: config.pool,
  });
}

module.exports = { createSequelize, getSqlConfig };
