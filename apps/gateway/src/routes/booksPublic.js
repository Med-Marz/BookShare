const express = require('express');
const bookClient = require('../clients/bookClient');

const router = express.Router();

// GET /api/v1/books/:id — public book detail.
// No JWT required so anonymous viewers can render the detail page.
router.get('/:id', async (req, res, next) => {
  try {
    const { book } = await bookClient.getBook({ book_id: req.params.id });
    res.json({ book });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
