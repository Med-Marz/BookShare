const { randomUUID } = require('node:crypto');
const grpc = require('@grpc/grpc-js');

const db = require('./db');
const minio = require('./minio');
const { addBookSchema, ALLOWED_CONTENT_TYPES } = require('./schemas');

function zodErrorToGrpc(error) {
  const first = error.issues[0];
  const fieldPath = first.path?.join('.') || 'request';
  return {
    code: grpc.status.INVALID_ARGUMENT,
    message: `${fieldPath}: ${first.message}`,
  };
}

function toPublicBook(row) {
  return {
    id: row.id,
    owner_id: row.owner_id,
    title: row.title,
    author: row.author,
    year_published: row.year_published,
    cover_object_key: row.cover_object_key,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function makeHandlers(logger) {
  return {
    async AddBook(call, callback) {
      const req = call.request || {};
      const metaUser = call.metadata.get('x-user-id')[0];

      if (!metaUser) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'missing x-user-id metadata',
        });
      }
      if (!req.owner_id || req.owner_id !== metaUser) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'owner_id must match the authenticated user',
        });
      }

      // Cover-image guard FIRST — empty buffer/Uint8Array means missing cover.
      const cover = req.cover_image_bytes;
      const coverLen =
        cover && typeof cover.length === 'number' ? cover.length : 0;
      if (!cover || coverLen === 0) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'cover image is required',
        });
      }
      const contentType = req.cover_content_type;
      if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'unsupported cover content type',
        });
      }

      // Textual validation.
      const parsed = addBookSchema.safeParse({
        owner_id: req.owner_id,
        title: req.title,
        author: req.author,
        year_published: Number.parseInt(req.year_published, 10),
      });
      if (!parsed.success) return callback(zodErrorToGrpc(parsed.error));

      try {
        const id = randomUUID();
        const objectKey = `covers/${id}.${minio.extFromContentType(contentType)}`;
        await minio.putCover({
          objectKey,
          buffer: Buffer.from(cover),
          contentType,
        });

        const now = new Date().toISOString();
        const row = {
          id,
          owner_id: parsed.data.owner_id,
          title: parsed.data.title,
          author: parsed.data.author,
          year_published: parsed.data.year_published,
          cover_object_key: objectKey,
          status: 'Available',
          created_at: now,
          updated_at: now,
        };
        await db.insertBook(row);

        logger.info(
          {
            event: 'book.created',
            book_id: id,
            owner_id: row.owner_id,
            bytes: coverLen,
            content_type: contentType,
          },
          'book added',
        );

        return callback(null, { book: toPublicBook(row) });
      } catch (err) {
        logger.error({ err }, 'AddBook failed');
        return callback({
          code: grpc.status.INTERNAL,
          message: 'failed to add book',
        });
      }
    },

    async GetCoverBytes(call, callback) {
      const objectKey = call.request?.object_key;
      if (!objectKey) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'object_key is required',
        });
      }
      try {
        const { contentType } = await minio.statCover(objectKey);
        const buffer = await minio.getCoverBuffer(objectKey);
        return callback(null, { content: buffer, content_type: contentType });
      } catch (err) {
        const minioCode = err?.code;
        if (
          minioCode === 'NoSuchKey' ||
          minioCode === 'NotFound' ||
          minioCode === 'NoSuchBucket'
        ) {
          return callback({
            code: grpc.status.NOT_FOUND,
            message: 'cover not found',
          });
        }
        logger.error({ err, object_key: objectKey }, 'GetCoverBytes failed');
        return callback({
          code: grpc.status.INTERNAL,
          message: 'failed to fetch cover',
        });
      }
    },
  };
}

module.exports = { makeHandlers };
