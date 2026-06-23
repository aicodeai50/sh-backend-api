const express = require("express");
const buildPlatformRouter = require("./platform.routes");
const buildCacheRouter = require("./cache.routes");
const buildDocsRouter = require("./docs.routes");
const buildFilesRouter = require("./files.routes");
const buildSqlRouter = require("./sql.routes");
const buildOmsorgRouter = require("./omsorg.routes");
const { optionalUser } = require("../../../middleware/optionalUser");
const { requireUser } = require("../../../middleware/requireUser");

function buildApiV1Router({ sequelize, buildTag }) {
  const router = express.Router();

  router.use("/platform", buildPlatformRouter({ sequelize, buildTag }));
  router.use("/cache", buildCacheRouter());
  router.use("/docs", optionalUser(), buildDocsRouter());
  router.use("/files", buildFilesRouter());
  router.use("/sql", buildSqlRouter({ sequelize }));
  router.use("/omsorg", requireUser(), buildOmsorgRouter());

  return router;
}

module.exports = buildApiV1Router;
