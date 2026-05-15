const express = require('express');
const userClient = require('../clients/userClient');
const bookClient = require('../clients/bookClient');

const router = express.Router();

// GET /api/v1/users/:id — public profile read.
// Anonymous viewers get { id, display_name } only. Authenticated viewers see
// the full public profile (email, phone, address, created_at) — that's the
// product decision from PRD frontmatter scopeDecisions.contactExposure.
//
// `optionalAuth` middleware (applied where this router is mounted) populates
// req.userId when a valid JWT is present, otherwise leaves it undefined.
router.get('/:id', async (req, res) => {
  const { user } = await userClient.getUser({ user_id: req.params.id });
  if (req.userId) {
    res.json(user);
  } else {
    res.json({ id: user.id, display_name: user.display_name });
  }
});

// GET /api/v1/users/:id/books — public list of a user's books.
// No auth required; anyone can see who's offering what to the community.
router.get('/:id/books', async (req, res) => {
  const { books } = await bookClient.listBooksByOwner({ owner_id: req.params.id });
  res.json({ books });
});

module.exports = router;
