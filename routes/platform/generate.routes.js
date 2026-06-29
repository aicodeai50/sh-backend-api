const express = require("express");
const { estimateTokens } = require("../../services/platform/tokens");

function buildGenerateRouter({ openai, model }) {
  const router = express.Router();

  router.post("/", async (req, res) => {
    try {
      if (!openai) {
        return res.status(500).json({ error: "OPENAI_API_KEY missing on server" });
      }

      const prompt = String(req.body?.prompt || req.body?.message || "").trim();
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
      }

      if (req.usageTracker) req.usageTracker.setInput(prompt);

      const system = String(req.body?.system || "You are a helpful assistant.").trim();

      const completion = await openai.chat.completions.create({
        model: req.body?.model || model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });

      const result = completion.choices?.[0]?.message?.content || "";

      if (req.usageTracker) {
        if (completion.usage) {
          req.usageTracker.setFromOpenAI(completion.usage);
        } else {
          req.usageTracker.setOutput(result);
        }
      }

      res.json({
        ok: true,
        result,
        model: completion.model || model,
      });
    } catch (err) {
      res.status(500).json({ error: "Generate failed", details: err.message });
    }
  });

  return router;
}

module.exports = buildGenerateRouter;
