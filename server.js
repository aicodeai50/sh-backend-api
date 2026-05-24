/**
 * SH BACKEND API — FINAL STABLE VERSION
 * Platform: Railway
 */

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const OpenAI = require("openai");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

// ✅ connect Sequelize + sync models
const { connectDatabase, sequelize } = require("./database");

// ===============================
// ENV
// ===============================
dotenv.config({
  path: path.resolve(__dirname, ".env"),
});

// ===============================
// IMPORT ROUTES
// ===============================
const aiRoutes = require("./routes/ai/ai.routes");
const buildVmRouter = require("./routes/vm/vm.routes");
const authRoutes = require("./routes/auth.routes");
const { requireUser } = require("./middleware/requireUser");

// ✅ Company routes
const companyRoutes = require("./routes/company/company.routes");
const buildDataRouter = require("./routes/data/data.routes");
const buildApiV1Router = require("./routes/api/v1");
const { optionalUser } = require("./middleware/optionalUser");
const { getCorsConfig } = require("./config/platform.config");

// ===============================
// APP
// ===============================
const app = express();
app.set("trust proxy", 1);

// ===============================
// CONFIG
// ===============================
const PORT = process.env.PORT || 8080;

// Comma-separated list:
// FRONTEND_ORIGIN=https://shynvo-web.vercel.app,https://shynvo.app,http://localhost:3000
const corsConfig = getCorsConfig();

const SH_API_KEY = (process.env.SH_API_KEY || "").trim();
const JWT_SECRET = (process.env.JWT_SECRET || "").trim();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const BUILD_TAG = process.env.RAILWAY_GIT_COMMIT_SHA || `local-${Date.now()}`;

// ===============================
// HARD FAILS (IMPORTANT)
// ===============================
if (!SH_API_KEY) console.error("❌ SH_API_KEY missing");
if (!JWT_SECRET) console.error("❌ JWT_SECRET missing");
if (!OPENAI_API_KEY) console.error("⚠️ OPENAI_API_KEY missing (AI/VM will fail)");

// ===============================
// MIDDLEWARE
// ===============================
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

// CORS must allow cookies (credentials: true)
const allowedOrigins = corsConfig.origins;

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (corsConfig.allowAll || allowedOrigins.includes("*")) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-sh-api-key", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ===============================
// SH API KEY GUARD
// ===============================
function requireShApiKey(req, res, next) {
  const key = String(req.headers["x-sh-api-key"] || "").trim();

  if (!SH_API_KEY) {
    return res.status(500).json({
      error: "SH_API_KEY missing on server",
      build: BUILD_TAG,
    });
  }

  if (!key || key !== SH_API_KEY) {
    return res.status(401).json({
      error: "Invalid SH API key",
      build: BUILD_TAG,
    });
  }

  next();
}

// ===============================
// RATE LIMIT (SIMPLE)
// ===============================
const WINDOW_MS = 60_000;
const MAX_REQ = 25;
const hits = new Map();

function rateLimit(req, res, next) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, start: now };

  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count++;
  hits.set(ip, entry);

  if (entry.count > MAX_REQ) {
    return res.status(429).json({
      error: "Too many requests",
      build: BUILD_TAG,
    });
  }

  next();
}

// ===============================
// OPENAI CLIENT
// ===============================
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
app.set("openai", openai);
app.set("openai_model", OPENAI_MODEL);

// ===============================
// HEALTH + DEBUG
// ===============================
app.get("/", (_, res) => res.send("OK"));
app.get("/health", (_, res) => res.json({ ok: true, build: BUILD_TAG }));

app.get("/debug/routes", (_, res) => {
  const routes = [];
  const stack = app._router?.stack || [];
  for (const m of stack) {
    if (m.route) {
      routes.push({
        path: m.route.path,
        methods: Object.keys(m.route.methods).map((x) => x.toUpperCase()),
      });
    }
  }
  res.json({ ok: true, routes, build: BUILD_TAG });
});

app.get("/debug/sh-api-key-check", (_, res) => {
  const k = process.env.SH_API_KEY || "";
  res.json({
    exists: Boolean(k),
    length: k.length,
    trimmedLength: k.trim().length,
    hasNewline: k.includes("\n") || k.includes("\r"),
    hasSpaceEnds: k !== k.trim(),
    build: BUILD_TAG,
  });
});

app.get("/debug/openai-key-check", (_, res) => {
  const k = (process.env.OPENAI_API_KEY || "").trim();
  res.json({
    exists: Boolean(k),
    startsWithSk: k.startsWith("sk-") || k.startsWith("sk-proj-"),
    length: k.length,
    build: BUILD_TAG,
  });
});

