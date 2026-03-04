const {
  appendLog,
  setStatus,
  getVM,
  getLive,
  endLive,
} = require("./vm.store");

// Optional: bill usage when VM starts (won't crash if User model not present)
let User = null;
try {
  // adjust path if your runner.js location differs
  User = require("../models/User");
} catch {
  try {
    User = require("../models/User.js");
  } catch {
    User = null;
  }
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// Tries to extract the last JSON object in a text blob
function extractJsonBestEffort(text) {
  if (!text) return null;

  // First: look for fenced ```json blocks
  const fenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    const parsed = safeJsonParse(fenceMatch[1].trim(), null);
    if (parsed) return parsed;
  }

  // Fallback: last { ... } block
  const jsonStart = text.lastIndexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    const raw = text.slice(jsonStart, jsonEnd + 1);
    const parsed = safeJsonParse(raw, null);
    if (parsed) return parsed;
  }

  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function assertNotCancelled(lv) {
  if (lv?.cancelRequested) {
    const err = new Error("cancelled");
    err.code = "CANCELLED";
    throw err;
  }
}

async function incrementUserUsageIfPossible(owner_user_id) {
  if (!User || !owner_user_id) return;
  try {
    // Support either Sequelize model export patterns:
    // module.exports = User OR module.exports = { User }
    const UserModel = User?.User || User;
    const user = await UserModel.findByPk(owner_user_id);
    if (!user) return;

    // If you added vm_runs_used, increment it
    if (typeof user.increment === "function" && user.vm_runs_used !== undefined) {
      await user.increment("vm_runs_used");
    }
  } catch {
    // never crash the VM if billing fails
  }
}

async function runVM({ vmId, openai, model }) {
  const lv = getLive(vmId);

  try {
    const row = await getVM(vmId);
    if (!row) throw new Error("VM missing");

    await setStatus(vmId, {
      status: "running",
      started_at: new Date(),
      finished_at: null,
      error: null,
      progress: 0,
    });

    // Bill one run only when it ACTUALLY starts
    await incrementUserUsageIfPossible(row.owner_user_id);

    await appendLog(vmId, `🚀 Booting ${row.type}...`);
    await appendLog(vmId, `🧾 Task: ${row.task}`);
    await appendLog(vmId, `🧠 Model: ${model}`);
    await appendLog(vmId, "🧩 Planning...");

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
- Keep each log line short (1 sentence).
- Do NOT reveal hidden chain-of-thought. Use "Planning..." not detailed reasoning.
- Be practical and specific.
- You work in small steps.

You MUST respond ONLY as JSON with this schema:
{
  "kind": "plan" | "step" | "final",
  "logLines": string[],         // 1-6 short lines to stream
  "progress": number,           // 0-100
  "final": {                    // only when kind="final"
    "summary": string,
    "steps": string[],
    "deliverables": string[]
  }
}

Constraints:
- progress must never go backwards.
- kind="plan" only at the beginning.
- kind="final" only when finished.
`.trim();

    const role = typePromptMap[row.type] || typePromptMap.CodeBot;

    // ---- Step-based agent loop ----
    let memory = "";
    let progress = 0;

    // tweak this: more steps = more “worker-like”
    const MAX_STEPS = 10;

    for (let i = 0; i < MAX_STEPS; i++) {
      assertNotCancelled(lv);

      // First iteration asks for plan, later asks for next step
      const userPrompt =
        i === 0
          ? `Task: ${row.task}\nReturn kind="plan" with short streamable logLines.`
          : `Task: ${row.task}\nMemory:\n${memory}\nReturn the next action. Use kind="step" unless finished (then kind="final").`;

      const resp = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "system", content: role },
          { role: "user", content: userPrompt },
        ],
      });

      assertNotCancelled(lv);

      const text = resp?.choices?.[0]?.message?.content || "";
      const obj = safeJsonParse(text, null);

      // If model didn’t follow JSON-only, salvage:
      const action =
        obj && typeof obj === "object"
          ? obj
          : {
              kind: i === 0 ? "plan" : "step",
              logLines: text.split("\n").filter(Boolean).slice(0, 6),
              progress: Math.min(95, progress + 10),
            };

      // Normalize log lines
      const lines = Array.isArray(action.logLines)
        ? action.logLines
        : String(action.logLines || "")
            .split("\n")
            .filter(Boolean)
            .slice(0, 6);

      // Normalize progress
      const nextProgressRaw = Number(action.progress ?? progress);
      const nextProgress = Math.max(progress, Math.min(100, isFinite(nextProgressRaw) ? nextProgressRaw : progress));
      progress = nextProgress;

      // Stream lines
      for (const ln of lines) {
        assertNotCancelled(lv);
        await appendLog(vmId, ln);
      }

      // Persist progress
      await setStatus(vmId, { progress });

      // Update memory (keep it short to avoid token bloat)
      memory += `\n[${action.kind}] ${lines.join(" | ")}`;
      if (memory.length > 4000) memory = memory.slice(memory.length - 4000);

      // Small realism delay so it feels alive
      await sleep(200);

      // Finalize if done
      if (action.kind === "final") {
        const finalObj =
          action.final && typeof action.final === "object"
            ? action.final
            : extractJsonBestEffort(text) || {
                summary: "Completed task.",
                steps: [],
                deliverables: [],
              };

        await setStatus(vmId, {
          status: "done",
          finished_at: new Date(),
          error: null,
          progress: 100,
          result_json: JSON.stringify(finalObj),
        });

        await appendLog(vmId, "🎉 Done.");

        if (lv) lv.emitter.emit("done", { ok: true, status: "done" });
        endLive(vmId);
        return;
      }
    }

    // If we hit max steps, force a completion (still monetizable)
    const fallbackFinal = {
      summary: "Reached step limit. Partial completion.",
      steps: [],
      deliverables: [],
    };

    await setStatus(vmId, {
      status: "done",
      finished_at: new Date(),
      error: null,
      progress: 100,
      result_json: JSON.stringify(fallbackFinal),
    });

    await appendLog(vmId, "✅ Finished (step limit reached).");
    if (lv) lv.emitter.emit("done", { ok: true, status: "done", partial: true });
    endLive(vmId);
  } catch (err) {
    const message = err?.message || String(err);
    const lv2 = getLive(vmId);

    if (message === "cancelled" || err?.code === "CANCELLED") {
      await setStatus(vmId, {
        status: "cancelled",
        finished_at: new Date(),
        error: null,
      });
      await appendLog(vmId, "🛑 Cancelled.");
      if (lv2) lv2.emitter.emit("done", { ok: false, cancelled: true });
      endLive(vmId);
      return;
    }

    await setStatus(vmId, {
      status: "error",
      finished_at: new Date(),
      error: message,
    });
    await appendLog(vmId, `❌ Error: ${message}`);
    if (lv2) lv2.emitter.emit("done", { ok: false, error: message });
    endLive(vmId);
  }
}

module.exports = { runVM };