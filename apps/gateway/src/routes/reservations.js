const express = require('express');
const loanClient = require('../clients/loanClient');
const { makeMetadata } = require('../clients/grpcMetadata');

const router = express.Router();

// DELETE /api/v1/reservations/:id — borrower-only cancel.
router.delete('/:id', async (req, res, next) => {
  try {
    const { reservation } = await loanClient.cancelReservation(
      { reservation_id: req.params.id },
      makeMetadata(req.userId),
    );
    if (req.log) {
      req.log.info(
        { event: 'reservation.cancel', reservation_id: reservation.id },
        'reservation cancelled',
      );
    }
    res.json({ reservation });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/reservations/:id/start-loan — owner-only.
router.post('/:id/start-loan', async (req, res, next) => {
  try {
    const { reservation } = await loanClient.startLoan(
      { reservation_id: req.params.id },
      makeMetadata(req.userId),
    );
    if (req.log) {
      req.log.info(
        { event: 'loan.start', reservation_id: reservation.id },
        'loan started',
      );
    }
    res.json({ reservation });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/reservations/:id/mark-returned — owner-only.
router.post('/:id/mark-returned', async (req, res, next) => {
  try {
    const { reservation } = await loanClient.markReturned(
      { reservation_id: req.params.id },
      makeMetadata(req.userId),
    );
    if (req.log) {
      req.log.info(
        { event: 'loan.return', reservation_id: reservation.id },
        'loan returned',
      );
    }
    res.json({ reservation });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
