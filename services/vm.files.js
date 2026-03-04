// services/vm.files.js
const crypto = require("crypto");
const { VmFile } = require("../database");

function makeId() {
  return "file_" + crypto.randomBytes(10).toString("hex");
}

function normalizePath(p) {
  const path = String(p || "").trim().replace(/\\/g, "/");
  if (!path) throw new Error("Missing file path");
  if (path.includes("..")) throw new Error("Invalid file path");
  return path.startsWith("/") ? path.slice(1) : path;
}

async function upsertFile({ vm_id, owner_user_id, path, content, content_type }) {
  const safePath = normalizePath(path);
  const ct = String(content_type || "text/plain").trim() || "text/plain";
  const body = String(content ?? "");

  const existing = await VmFile.findOne({
    where: { vm_id, owner_user_id, path: safePath },
  });

  if (existing) {
    await existing.update({
      content: body,
      content_type: ct,
      updated_at: new Date(),
    });
    return existing;
  }

  const row = await VmFile.create({
    id: makeId(),
    vm_id,
    owner_user_id,
    path: safePath,
    content: body,
    content_type: ct,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return row;
}

async function listFiles({ vm_id, owner_user_id }) {
  return VmFile.findAll({
    where: { vm_id, owner_user_id },
    order: [["path", "ASC"]],
  });
}

async function getFile({ vm_id, owner_user_id, file_id }) {
  return VmFile.findOne({
    where: { id: file_id, vm_id, owner_user_id },
  });
}

module.exports = { upsertFile, listFiles, getFile };