const grpc = require('@grpc/grpc-js');
const { GraphQLError } = require('graphql');

const userClient = require('../clients/userClient');
const { makeMetadata } = require('../clients/grpcMetadata');
const { runSignup } = require('../auth/signupFlow');
const { runLogin } = require('../auth/loginFlow');

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

function unauthenticated() {
  return new GraphQLError('authentication required', {
    extensions: { code: 'AUTHENTICATION_REQUIRED', http: { status: 401 } },
  });
}

module.exports = {
  Query: {
    profile: async (_parent, _args, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { user } = await userClient.getUser({ user_id: ctx.userId });
        return user;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },
  },

  Mutation: {
    signup: async (_parent, { input }) => {
      try {
        return await runSignup(input);
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },

    login: async (_parent, { email, password }) => {
      try {
        return await runLogin({ email, password });
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },

    updateProfile: async (_parent, { input }, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      // Drop undefined/null/empty keys before forwarding so the user-service
      // treats them as "absent" (proto3 empty-string semantics).
      const patch = { user_id: ctx.userId };
      if (input.display_name) patch.display_name = input.display_name;
      if (input.phone) patch.phone = input.phone;
      if (input.address) patch.address = input.address;
      try {
        const { user } = await userClient.updateUser(patch, makeMetadata(ctx.userId));
        return user;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },
  },
};