app.get("/debug/jwt-check", (_, res) =>
  res.json({
    hasJwtSecret: Boolean(JWT_SECRET),
    jwtLength: JWT_SECRET.length,
    expiresIn: JWT_EXPIRES_IN,
    build: BUILD_TAG,
  })
);

// ===============================
// ROUTES
// ===============================

// ✅ Make /auth consistent: protected by SH key too
app.use("/auth", requireShApiKey, rateLimit, authRoutes);

app.use("/ai", requireShApiKey, rateLimit, aiRoutes);

const vmRoutes = buildVmRouter({ openai, model: OPENAI_MODEL });
app.use("/vm", requireShApiKey, rateLimit, requireUser(), vmRoutes);

app.use("/company", requireShApiKey, rateLimit, requireUser(), companyRoutes);

const dataRoutes = buildDataRouter({ sequelize, buildTag: BUILD_TAG });
app.use("/data", requireShApiKey, rateLimit, optionalUser(), dataRoutes);

const apiV1Routes = buildApiV1Router({ sequelize, buildTag: BUILD_TAG });
app.use("/api/v1", requireShApiKey, rateLimit, optionalUser(), apiV1Routes);

// Public chat (used by frontend guide)
app.post("/api/public/chat", requireShApiKey, rateLimit, async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({
        error: "OPENAI_API_KEY missing",
        build: BUILD_TAG,
      });
    }

    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const fallbackMessage = String(req.body?.message || "").trim();
    const fallbackSystemPrompt = String(req.body?.systemPrompt || "").trim();
    const imageDataUrl = String(req.body?.imageDataUrl || "").trim();

    let messages =
      rawMessages.length > 0
        ? rawMessages
        : [
            ...(fallbackSystemPrompt
              ? [{ role: "system", content: fallbackSystemPrompt }]
              : []),
            ...(fallbackMessage
              ? [{ role: "user", content: fallbackMessage }]
              : []),
          ];

    console.log("PUBLIC CHAT DEBUG", {
      hasImageDataUrl: Boolean(imageDataUrl),
      imagePrefix: imageDataUrl ? imageDataUrl.slice(0, 40) : "",
      messageCount: messages.length,
      usedFallback: rawMessages.length === 0,
      hasFallbackMessage: Boolean(fallbackMessage),
      hasFallbackSystemPrompt: Boolean(fallbackSystemPrompt),
      lastRole: messages.length ? messages[messages.length - 1]?.role : null,
      lastContentType: messages.length ? typeof messages[messages.length - 1]?.content : null,
    });

    if (imageDataUrl) {
      const lastUserIndex = [...messages]
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m && m.role === "user")
        .map(({ i }) => i)
        .pop();

      if (typeof lastUserIndex === "number") {
        messages = messages.map((msg, index) => {
          if (index !== lastUserIndex) return msg;

          return {
            role: "user",
            content: [
              {
                type: "text",
                text: typeof msg.content === "string" ? msg.content : "",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageDataUrl,
                },
              },
            ],
          };
        });
      }
    }

    if (!Array.isArray(messages) || messages.length < 1) {
      return res.status(400).json({
        error: "Missing chat input",
        details: "Provide messages[] or message.",
        build: BUILD_TAG,
      });
    }

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
    });

    return res.json({
      reply: completion.choices?.[0]?.message?.content || "",
      build: BUILD_TAG,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Chat error",
      details: err?.message || String(err),
      build: BUILD_TAG,
    });
  }
});

// Public search (used by frontend Search Shynvo)
app.post("/api/public/search", requireShApiKey, rateLimit, async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({
        error: "OPENAI_API_KEY missing",
        build: BUILD_TAG,
      });
    }

    const userInput =
      String(req.body?.query || req.body?.message || "").trim();

    if (!userInput) {
      return res.status(400).json({
        error: "Missing search query",
        build: BUILD_TAG,
      });
    }

    const messages = [
      {
        role: "system",
        content:
          "You are Shynvo Search. Answer clearly, helpfully, and concisely. " +
          "You help users understand the Shynvo platform, its environments, and general questions. " +
          "If the user asks about Shynvo, explain the most relevant environment when useful. " +
          "Keep answers direct and readable.",
      },
      {
        role: "user",
        content: userInput,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
    });

    res.json({
      answer: completion.choices?.[0]?.message?.content || "",
      build: BUILD_TAG,
    });
  } catch (err) {
    res.status(500).json({
      error: "Search error",
      details: err?.message || String(err),
      build: BUILD_TAG,
    });
  }
});

// ===============================
// 404
// ===============================
app.use((req, res) =>
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    build: BUILD_TAG,
  })
);

// ===============================
// SAFETY (log crashes)
// ===============================
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

// ===============================
// START
// ===============================
(async () => {
  await connectDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ server running on ${PORT} | ${BUILD_TAG}`);
    console.log("✅ CORS allowed:", allowedOrigins);
  });
})();