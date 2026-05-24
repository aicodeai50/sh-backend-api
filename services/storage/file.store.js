const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getStorageConfig } = require("../../config/platform.config");

function ensureUploadsDir() {
  const { uploadsDir } = getStorageConfig();
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

function sanitizeFilename(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

function saveUploadedFile({ originalName, buffer, mimeType }) {
  ensureUploadsDir();
  const { uploadsDir } = getStorageConfig();
  const id = crypto.randomBytes(10).toString("hex");
  const safeName = sanitizeFilename(originalName);
  const storedName = `${id}_${safeName}`;
  const fullPath = path.join(uploadsDir, storedName);

  fs.writeFileSync(fullPath, buffer);

  return {
    id,
    filename: storedName,
    originalName: safeName,
    mimeType: mimeType || "application/octet-stream",
    size: buffer.length,
    url: `/api/v1/files/${storedName}`,
  };
}

function getFilePath(filename) {
  const { uploadsDir } = getStorageConfig();
  const safe = path.basename(String(filename || ""));
  const fullPath = path.join(uploadsDir, safe);
  if (!fullPath.startsWith(uploadsDir)) return null;
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

function deleteFile(filename) {
  const fullPath = getFilePath(filename);
  if (!fullPath) return false;
  fs.unlinkSync(fullPath);
  return true;
}

function listFiles() {
  ensureUploadsDir();
  const { uploadsDir } = getStorageConfig();
  return fs.readdirSync(uploadsDir).map((filename) => {
    const fullPath = path.join(uploadsDir, filename);
    const stat = fs.statSync(fullPath);
    return {
      filename,
      size: stat.size,
      url: `/api/v1/files/${filename}`,
      updated_at: stat.mtime,
    };
  });
}

module.exports = {
  ensureUploadsDir,
  saveUploadedFile,
  getFilePath,
  deleteFile,
  listFiles,
};
