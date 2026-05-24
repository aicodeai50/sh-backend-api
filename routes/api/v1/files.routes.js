const express = require("express");
const path = require("path");
const {
  saveUploadedFile,
  getFilePath,
  getFileStream,
  deleteFile,
  listFiles,
  ensureUploadsDir,
} = require("../../../services/storage/file.store");
const { getStorageConfig } = require("../../../config/platform.config");

function buildFilesRouter() {
  const router = express.Router();
  ensureUploadsDir();

  router.get("/", async (_req, res) => {
    try {
      const files = await listFiles();
      res.json({ ok: true, count: files.length, files });
    } catch (err) {
      res.status(500).json({ error: "List failed", details: err?.message || String(err) });
    }
  });

  router.get("/:filename", async (req, res) => {
    try {
      const filename = path.basename(String(req.params.filename || ""));
      const fullPath = getFilePath(filename);

      if (fullPath) {
        return res.sendFile(fullPath);
      }

      const object = await getFileStream(filename);
      if (!object?.stream) {
        return res.status(404).json({ error: "File not found" });
      }

      res.setHeader("Content-Type", object.contentType);
      if (object.contentLength) {
        res.setHeader("Content-Length", String(object.contentLength));
      }
      object.stream.pipe(res);
    } catch (err) {
      res.status(500).json({ error: "Download failed", details: err?.message || String(err) });
    }
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

    req.on("end", async () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (!buffer.length) {
          return res.status(400).json({ error: "Empty file body" });
        }

        const originalName =
          req.headers["x-file-name"] || req.query.name || "upload.bin";
        const mimeType = req.headers["content-type"] || "application/octet-stream";

        const saved = await saveUploadedFile({ originalName, buffer, mimeType });
        return res.status(201).json({ ok: true, file: saved });
      } catch (err) {
        return res.status(500).json({
          error: "Upload failed",
          details: err?.message || String(err),
        });
      }
    });
  });

  router.delete("/:filename", async (req, res) => {
    try {
      const filename = path.basename(String(req.params.filename || ""));
      const ok = await deleteFile(filename);
      if (!ok) return res.status(404).json({ error: "File not found" });
      return res.json({ ok: true, deleted: filename });
    } catch (err) {
      return res.status(500).json({ error: "Delete failed", details: err?.message || String(err) });
    }
  });

  return router;
}

module.exports = buildFilesRouter;
