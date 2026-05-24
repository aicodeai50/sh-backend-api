const express = require("express");
const buildPlatformRouter = require("./platform.routes");
const buildCacheRouter = require("./cache.routes");
const buildDocsRouter = require("./docs.routes");
const buildFilesRouter = require("./files.routes");
const buildSqlRouter = require("./sql.routes");
const { optionalUser } = require("../../../middleware/optionalUser");

function buildApiV1Router({ sequelize, buildTag }) {
  const router = express.Router();

  router.use("/platform", buildPlatformRouter({ sequelize, buildTag }));
  router.use("/cache", buildCacheRouter());
  router.use("/docs", optionalUser(), buildDocsRouter());
  router.use("/files", buildFilesRouter());
  router.use("/sql", buildSqlRouter({ sequelize }));

  return router;
}

module.exports = buildApiV1Router;
