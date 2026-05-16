const grpc = require('@grpc/grpc-js');
const { GraphQLError } = require('graphql');

const loanClient = require('../clients/loanClient');
const bookClient = require('../clients/bookClient');
const userClient = require('../clients/userClient');
const { makeMetadata } = require('../clients/grpcMetadata');

function gqlError(code, message, status) {
  return new GraphQLError(message, { extensions: { code, http: { status } } });
}

function unauthenticated() {
  return gqlError('AUTHENTICATION_REQUIRED', 'sign in required', 401);
}

function grpcErrorToGraphQL(err) {
  const message = err?.details || err?.message || 'Internal error';
  switch (err?.code) {
    case grpc.status.INVALID_ARGUMENT:
      return gqlError('VALIDATION_ERROR', message, 400);
    case grpc.status.PERMISSION_DENIED:
      return gqlError('FORBIDDEN', message, 403);
    case grpc.status.NOT_FOUND:
      return gqlError('NOT_FOUND', message, 404);
    case grpc.status.FAILED_PRECONDITION:
      return gqlError('FAILED_PRECONDITION', message, 409);
    case grpc.status.UNAUTHENTICATED:
      return gqlError('AUTHENTICATION_REQUIRED', message, 401);
    default:
      return gqlError('INTERNAL_ERROR', message, 500);
  }
}

module.exports = {
  Query: {
    myReservations: async (_parent, _args, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { reservations } = await loanClient.listMyReservations(
          {},
          makeMetadata(ctx.userId),
        );
        return reservations || [];
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },

    ownedReservations: async (_parent, _args, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { reservations } = await loanClient.listReservationsOnMyBooks(
          {},
          makeMetadata(ctx.userId),
        );
        return reservations || [];
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },
  },

  // Per-row joins. `owner` is only visible to the borrower; `borrower` is
  // only visible to the owner — defense in depth around contact-info gating.
  Reservation: {
    book: async (parent) => {
      try {
        const { book } = await bookClient.getBook({ book_id: parent.book_id });
        return book;
      } catch {
        return null;
      }
    },
    owner: async (parent, _args, ctx) => {
      if (!ctx?.userId) return null;
      if (ctx.userId !== parent.borrower_id) return null;
      try {
        const { user } = await userClient.getUser({ user_id: parent.owner_id });
        return user;
      } catch {
        return null;
      }
    },
    borrower: async (parent, _args, ctx) => {
      if (!ctx?.userId) return null;
      if (ctx.userId !== parent.owner_id) return null;
      try {
        const { user } = await userClient.getUser({ user_id: parent.borrower_id });
        return user;
      } catch {
        return null;
      }
    },
  },

  Mutation: {
    reserveBook: async (_parent, { book_id }, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { reservation } = await loanClient.reserve(
          { book_id },
          makeMetadata(ctx.userId),
        );
        return reservation;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },

    cancelReservation: async (_parent, { id }, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { reservation } = await loanClient.cancelReservation(
          { reservation_id: id },
          makeMetadata(ctx.userId),
        );
        return reservation;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },

    startLoan: async (_parent, { id }, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { reservation } = await loanClient.startLoan(
          { reservation_id: id },
          makeMetadata(ctx.userId),
        );
        return reservation;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },

    markReturned: async (_parent, { id }, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { reservation } = await loanClient.markReturned(
          { reservation_id: id },
          makeMetadata(ctx.userId),
        );
        return reservation;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },
  },
};
