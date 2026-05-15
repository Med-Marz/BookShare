const { randomUUID } = require('node:crypto');
const grpc = require('@grpc/grpc-js');

const db = require('./db');
const minio = require('./minio');
const { addBookSchema, editBookSchema, ALLOWED_CONTENT_TYPES } = require('./schemas');

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

    async GetBook(call, callback) {
      const bookId = call.request?.book_id;
      if (!bookId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'book_id is required',
        });
      }
      try {
        const doc = await db.collection.findOne({ selector: { id: bookId } }).exec();
        if (!doc) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'book not found' });
        }
        return callback(null, { book: doc.toMutableJSON() });
      } catch (err) {
        logger.error({ err, book_id: bookId }, 'GetBook failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to read book' });
      }
    },

    async ReplaceCover(call, callback) {
      const bookId = call.request?.book_id;
      const metaUser = call.metadata.get('x-user-id')[0];

      if (!bookId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'book_id is required',
        });
      }
      if (!metaUser) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'missing x-user-id metadata',
        });
      }

      const cover = call.request.cover_image_bytes;
      const coverLen =
        cover && typeof cover.length === 'number' ? cover.length : 0;
      if (!cover || coverLen === 0) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'cover image is required',
        });
      }
      const contentType = call.request.cover_content_type;
      if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'unsupported cover content type',
        });
      }

      try {
        const doc = await db.collection.findOne({ selector: { id: bookId } }).exec();
        if (!doc) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'book not found' });
        }
        if (doc.owner_id !== metaUser) {
          return callback({
            code: grpc.status.PERMISSION_DENIED,
            message: 'only the book owner can replace this cover',
          });
        }

        const oldKey = doc.cover_object_key;
        const newKey = `covers/${randomUUID()}.${minio.extFromContentType(contentType)}`;
        await minio.putCover({
          objectKey: newKey,
          buffer: Buffer.from(cover),
          contentType,
        });

        const now = new Date().toISOString();
        await doc.patch({ cover_object_key: newKey, updated_at: now });

        // Best-effort delete of the previous object. Failure here does NOT
        // fail the request — the new cover is already live.
        if (oldKey && oldKey !== newKey) {
          minio
            .removeCover(oldKey)
            .catch((err) =>
              logger.warn({ err, object_key: oldKey }, 'old cover delete failed'),
            );
        }

        const updated = await db.collection.findOne({ selector: { id: bookId } }).exec();
        logger.info(
          {
            event: 'book.cover.replaced',
            book_id: bookId,
            owner_id: metaUser,
            old_key: oldKey,
            new_key: newKey,
            bytes: coverLen,
            content_type: contentType,
          },
          'cover replaced',
        );
        return callback(null, { book: updated.toMutableJSON() });
      } catch (err) {
        logger.error({ err, book_id: bookId }, 'ReplaceCover failed');
        return callback({
          code: grpc.status.INTERNAL,
          message: 'failed to replace cover',
        });
      }
    },

    async EditBook(call, callback) {
      const bookId = call.request?.book_id;
      const metaUser = call.metadata.get('x-user-id')[0];
      if (!bookId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'book_id is required',
        });
      }
      if (!metaUser) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'missing x-user-id metadata',
        });
      }

      // Build a candidate patch — drop proto3 defaults (empty strings / 0 ints).
      const candidate = {};
      if (call.request.title) candidate.title = call.request.title;
      if (call.request.author) candidate.author = call.request.author;
      if (call.request.year_published) candidate.year_published = call.request.year_published;

      const parsed = editBookSchema.safeParse(candidate);
      if (!parsed.success) {
        return callback(zodErrorToGrpc(parsed.error));
      }

      try {
        const doc = await db.collection.findOne({ selector: { id: bookId } }).exec();
        if (!doc) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'book not found' });
        }
        if (doc.owner_id !== metaUser) {
          return callback({
            code: grpc.status.PERMISSION_DENIED,
            message: 'only the book owner can edit this book',
          });
        }
        const now = new Date().toISOString();
        await doc.patch({ ...parsed.data, updated_at: now });
        const updated = await db.collection.findOne({ selector: { id: bookId } }).exec();
        logger.info(
          {
            event: 'book.updated',
            book_id: bookId,
            owner_id: metaUser,
            fields: Object.keys(parsed.data),
          },
          'book updated',
        );
        return callback(null, { book: updated.toMutableJSON() });
      } catch (err) {
        logger.error({ err, book_id: bookId }, 'EditBook failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to update book' });
      }
    },

    async ListBooksByOwner(call, callback) {
      const ownerId = call.request?.owner_id;
      if (!ownerId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'owner_id is required',
        });
      }
      try {
        const docs = await db.collection
          .find({ selector: { owner_id: ownerId } })
          .exec();
        // RxDB returns RxDocuments — convert to plain JSON before sending over
        // the wire. ISO 8601 strings sort lexically the same as chronologically,
        // so a descending JS sort gives "newest first" without needing an index.
        const books = docs
          .map((d) => d.toMutableJSON())
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return callback(null, { books });
      } catch (err) {
        logger.error({ err, owner_id: ownerId }, 'ListBooksByOwner failed');
        return callback({
          code: grpc.status.INTERNAL,
          message: 'failed to list books',
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
