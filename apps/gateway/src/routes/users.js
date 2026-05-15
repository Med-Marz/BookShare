const express = require('express');
const userClient = require('../clients/userClient');

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

module.exports = router;
