const express = require("express");
const {
  createVM,
  getVM,
  listVMsByOwner,
  cancelVM,
  getLive,
  countActiveVMsForUser,
} = require("../../services/vm.store");
const { runVM } = require("../../services/vm.runner");
const { getActiveVmLimitError } = require("../../services/limits.service");
const { incrementVmRunsUsed } = require("../../services/user.service");
const { Vm } = require("../../database");

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function ensureOwner(req, res, vmRow) {
  if (!vmRow) {
    res.status(404).json({ error: "VM not found" });
    return false;
  }
  if (vmRow.owner_user_id !== req.user.id) {
    res.status(403).json({ error: "Forbidden (not your VM)" });
    return false;
  }
  return true;
}

module.exports = function buildVmRouter({ openai, model }) {
  const router = express.Router();

  // ✅ GET /vm/my
  router.get("/my", async (req, res) => {
    const rows = await listVMsByOwner(req.user.id);
    res.json({
      vms: rows.map((r) => ({
        id: r.id,
        type: r.type,
        task: r.task,
        status: r.status,
        created_at: r.created_at,
        started_at: r.started_at,
        finished_at: r.finished_at,
        error: r.error,
      })),
    });
  });

  // ✅ POST /vm/create
  router.post("/create", async (req, res) => {
    if (!openai) return res.status(500).json({ error: "OPENAI not configured" });

    const { type, task } = req.body || {};
    if (!type || !task) {
      return res.status(400).json({ error: "type and task are required" });
    }

    const active = countActiveVMsForUser(req.user.id);
    const limitError = getActiveVmLimitError(req.user, active);
    if (limitError) {
      return res.status(429).json(limitError);
    }

    const vm = createVM({
      type,
      task,
      owner_user_id: req.user.id,
    });

    try {
      await Vm.create({
        id: vm.id,
        owner_user_id: req.user.id,
        type,
        task,
        status: "queued",
        created_at: new Date(),
      });
      await incrementVmRunsUsed(req.user.id, 1);
    } catch (err) {
      console.error("VM persist error:", err?.message || err);
    }

    runVM({ vmId: vm.id, openai, model }).catch(() => {});

    res.json({ vm_id: vm.id, status: "queued" });
  });

  // ✅ GET /vm/:id
  router.get("/:id", async (req, res) => {
    const row = await getVM(req.params.id);
    if (!ensureOwner(req, res, row)) return;

    res.json({
      id: row.id,
      owner_user_id: row.owner_user_id,
      type: row.type,
      task: row.task,
      status: row.status,
      created_at: row.created_at,
      started_at: row.started_at,
      finished_at: row.finished_at,
      error: row.error,
      result: row.result_json ? safeJsonParse(row.result_json, null) : null,
    });
  });

  // ✅ GET /vm/:id/stream  (SSE)
  router.get("/:id/stream", async (req, res) => {
    const row = await getVM(req.params.id);
    if (!ensureOwner(req, res, row)) return;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // replay stored logs first
    const logs = safeJsonParse(row.logs_json, []);
    for (const entry of logs) {
      res.write(`event: log\n`);
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }

    // if not live anymore, end
    const lv = getLive(row.id);
    if (!lv) {
      res.write(`event: done\n`);
      res.write(
        `data: ${JSON.stringify({ ok: row.status === "done", status: row.status })}\n\n`
      );
      return res.end();
    }

    const onLog = (entry) => {
      res.write(`event: log\n`);
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    const onDone = (payload) => {
      res.write(`event: done\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      res.end();
    };

    lv.emitter.on("log", onLog);
    lv.emitter.on("done", onDone);

    req.on("close", () => {
      lv.emitter.off("log", onLog);
      lv.emitter.off("done", onDone);
    });
  });

  // ✅ POST /vm/:id/cancel
  router.post("/:id/cancel", async (req, res) => {
    const row = await getVM(req.params.id);
    if (!ensureOwner(req, res, row)) return;

    const ok = await cancelVM(row.id);
    if (!ok) return res.status(400).json({ error: "VM not running" });

    res.json({ ok: true, status: "cancel_requested" });
  });

  return router;
};

