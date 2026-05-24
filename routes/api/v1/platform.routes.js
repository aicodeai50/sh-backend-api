const express = require("express");
const { getPlatformStatus } = require("../../../services/database/platform.status");
const { getCacheBackend } = require("../../../services/storage/cache.store");
const { getDocumentBackend } = require("../../../services/storage/document.store");
const { getSqlConfig } = require("../../../config/database.config");
const { getCorsConfig } = require("../../../config/platform.config");

function buildPlatformRouter({ sequelize, buildTag }) {
  const router = express.Router();

  router.get("/health", async (_req, res) => {
    try {
      const status = await getPlatformStatus(sequelize);
      res.json({ ...status, build: buildTag });
    } catch (err) {
      res.status(500).json({
        error: "Platform health failed",
        details: err?.message || String(err),
        build: buildTag,
      });
    }
  });

  router.get("/manifest", (_req, res) => {
    const cors = getCorsConfig();

    res.json({
      ok: true,
      name: "sh-backend-api",
      version: "1.0.0",
      build: buildTag,
      description:
        "Universal backend for any frontend. Auth, SQL, documents, cache, files, and AI.",
      auth: {
        apiKeyHeader: "x-sh-api-key",
        bearerToken: "Authorization: Bearer <jwt>",
        cookie: process.env.COOKIE_NAME || "shynvo_session",
        endpoints: {
          register: "POST /auth/register",
          login: "POST /auth/login",
          logout: "POST /auth/logout",
          me: "GET /auth/me",
        },
      },
      storage: {
        sql: {
          dialect: getSqlConfig().dialect,
          genericRecords: "Use /api/v1/docs/:collection when MongoDB is off",
        },
        documents: {
          backend: getDocumentBackend(),
          list: "GET /api/v1/docs/:collection",
          get: "GET /api/v1/docs/:collection/:id",
          create: "POST /api/v1/docs/:collection",
          update: "PATCH /api/v1/docs/:collection/:id",
          delete: "DELETE /api/v1/docs/:collection/:id",
        },
        cache: {
          backend: getCacheBackend(),
          get: "GET /api/v1/cache/:key",
          set: "POST /api/v1/cache/:key",
          delete: "DELETE /api/v1/cache/:key",
        },
        files: {
          upload: "POST /api/v1/files/upload",
          get: "GET /api/v1/files/:filename",
          list: "GET /api/v1/files",
        },
      },
      ai: {
        chat: "POST /api/public/chat",
        search: "POST /api/public/search",
        quiz: "POST /ai/quiz",
        flashcards: "POST /ai/flashcards",
        codeExplainer: "POST /ai/code-explainer",
        researchFinder: "POST /ai/research-finder",
        interviewSimulator: "POST /ai/interview-simulator",
      },
      cors: {
        allowAll: cors.allowAll,
        origins: cors.origins,
      },
      requiredHeaders: ["x-sh-api-key", "Content-Type"],
      optionalHeaders: ["Authorization"],
    });
  });

  return router;
}

module.exports = buildPlatformRouter;
