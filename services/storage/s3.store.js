const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");
const { getS3Config } = require("../../config/platform.config");

let client = null;

function getClient() {
  const config = getS3Config();
  if (!config.enabled) return null;
  if (client) return client;

  client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return client;
}

function getFileBackend() {
  return getS3Config().enabled ? "s3" : "local";
}

async function putObject({ key, buffer, mimeType }) {
  const config = getS3Config();
  const s3 = getClient();
  if (!s3) throw new Error("S3 not configured");

  await s3.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType || "application/octet-stream",
    })
  );

  return {
    key,
    url: buildPublicUrl(key),
  };
}

async function getObjectStream(key) {
  const config = getS3Config();
  const s3 = getClient();
  if (!s3) return null;

  const result = await s3.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );

  return {
    stream: result.Body,
    contentType: result.ContentType || "application/octet-stream",
    contentLength: result.ContentLength,
  };
}

async function deleteObject(key) {
  const config = getS3Config();
  const s3 = getClient();
  if (!s3) return false;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
  return true;
}

async function listObjects({ prefix = "" } = {}) {
  const config = getS3Config();
  const s3 = getClient();
  if (!s3) return [];

  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
      MaxKeys: 200,
    })
  );

  return (result.Contents || []).map((item) => ({
    key: item.Key,
    filename: item.Key,
    size: item.Size,
    url: buildPublicUrl(item.Key),
    updated_at: item.LastModified,
  }));
}

function buildPublicUrl(key) {
  const config = getS3Config();
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
  return `/api/v1/files/${encodeURIComponent(key)}`;
}

module.exports = {
  getFileBackend,
  putObject,
  getObjectStream,
  deleteObject,
  listObjects,
  buildPublicUrl,
};
