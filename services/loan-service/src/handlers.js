const { randomUUID } = require('node:crypto');
const grpc = require('@grpc/grpc-js');

const db = require('./db');
const kafkaProducer = require('./kafkaProducer');
const bookClient = require('./bookClient');

const TOPIC = {
  RESERVED: 'book.reserved',
  CANCELLED: 'reservation.cancelled',
  LOAN_STARTED: 'loan.started',
  LOAN_RETURNED: 'loan.returned',
};

function metaUser(call) {
  return call.metadata.get('x-user-id')[0];
}

function makeHandlers(logger) {
  return {
    async Reserve(call, callback) {
      const userId = metaUser(call);
      if (!userId) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'missing x-user-id metadata',
        });
      }
      const bookId = call.request?.book_id;
      if (!bookId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'book_id is required',
        });
      }
      try {
        // Synchronous validation: ask book-service for current state.
        const { book } = await bookClient.getBook({ book_id: bookId });
        if (book.owner_id === userId) {
          return callback({
            code: grpc.status.INVALID_ARGUMENT,
            message: 'you cannot reserve your own book',
          });
        }
        if (book.status !== 'Available') {
          return callback({
            code: grpc.status.FAILED_PRECONDITION,
            message: 'book is not available',
          });
        }

        const id = randomUUID();
        const now = new Date().toISOString();
        const reservation = await db.insertReservation({
          id,
          book_id: bookId,
          owner_id: book.owner_id,
          borrower_id: userId,
          created_at: now,
        });

        await kafkaProducer.emit(
          {
            topic: TOPIC.RESERVED,
            key: bookId,
            actorId: userId,
            data: {
              reservation_id: id,
              book_id: bookId,
              borrower_id: userId,
              owner_id: book.owner_id,
            },
          },
          logger,
        );

        logger.info(
          { event: 'reservation.created', reservation_id: id, book_id: bookId, borrower_id: userId },
          'reservation created',
        );
        return callback(null, { reservation });
      } catch (err) {
        if (err?.code === grpc.status.NOT_FOUND) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'book not found' });
        }
        logger.error({ err, book_id: bookId }, 'Reserve failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to reserve book' });
      }
    },

    async CancelReservation(call, callback) {
      const userId = metaUser(call);
      if (!userId) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'missing x-user-id metadata',
        });
      }
      const reservationId = call.request?.reservation_id;
      if (!reservationId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'reservation_id is required',
        });
      }
      try {
        const existing = await db.getReservation(reservationId);
        if (!existing) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'reservation not found' });
        }
        if (existing.borrower_id !== userId) {
          return callback({
            code: grpc.status.PERMISSION_DENIED,
            message: 'only the borrower can cancel this reservation',
          });
        }
        if (existing.state !== 'Active') {
          const msg =
            existing.state === 'Cancelled' || existing.state === 'Completed'
              ? 'reservation already cancelled/completed'
              : 'cancellation not allowed once loan has started';
          return callback({ code: grpc.status.FAILED_PRECONDITION, message: msg });
        }

        const now = new Date().toISOString();
        const reservation = await db.updateState(reservationId, {
          state: 'Cancelled',
          cancelled_at: now,
        });

        await kafkaProducer.emit(
          {
            topic: TOPIC.CANCELLED,
            key: existing.book_id,
            actorId: userId,
            data: {
              reservation_id: reservationId,
              book_id: existing.book_id,
              borrower_id: existing.borrower_id,
              owner_id: existing.owner_id,
            },
          },
          logger,
        );

        logger.info(
          { event: 'reservation.cancelled', reservation_id: reservationId },
          'reservation cancelled',
        );
        return callback(null, { reservation });
      } catch (err) {
        logger.error({ err, reservation_id: reservationId }, 'CancelReservation failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to cancel reservation' });
      }
    },

    async StartLoan(call, callback) {
      const userId = metaUser(call);
      if (!userId) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'missing x-user-id metadata',
        });
      }
      const reservationId = call.request?.reservation_id;
      if (!reservationId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'reservation_id is required',
        });
      }
      try {
        const existing = await db.getReservation(reservationId);
        if (!existing) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'reservation not found' });
        }
        if (existing.owner_id !== userId) {
          return callback({
            code: grpc.status.PERMISSION_DENIED,
            message: 'only the book owner can start the loan',
          });
        }
        if (existing.state !== 'Active') {
          return callback({
            code: grpc.status.FAILED_PRECONDITION,
            message: 'loan can only be started from an Active reservation',
          });
        }

        const now = new Date().toISOString();
        const reservation = await db.updateState(reservationId, {
          state: 'LoanStarted',
          loan_started_at: now,
        });

        await kafkaProducer.emit(
          {
            topic: TOPIC.LOAN_STARTED,
            key: existing.book_id,
            actorId: userId,
            data: {
              reservation_id: reservationId,
              book_id: existing.book_id,
              borrower_id: existing.borrower_id,
              owner_id: existing.owner_id,
            },
          },
          logger,
        );

        logger.info(
          { event: 'loan.started', reservation_id: reservationId },
          'loan started',
        );
        return callback(null, { reservation });
      } catch (err) {
        logger.error({ err, reservation_id: reservationId }, 'StartLoan failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to start loan' });
      }
    },

    async MarkReturned(call, callback) {
      const userId = metaUser(call);
      if (!userId) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'missing x-user-id metadata',
        });
      }
      const reservationId = call.request?.reservation_id;
      if (!reservationId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'reservation_id is required',
        });
      }
      try {
        const existing = await db.getReservation(reservationId);
        if (!existing) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'reservation not found' });
        }
        if (existing.owner_id !== userId) {
          return callback({
            code: grpc.status.PERMISSION_DENIED,
            message: 'only the book owner can mark the loan returned',
          });
        }
        if (existing.state !== 'LoanStarted') {
          return callback({
            code: grpc.status.FAILED_PRECONDITION,
            message: 'only a started loan can be marked returned',
          });
        }

        const now = new Date().toISOString();
        const reservation = await db.updateState(reservationId, {
          state: 'Completed',
          returned_at: now,
        });

        await kafkaProducer.emit(
          {
            topic: TOPIC.LOAN_RETURNED,
            key: existing.book_id,
            actorId: userId,
            data: {
              reservation_id: reservationId,
              book_id: existing.book_id,
              borrower_id: existing.borrower_id,
              owner_id: existing.owner_id,
            },
          },
          logger,
        );

        logger.info(
          { event: 'loan.returned', reservation_id: reservationId },
          'loan returned',
        );
        return callback(null, { reservation });
      } catch (err) {
        logger.error({ err, reservation_id: reservationId }, 'MarkReturned failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to mark loan returned' });
      }
    },

    async GetMyActiveReservationOnBook(call, callback) {
      const userId = metaUser(call);
      if (!userId) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'missing x-user-id metadata',
        });
      }
      const bookId = call.request?.book_id;
      if (!bookId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'book_id is required',
        });
      }
      try {
        const reservation = await db.getActiveReservation({
          book_id: bookId,
          borrower_id: userId,
        });
        if (!reservation) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'no active reservation' });
        }
        return callback(null, { reservation });
      } catch (err) {
        logger.error({ err, book_id: bookId }, 'GetMyActiveReservationOnBook failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to look up reservation' });
      }
    },
  };
}

module.exports = { makeHandlers };
