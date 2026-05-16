const express = require('express');

const loanClient = require('../clients/loanClient');
const bookClient = require('../clients/bookClient');
const userClient = require('../clients/userClient');
const { makeMetadata } = require('../clients/grpcMetadata');

const router = express.Router();

// Fan-out helpers — one lookup per unique id, returns Map(id -> entity).
// On individual failure, fall back to a placeholder so a single bad row
// doesn't break the whole list.
async function enrichBooks(bookIds) {
  const uniq = [...new Set(bookIds)];
  const entries = await Promise.all(
    uniq.map((id) =>
      bookClient
        .getBook({ book_id: id })
        .then((r) => [id, r.book])
        .catch(() => [
          id,
          {
            id,
            title: 'Unknown book',
            author: '',
            year_published: 0,
            cover_object_key: '',
            status: 'Unknown',
          },
        ]),
    ),
  );
  return new Map(entries);
}

async function enrichUsers(userIds) {
  const uniq = [...new Set(userIds)];
  const entries = await Promise.all(
    uniq.map((id) =>
      userClient
        .getUser({ user_id: id })
        .then((r) => [id, r.user])
        .catch(() => [id, { id, display_name: 'Unknown', email: '', phone: '', address: '' }]),
    ),
  );
  return new Map(entries);
}

// GET /api/v1/me/reservations — every reservation the authenticated user placed
// (borrower view). Each entry is enriched with `book` and `owner`. Owner
// contact fields are included so the borrower can coordinate the handoff.
router.get('/reservations', async (req, res, next) => {
  try {
    const { reservations } = await loanClient.listMyReservations(
      {},
      makeMetadata(req.userId),
    );
    if (!reservations || reservations.length === 0) {
      return res.json({ reservations: [] });
    }
    const [books, owners] = await Promise.all([
      enrichBooks(reservations.map((r) => r.book_id)),
      enrichUsers(reservations.map((r) => r.owner_id)),
    ]);
    const enriched = reservations.map((r) => ({
      ...r,
      book: books.get(r.book_id),
      owner: owners.get(r.owner_id),
    }));
    res.json({ reservations: enriched });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/me/owned-reservations — reservations placed on books the
// authenticated user owns (owner view). Each entry is enriched with `book`
// and `borrower`. Borrower contact is included so the owner can coordinate.
router.get('/owned-reservations', async (req, res, next) => {
  try {
    const { reservations } = await loanClient.listReservationsOnMyBooks(
      {},
      makeMetadata(req.userId),
    );
    if (!reservations || reservations.length === 0) {
      return res.json({ reservations: [] });
    }
    const [books, borrowers] = await Promise.all([
      enrichBooks(reservations.map((r) => r.book_id)),
      enrichUsers(reservations.map((r) => r.borrower_id)),
    ]);
    const enriched = reservations.map((r) => ({
      ...r,
      book: books.get(r.book_id),
      borrower: borrowers.get(r.borrower_id),
    }));
    res.json({ reservations: enriched });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/me/activity — parallel fan-out of two counts:
//   activeReservationCount → loan-service (Active + LoanStarted)
//   listedBookCount        → book-service (books owned by this user)
router.get('/activity', async (req, res, next) => {
  try {
    const [countRes, booksRes] = await Promise.all([
      loanClient.countMyActiveReservations({}, makeMetadata(req.userId)),
      bookClient.listBooksByOwner({ owner_id: req.userId }),
    ]);
    res.json({
      activeReservationCount: countRes.count || 0,
      listedBookCount: booksRes.books?.length || 0,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
