const { MongoClient } = require("mongodb");
const { getMongoConfig } = require("../../config/database.config");

let client = null;
let db = null;
let connectPromise = null;

async function connectMongo() {
  const config = getMongoConfig();
  if (!config.enabled) {
    return { enabled: false, client: null, db: null };
  }

  if (db) return { enabled: true, client, db };

  if (!connectPromise) {
    connectPromise = (async () => {
      client = new MongoClient(config.uri);
      await client.connect();
      db = client.db(config.dbName);
      return { enabled: true, client, db };
    })().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }

  return connectPromise;
}

async function getMongoDb() {
  const result = await connectMongo();
  return result.db;
}

async function pingMongo() {
  const config = getMongoConfig();
  if (!config.enabled) {
    return { enabled: false, ok: false, message: "MongoDB not configured" };
  }

  try {
    const database = await getMongoDb();
    await database.command({ ping: 1 });
    return { enabled: true, ok: true, db: config.dbName };
  } catch (err) {
    return {
      enabled: true,
      ok: false,
      db: config.dbName,
      error: err?.message || String(err),
    };
  }
}

async function closeMongo() {
  if (client) {
    await client.close();
  }
  client = null;
  db = null;
  connectPromise = null;
}

module.exports = {
  connectMongo,
  getMongoDb,
  pingMongo,
  closeMongo,
  getMongoConfig,
};
