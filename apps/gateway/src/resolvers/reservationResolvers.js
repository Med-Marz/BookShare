const grpc = require('@grpc/grpc-js');
const { GraphQLError } = require('graphql');

const loanClient = require('../clients/loanClient');
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
