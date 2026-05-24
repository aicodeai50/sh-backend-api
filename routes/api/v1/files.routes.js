const express = require("express");
const path = require("path");
const {
  saveUploadedFile,
  getFilePath,
  deleteFile,
  listFiles,
  ensureUploadsDir,
} = require("../../../services/storage/file.store");
const { getStorageConfig } = require("../../../config/platform.config");

function buildFilesRouter() {
  const router = express.Router();
  ensureUploadsDir();

  router.get("/", (_req, res) => {
    const files = listFiles();
    res.json({ ok: true, count: files.length, files });
  });

  router.get("/:filename", (req, res) => {
    const filename = path.basename(String(req.params.filename || ""));
    const fullPath = getFilePath(filename);
    if (!fullPath) return res.status(404).json({ error: "File not found" });
    return res.sendFile(fullPath);
  });

  router.post("/upload", (req, res) => {
    const { maxUploadBytes } = getStorageConfig();
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxUploadBytes) {
        res.status(413).json({ error: "File too large" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (!buffer.length) {
          return res.status(400).json({ error: "Empty file body" });
        }

        const originalName =
          req.headers["x-file-name"] || req.query.name || "upload.bin";
        const mimeType = req.headers["content-type"] || "application/octet-stream";

        const saved = saveUploadedFile({ originalName, buffer, mimeType });
        return res.status(201).json({ ok: true, file: saved });
      } catch (err) {
        return res.status(500).json({
          error: "Upload failed",
          details: err?.message || String(err),
        });
      }
    });
  });

  router.delete("/:filename", (req, res) => {
    const filename = path.basename(String(req.params.filename || ""));
    const ok = deleteFile(filename);
    if (!ok) return res.status(404).json({ error: "File not found" });
    return res.json({ ok: true, deleted: filename });
  });

  return router;
}

module.exports = buildFilesRouter;
