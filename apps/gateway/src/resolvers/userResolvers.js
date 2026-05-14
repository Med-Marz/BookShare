const grpc = require('@grpc/grpc-js');
const { GraphQLError } = require('graphql');

const { runSignup } = require('../auth/signupFlow');

// Translate a gRPC-style error (the shape that the gateway's clients + the
// shared signupFlow throw) into a GraphQLError whose extensions.code matches
// the REST error envelope codes (architecture line 290).
function grpcErrorToGraphQL(err) {
  const code = err?.code;
  const message = err?.details || err?.message || 'Internal error';
  switch (code) {
    case grpc.status.INVALID_ARGUMENT:
      return new GraphQLError(message, {
        extensions: { code: 'VALIDATION_ERROR', http: { status: 400 } },
      });
    case grpc.status.ALREADY_EXISTS:
    case grpc.status.FAILED_PRECONDITION:
      return new GraphQLError(message, {
        extensions: { code: 'CONFLICT', http: { status: 409 } },
      });
    case grpc.status.UNAUTHENTICATED:
      return new GraphQLError(message, {
        extensions: { code: 'AUTHENTICATION_REQUIRED', http: { status: 401 } },
      });
    case grpc.status.PERMISSION_DENIED:
      return new GraphQLError(message, {
        extensions: { code: 'FORBIDDEN', http: { status: 403 } },
      });
    case grpc.status.NOT_FOUND:
      return new GraphQLError(message, {
        extensions: { code: 'NOT_FOUND', http: { status: 404 } },
      });
    default:
      return new GraphQLError(message, {
        extensions: { code: 'INTERNAL_ERROR', http: { status: 500 } },
      });
  }
}

module.exports = {
  Mutation: {
    signup: async (_parent, { input }) => {
      try {
        return await runSignup(input);
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },
  },
};
