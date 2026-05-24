const { ObjectId } = require("mongodb");
const { getMongoDb, getMongoConfig } = require("../database/mongodb");
const { GenericRecord } = require("../../database");
const { makeRecordId } = require("./memory.store");

function isValidObjectId(value) {
  return ObjectId.isValid(value) && String(new ObjectId(value)) === value;
}

function parseJsonField(raw, fallback = {}) {
  if (raw == null) return fallback;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getDocumentBackend() {
  return getMongoConfig().enabled ? "mongodb" : "sql";
}

async function listDocuments(collection, { limit = 50, filter = {} } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  if (getMongoConfig().enabled) {
    const db = await getMongoDb();
    const docs = await db
      .collection(collection)
      .find(filter)
      .limit(safeLimit)
      .toArray();
    return { backend: "mongodb", docs };
  }

  const rows = await GenericRecord.findAll({
    where: { namespace: collection },
    limit: safeLimit,
    order: [["updated_at", "DESC"]],
  });

  return {
    backend: "sql",
    docs: rows.map((row) => ({
      id: row.id,
      ...parseJsonField(row.data),
      _namespace: row.namespace,
      _owner_user_id: row.owner_user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
  };
}

async function getDocument(collection, id) {
  if (getMongoConfig().enabled) {
    const db = await getMongoDb();
    const query = isValidObjectId(id) ? { _id: new ObjectId(id) } : { _id: id };
    const doc = await db.collection(collection).findOne(query);
    return doc ? { backend: "mongodb", doc } : null;
  }

  const row = await GenericRecord.findOne({
    where: { namespace: collection, id: String(id) },
  });

  if (!row) return null;

  return {
    backend: "sql",
    doc: {
      id: row.id,
      ...parseJsonField(row.data),
      _namespace: row.namespace,
      _owner_user_id: row.owner_user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  };
}

async function createDocument(collection, payload, ownerUserId = null) {
  const body = { ...payload };
  delete body._id;

  if (getMongoConfig().enabled) {
    const db = await getMongoDb();
    const result = await db.collection(collection).insertOne({
      ...body,
      owner_user_id: ownerUserId,
      created_at: body.created_at || new Date(),
      updated_at: new Date(),
    });
    return { backend: "mongodb", id: String(result.insertedId) };
  }

  const id = body.id ? String(body.id) : makeRecordId();
  delete body.id;

  await GenericRecord.create({
    id,
    namespace: collection,
    data: JSON.stringify(body),
    owner_user_id: ownerUserId,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return { backend: "sql", id };
}

async function updateDocument(collection, id, payload) {
  const body = { ...payload };
  delete body._id;
  delete body.id;

  if (getMongoConfig().enabled) {
    const db = await getMongoDb();
    const query = isValidObjectId(id) ? { _id: new ObjectId(id) } : { _id: id };
    const result = await db.collection(collection).updateOne(query, {
      $set: { ...body, updated_at: new Date() },
    });
    return result.matchedCount ? { backend: "mongodb", id: String(id) } : null;
  }

  const row = await GenericRecord.findOne({
    where: { namespace: collection, id: String(id) },
  });
  if (!row) return null;

  const merged = {
    ...parseJsonField(row.data),
    ...body,
  };

  await row.update({
    data: JSON.stringify(merged),
    updated_at: new Date(),
  });

  return { backend: "sql", id: String(id) };
}

async function deleteDocument(collection, id) {
  if (getMongoConfig().enabled) {
    const db = await getMongoDb();
    const query = isValidObjectId(id) ? { _id: new ObjectId(id) } : { _id: id };
    const result = await db.collection(collection).deleteOne(query);
    return result.deletedCount > 0;
  }

  const deleted = await GenericRecord.destroy({
    where: { namespace: collection, id: String(id) },
  });
  return deleted > 0;
}

module.exports = {
  getDocumentBackend,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
};
