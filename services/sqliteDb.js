const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    const dbPath = path.resolve(__dirname, "..", "database.sqlite");
    dbPromise = open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  }
  return dbPromise;
}

module.exports = { getDb };
