const express = require("express");
const { getGenericSqlTables } = require("../../../config/platform.config");

const SENSITIVE_FIELDS = new Set([
  "password",
  "password_hash",
  "authToken",
]);

function stripSensitive(row) {
  const json = row?.toJSON ? row.toJSON() : { ...row };
  for (const key of SENSITIVE_FIELDS) {
    delete json[key];
  }
  return json;
}

function buildSqlRouter({ sequelize }) {
  const router = express.Router();

  router.get("/tables", (_req, res) => {
    const allowed = getGenericSqlTables();
    const models = Object.keys(sequelize.models).filter((name) =>
      allowed.includes(name)
    );

    res.json({
      ok: true,
      tables: models.map((name) => ({
        name,
        tableName: sequelize.models[name].tableName,
      })),
    });
  });

  router.get("/:table", async (req, res) => {
    const table = String(req.params.table || "").trim();
    const Model = sequelize.models[table];
    const allowed = getGenericSqlTables();

    if (!Model || !allowed.includes(table)) {
      return res.status(404).json({ error: "Table not available" });
    }

    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const rows = await Model.findAll({ limit, offset, order: [["id", "DESC"]] });
    res.json({
      ok: true,
      table,
      count: rows.length,
      rows: rows.map(stripSensitive),
    });
  });

  router.get("/:table/:id", async (req, res) => {
    const table = String(req.params.table || "").trim();
    const id = req.params.id;
    const Model = sequelize.models[table];
    const allowed = getGenericSqlTables();

    if (!Model || !allowed.includes(table)) {
      return res.status(404).json({ error: "Table not available" });
    }

    const row = await Model.findByPk(id);
    if (!row) return res.status(404).json({ error: "Row not found" });

    res.json({ ok: true, row: stripSensitive(row) });
  });

  router.post("/:table", async (req, res) => {
    const table = String(req.params.table || "").trim();
    const Model = sequelize.models[table];
    const allowed = getGenericSqlTables();

    if (!Model || !allowed.includes(table)) {
      return res.status(404).json({ error: "Table not available" });
    }

    if (table === "User") {
      return res.status(403).json({
        error: "Use POST /auth/register to create users",
      });
    }

    const payload = req.body?.row ?? req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }

    const row = await Model.create(payload);
    res.status(201).json({ ok: true, row: stripSensitive(row) });
  });

  router.patch("/:table/:id", async (req, res) => {
    const table = String(req.params.table || "").trim();
    const id = req.params.id;
    const Model = sequelize.models[table];
    const allowed = getGenericSqlTables();

    if (!Model || !allowed.includes(table)) {
      return res.status(404).json({ error: "Table not available" });
    }

    if (table === "User") {
      return res.status(403).json({ error: "User updates not allowed here" });
    }

    const payload = req.body?.row ?? req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({ error: "Body must be a JSON object" });
    }

    const row = await Model.findByPk(id);
    if (!row) return res.status(404).json({ error: "Row not found" });

    await row.update(payload);
    res.json({ ok: true, row: stripSensitive(row) });
  });

  router.delete("/:table/:id", async (req, res) => {
    const table = String(req.params.table || "").trim();
    const id = req.params.id;
    const Model = sequelize.models[table];
    const allowed = getGenericSqlTables();

    if (!Model || !allowed.includes(table)) {
      return res.status(404).json({ error: "Table not available" });
    }

    if (table === "User") {
      return res.status(403).json({ error: "User deletes not allowed here" });
    }

    const deleted = await Model.destroy({ where: { id } });
    if (!deleted) return res.status(404).json({ error: "Row not found" });

    res.json({ ok: true, deleted: true });
  });

  return router;
}

module.exports = buildSqlRouter;
