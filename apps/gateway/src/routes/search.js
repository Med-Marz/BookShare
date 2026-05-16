const express = require('express');
const grpc = require('@grpc/grpc-js');
const bookClient = require('../clients/bookClient');
const userClient = require('../clients/userClient');

const router = express.Router();

function rest400(message) {
  const err = new Error(message);
  err.code = grpc.status.INVALID_ARGUMENT;
  return err;
}

// GET /api/v1/search?q=<query> — public.
// Searches titles + authors directly and falls back through owner display names.
// Books are deduped by id and tagged with a matched_by array indicating which
// path produced them.
router.get('/', async (req, res, next) => {
  const q = (req.query.q || '').trim();
  if (!q) return next(rest400('query is required'));

  const startedAt = Date.now();
  try {
    const [bookRes, userRes] = await Promise.all([
      bookClient.searchBooks({ query: q }),
      userClient.lookupUsersByDisplayName({ query: q }),
    ]);
    const directBooks = bookRes.books || [];
    const matchedUsers = userRes.users || [];

    let ownerBooks = [];
    if (matchedUsers.length > 0) {
      const lists = await Promise.all(
        matchedUsers.map((u) =>
          bookClient
            .listBooksByOwner({ owner_id: u.id })
            .then((r) => r.books || [])
            .catch(() => []),
        ),
      );
      ownerBooks = lists.flat();
    }

    // Dedup by id and accumulate the matched-by sources.
    const byId = new Map();
    for (const b of directBooks) {
      byId.set(b.id, { book: b, matched_by: new Set(['title_author']) });
    }
    for (const b of ownerBooks) {
      const existing = byId.get(b.id);
      if (existing) existing.matched_by.add('owner');
      else byId.set(b.id, { book: b, matched_by: new Set(['owner']) });
    }

    const entries = [...byId.values()];
    if (entries.length === 0) {
      if (req.log) {
        req.log.info(
          {
            event: 'search.run',
            query: q,
            book_match_count: directBooks.length,
            user_match_count: matchedUsers.length,
            final_book_count: 0,
            duration_ms: Date.now() - startedAt,
          },
          'search executed',
        );
      }
      return res.json({ books: [] });
    }

    // Fan out for owner names on the final set.
    const uniqueOwnerIds = [...new Set(entries.map((x) => x.book.owner_id))];
    const owners = await Promise.all(
      uniqueOwnerIds.map((id) =>
        userClient
          .getUser({ user_id: id })
          .then((r) => ({ id, display_name: r.user.display_name }))
          .catch(() => ({ id, display_name: 'Unknown' })),
      ),
    );
    const ownerById = new Map(owners.map((o) => [o.id, o]));

    const books = entries.map(({ book, matched_by }) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      year_published: book.year_published,
      cover_object_key: book.cover_object_key,
      status: book.status,
      owner: ownerById.get(book.owner_id) || {
        id: book.owner_id,
        display_name: 'Unknown',
      },
      matched_by: [...matched_by],
    }));

    if (req.log) {
      req.log.info(
        {
          event: 'search.run',
          query: q,
          book_match_count: directBooks.length,
          user_match_count: matchedUsers.length,
          final_book_count: books.length,
          duration_ms: Date.now() - startedAt,
        },
        'search executed',
      );
    }
    res.json({ books });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
