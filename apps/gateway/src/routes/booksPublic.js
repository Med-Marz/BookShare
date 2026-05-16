const express = require('express');
const grpc = require('@grpc/grpc-js');
const bookClient = require('../clients/bookClient');
const userClient = require('../clients/userClient');
const loanClient = require('../clients/loanClient');
const { makeMetadata } = require('../clients/grpcMetadata');

const router = express.Router();

// GET /api/v1/books?limit=24&cursor=... — public catalog with cursor pagination.
// Registered FIRST so the "/" path resolves before the /:id wildcard runs.
router.get('/', async (req, res, next) => {
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 24;
  const cursor = req.query.cursor || '';
  try {
    const { books, next_cursor } = await bookClient.listBooks({ limit, cursor });
    if (!books || books.length === 0) {
      return res.json({ books: [], next_cursor: next_cursor || '' });
    }

    // Fan-out: one parallel getUser per unique owner_id.
    const uniqueOwnerIds = [...new Set(books.map((b) => b.owner_id))];
    const owners = await Promise.all(
      uniqueOwnerIds.map((id) =>
        userClient
          .getUser({ user_id: id })
          .then((r) => ({ id, display_name: r.user.display_name }))
          .catch(() => ({ id, display_name: 'Unknown' })),
      ),
    );
    const ownerById = new Map(owners.map((o) => [o.id, o]));

    const enriched = books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      year_published: b.year_published,
      cover_object_key: b.cover_object_key,
      status: b.status,
      owner: ownerById.get(b.owner_id) || { id: b.owner_id, display_name: 'Unknown' },
    }));
    res.json({ books: enriched, next_cursor: next_cursor || '' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/books/:id — public book detail.
// No JWT required so anonymous viewers can render the detail page.
// If a valid token IS present (via optionalAuth populating req.userId), the
// response also carries the viewer's active reservation on this book — used
// by the React Reserve/Cancel UI to pick the right action.
router.get('/:id', async (req, res, next) => {
  try {
    const [bookRes, reservationRes] = await Promise.all([
      bookClient.getBook({ book_id: req.params.id }),
      req.userId
        ? loanClient
            .getMyActiveReservationOnBook(
              { book_id: req.params.id },
              makeMetadata(req.userId),
            )
            .then((r) => r.reservation)
            .catch((err) => {
              if (err?.code === grpc.status.NOT_FOUND) return null;
              throw err;
            })
        : Promise.resolve(null),
    ]);
    res.json({
      book: { ...bookRes.book, my_active_reservation: reservationRes || null },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
