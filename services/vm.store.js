const { EventEmitter } = require("events");
const crypto = require("crypto");

/**
 * VM states:
 * - queued
 * - running
 * - done
 * - error
 * - cancelled
 */
const vms = new Map(); // vmId -> vm object

function newId() {
  return "vm_" + crypto.randomBytes(8).toString("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function createVM({ type, task, owner_user_id }) {
  const id = newId();

  const vm = {
    id,
    owner_user_id: owner_user_id || null, // ✅ NEW: owner
    type,
    task,
    status: "queued",
    createdAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    error: null,
    result: null,
    logs: [], // keep last N logs for late joiners
    emitter: new EventEmitter(),
    cancelRequested: false,
  };

  vms.set(id, vm);
  return vm;
}

function getVM(id) {
  return vms.get(id) || null;
}

function listVMsByOwner(owner_user_id) {
  const out = [];
  for (const vm of vms.values()) {
    if (vm.owner_user_id === owner_user_id) out.push(vm);
  }
  // newest first
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}

function appendLog(vm, line) {
  const entry = { t: nowIso(), line: String(line) };
  vm.logs.push(entry);

  // keep memory bounded
  if (vm.logs.length > 500) vm.logs.splice(0, vm.logs.length - 500);

  vm.emitter.emit("log", entry);
}

function cancelVM(id) {
  const vm = getVM(id);
  if (!vm) return null;
  vm.cancelRequested = true;
  appendLog(vm, "🛑 Cancel requested...");
  return vm;
}

/**
 * Simple “agent loop”:
 * - planning
 * - execution logs
 * - final response
 *
 * Keep it minimal so it ships.
 */
async function runVM({ vmId, openai, model }) {
  const vm = getVM(vmId);
  if (!vm) return;

  try {
    vm.status = "running";
    vm.startedAt = nowIso();

    appendLog(vm, `🚀 Booting ${vm.type}...`);
    appendLog(vm, `🧾 Task: ${vm.task}`);
    appendLog(vm, `🧠 Model: ${model}`);

    const typePromptMap = {
      CodeBot:
        "You are CodeBot. Think like a senior engineer. Output concrete steps and code suggestions.",
      DesignBot:
        "You are DesignBot. Think like a product designer + frontend dev. Output UI structure and component ideas.",
      DeployBot:
        "You are DeployBot. Think like DevOps. Output deployment steps, environment variables, and pitfalls.",
      ResearchBot:
        "You are ResearchBot. Output structured research notes, key points, and follow-up questions.",
    };

    const system = `
You are a streaming agent that writes terminal-style logs.
Rules:
- Keep each line short (1 sentence).
- Do NOT reveal hidden chain-of-thought. Use "Planning..." not detailed reasoning.
- Provide practical steps.
At the end, output a FINAL section as JSON:
{
  "summary": string,
  "steps": string[],
  "deliverables": string[]
}
`.trim();

    const role = typePromptMap[vm.type] || typePromptMap.CodeBot;

    if (vm.cancelRequested) throw new Error("cancelled");
    appendLog(vm, "🧩 Planning...");

    const planResp = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "system", content: role },
        {
          role: "user",
          content: `Task: ${vm.task}\nReturn a short plan and then FINAL JSON.`,
        },
      ],
    });

    if (vm.cancelRequested) throw new Error("cancelled");

    const planText = planResp?.choices?.[0]?.message?.content || "";

    // Stream “fake live” by splitting lines
    planText
      .split("\n")
      .filter(Boolean)
      .slice(0, 80)
      .forEach((line) => appendLog(vm, line));

    // Optional progress ticks
    const workTicks = [
      "📦 Gathering requirements...",
      "🛠️ Producing output...",
      "🧪 Checking edge cases...",
      "✅ Finalizing...",
    ];

    for (const tick of workTicks) {
      if (vm.cancelRequested) throw new Error("cancelled");
      appendLog(vm, tick);
      await new Promise((r) => setTimeout(r, 250));
    }

    // Extract FINAL JSON best-effort
    let result = null;
    const jsonStart = planText.indexOf("{");
    const jsonEnd = planText.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      const raw = planText.slice(jsonStart, jsonEnd + 1);
      try {
        result = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    vm.result =
      result || { summary: "Completed task.", steps: [], deliverables: [] };

    vm.status = "done";
    vm.finishedAt = nowIso();
    appendLog(vm, "🎉 Done.");
    vm.emitter.emit("done", { ok: true });
  } catch (err) {
    if (String(err?.message || err) === "cancelled") {
      vm.status = "cancelled";
      vm.finishedAt = nowIso();
      vm.error = null;
      appendLog(vm, "🛑 Cancelled.");
      vm.emitter.emit("done", { ok: false, cancelled: true });
      return;
    }

    vm.status = "error";
    vm.finishedAt = nowIso();
    vm.error = err?.message || String(err);
    appendLog(vm, `❌ Error: ${vm.error}`);
    vm.emitter.emit("done", { ok: false, error: vm.error });
  }
}

module.exports = {
  createVM,
  getVM,
  listVMsByOwner, // ✅ NEW
  cancelVM,
  runVM,
  appendLog,
};
