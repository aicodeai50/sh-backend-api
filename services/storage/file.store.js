const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getStorageConfig, getS3Config } = require("../../config/platform.config");
const s3Store = require("./s3.store");

function getFileBackend() {
  return s3Store.getFileBackend();
}

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

async function saveUploadedFile({ originalName, buffer, mimeType }) {
  const id = crypto.randomBytes(10).toString("hex");
  const safeName = sanitizeFilename(originalName);
  const storedName = `${id}_${safeName}`;

  if (getS3Config().enabled) {
    const key = `${getS3Config().keyPrefix}${storedName}`.replace(/\/{2,}/g, "/");
    const saved = await s3Store.putObject({ key, buffer, mimeType });
    return {
      id,
      filename: storedName,
      key,
      originalName: safeName,
      mimeType: mimeType || "application/octet-stream",
      size: buffer.length,
      backend: "s3",
      url: saved.url,
    };
  }

  ensureUploadsDir();
  const { uploadsDir } = getStorageConfig();
  const fullPath = path.join(uploadsDir, storedName);
  fs.writeFileSync(fullPath, buffer);

  return {
    id,
    filename: storedName,
    originalName: safeName,
    mimeType: mimeType || "application/octet-stream",
    size: buffer.length,
    backend: "local",
    url: `/api/v1/files/${storedName}`,
  };
}

function getFilePath(filename) {
  if (getS3Config().enabled) return null;

  const { uploadsDir } = getStorageConfig();
  const safe = path.basename(String(filename || ""));
  const fullPath = path.join(uploadsDir, safe);
  if (!fullPath.startsWith(uploadsDir)) return null;
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

async function getFileStream(filename) {
  if (!getS3Config().enabled) return null;

  const safe = path.basename(String(filename || ""));
  const key = `${getS3Config().keyPrefix}${safe}`.replace(/\/{2,}/g, "/");
  return s3Store.getObjectStream(key);
}

async function deleteFile(filename) {
  const safe = path.basename(String(filename || ""));

  if (getS3Config().enabled) {
    const key = `${getS3Config().keyPrefix}${safe}`.replace(/\/{2,}/g, "/");
    return s3Store.deleteObject(key);
  }

  const fullPath = getFilePath(safe);
  if (!fullPath) return false;
  fs.unlinkSync(fullPath);
  return true;
}

async function listFiles() {
  if (getS3Config().enabled) {
    const items = await s3Store.listObjects({ prefix: getS3Config().keyPrefix });
    return items.map((item) => ({
      filename: path.basename(item.key),
      size: item.size,
      url: item.url,
      updated_at: item.updated_at,
      backend: "s3",
    }));
  }

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
      backend: "local",
    };
  });
}

module.exports = {
  getFileBackend,
  ensureUploadsDir,
  saveUploadedFile,
  getFilePath,
  getFileStream,
  deleteFile,
  listFiles,
};
