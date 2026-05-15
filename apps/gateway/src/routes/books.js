const express = require('express');
const multer = require('multer');
const grpc = require('@grpc/grpc-js');

const bookClient = require('../clients/bookClient');
const { makeMetadata } = require('../clients/grpcMetadata');
const { addBookBodySchema, editBookBodySchema } = require('../schemas/bookSchemas');

const router = express.Router();

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TEN_MB = 10 * 1024 * 1024;

class MulterTypeError extends Error {
  constructor(message) {
    super(message);
    this.code = 'UNSUPPORTED_TYPE';
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TEN_MB, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(new MulterTypeError('unsupported cover content type'));
    }
    cb(null, true);
  },
});

function rest400(message) {
  const err = new Error(message);
  err.code = grpc.status.INVALID_ARGUMENT;
  return err;
}

// POST /api/v1/books — multipart: title, author, year_published, cover (file).
router.post('/', (req, res, next) => {
  upload.single('cover')(req, res, (mErr) => {
    if (mErr) {
      if (mErr.code === 'LIMIT_FILE_SIZE') return next(rest400('cover image exceeds 10MB'));
      if (mErr.code === 'UNSUPPORTED_TYPE') return next(rest400('unsupported cover content type'));
      return next(rest400('invalid multipart upload'));
    }
    if (!req.file) return next(rest400('cover image is required'));

    const parsed = addBookBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const pathKey = first.path?.join('.') || 'body';
      return next(rest400(`${pathKey}: ${first.message}`));
    }

    bookClient
      .addBook(
        {
          owner_id: req.userId,
          title: parsed.data.title,
          author: parsed.data.author,
          year_published: parsed.data.year_published,
          cover_image_bytes: req.file.buffer,
          cover_content_type: req.file.mimetype,
        },
        makeMetadata(req.userId),
      )
      .then(({ book }) => {
        if (req.log) {
          req.log.info({ event: 'book.add', book_id: book.id }, 'book added');
        }
        res.status(201).json({ book });
      })
      .catch(next);
  });
});

// PUT /api/v1/books/:id/cover — authenticated multipart cover replace.
// Reuses the same multer `upload` instance as POST / so size + MIME caps stay
// identical across the two upload endpoints.
router.put('/:id/cover', (req, res, next) => {
  upload.single('cover')(req, res, (mErr) => {
    if (mErr) {
      if (mErr.code === 'LIMIT_FILE_SIZE') return next(rest400('cover image exceeds 10MB'));
      if (mErr.code === 'UNSUPPORTED_TYPE') return next(rest400('unsupported cover content type'));
      return next(rest400('invalid multipart upload'));
    }
    if (!req.file) return next(rest400('cover image is required'));

    bookClient
      .replaceCover(
        {
          book_id: req.params.id,
          cover_image_bytes: req.file.buffer,
          cover_content_type: req.file.mimetype,
        },
        makeMetadata(req.userId),
      )
      .then(({ book }) => {
        if (req.log) {
          req.log.info(
            { event: 'book.cover.replace', book_id: book.id },
            'cover replaced',
          );
        }
        res.status(200).json({ book });
      })
      .catch(next);
  });
});

// PUT /api/v1/books/:id — authenticated update of textual fields.
// express.json() applied per-route so this route's body parsing is explicit
// and independent of the multer-driven POST / route above.
router.put('/:id', express.json(), async (req, res, next) => {
  const parsed = editBookBodySchema.safeParse(req.body || {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const pathKey = first.path?.join('.') || 'body';
    return next(rest400(`${pathKey}: ${first.message}`));
  }
  try {
    const { book } = await bookClient.editBook(
      { book_id: req.params.id, ...parsed.data },
      makeMetadata(req.userId),
    );
    if (req.log) {
      req.log.info({ event: 'book.edit', book_id: book.id }, 'book updated');
    }
    res.json({ book });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/books/:id — authenticated, owner-only.
// Returns 204 No Content on success. The book-service handler also blocks the
// delete when the book's status is Reserved or Lent Out (409 FAILED_PRECONDITION).
router.delete('/:id', async (req, res, next) => {
  try {
    await bookClient.deleteBook(
      { book_id: req.params.id },
      makeMetadata(req.userId),
    );
    if (req.log) {
      req.log.info({ event: 'book.delete', book_id: req.params.id }, 'book deleted');
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
