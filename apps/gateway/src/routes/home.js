const express = require('express');
const bookClient = require('../clients/bookClient');
const userClient = require('../clients/userClient');

const router = express.Router();

// GET /api/v1/home/recent-books?limit=12 — public.
// Returns the newest books across all owners, each enriched with its owner's
// display_name. Contact fields are deliberately omitted — those live on
// /api/v1/books/:id.
router.get('/recent-books', async (req, res, next) => {
  const rawLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : 12;
  try {
    const { books } = await bookClient.listRecentBooks({ limit });
    if (!books || books.length === 0) return res.json({ books: [] });

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
    res.json({ books: enriched });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
