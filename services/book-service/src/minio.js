const { Client } = require('minio');

const ENDPOINT = process.env.MINIO_ENDPOINT || 'minio';
const PORT = Number.parseInt(process.env.MINIO_PORT || '9000', 10);
const USE_SSL = process.env.MINIO_USE_SSL === 'true';
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY;
const SECRET_KEY = process.env.MINIO_SECRET_KEY;
const BUCKET = process.env.MINIO_BUCKET || 'bookshare-covers';

const client = new Client({
  endPoint: ENDPOINT,
  port: PORT,
  useSSL: USE_SSL,
  accessKey: ACCESS_KEY,
  secretKey: SECRET_KEY,
});

async function init(logger) {
  const exists = await client.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await client.makeBucket(BUCKET);
    logger.info({ bucket: BUCKET }, 'bucket created');
  } else {
    logger.info({ bucket: BUCKET }, 'bucket ready');
  }
}

async function putCover({ objectKey, buffer, contentType }) {
  await client.putObject(BUCKET, objectKey, buffer, buffer.length, {
    'Content-Type': contentType,
  });
  return objectKey;
}

async function statCover(objectKey) {
  const stat = await client.statObject(BUCKET, objectKey);
  // MinIO normalises the header into metaData; the casing varies, so check both.
  const contentType =
    stat.metaData?.['content-type'] ||
    stat.metaData?.['Content-Type'] ||
    'application/octet-stream';
  return { contentType, size: stat.size };
}

async function getCoverBuffer(objectKey) {
  const stream = await client.getObject(BUCKET, objectKey);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function removeCover(objectKey) {
  await client.removeObject(BUCKET, objectKey);
}

function extFromContentType(ct) {
  if (ct === 'image/jpeg') return 'jpg';
  if (ct === 'image/png') return 'png';
  if (ct === 'image/webp') return 'webp';
  return 'bin';
}

module.exports = {
  init,
  putCover,
  statCover,
  getCoverBuffer,
  removeCover,
  extFromContentType,
  BUCKET,
};
