const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { getSqlConfig } = require("../config/database.config");

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    const config = getSqlConfig();
    const dbPath =
      config.dialect === "sqlite"
        ? config.storage
        : path.resolve(__dirname, "..", "database.sqlite");

    dbPromise = open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  }
  return dbPromise;
}

module.exports = { getDb };
