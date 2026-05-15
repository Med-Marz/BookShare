const grpc = require('@grpc/grpc-js');
const { GraphQLError } = require('graphql');

const bookClient = require('../clients/bookClient');
const { makeMetadata } = require('../clients/grpcMetadata');

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TEN_MB = 10 * 1024 * 1024;

function gqlError(code, message, status) {
  return new GraphQLError(message, { extensions: { code, http: { status } } });
}

function unauthenticated() {
  return gqlError('AUTHENTICATION_REQUIRED', 'sign in to add a book', 401);
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
    case grpc.status.UNAUTHENTICATED:
      return gqlError('AUTHENTICATION_REQUIRED', message, 401);
    default:
      return gqlError('INTERNAL_ERROR', message, 500);
  }
}

module.exports = {
  User: {
    // Resolves whenever a GraphQL query selects User.books. Fires one gRPC
    // call to book-service per user in the result set — Apollo runs sibling
    // field resolvers in parallel, so a single user(id) query becomes
    // user-service + book-service in parallel.
    books: async (parent) => {
      if (!parent?.id) return [];
      try {
        const { books } = await bookClient.listBooksByOwner({
          owner_id: parent.id,
        });
        return books || [];
      } catch {
        // Schema requires a non-null array — never break the parent query.
        return [];
      }
    },
  },

  Mutation: {
    addBook: async (_parent, { input }, ctx) => {
      if (!ctx?.userId) throw unauthenticated();

      if (!input.cover_base64) {
        throw gqlError('VALIDATION_ERROR', 'cover image is required', 400);
      }
      if (!ALLOWED.has(input.cover_content_type)) {
        throw gqlError('VALIDATION_ERROR', 'unsupported cover content type', 400);
      }

      const buffer = Buffer.from(input.cover_base64, 'base64');
      if (buffer.length === 0) {
        throw gqlError('VALIDATION_ERROR', 'cover image is required', 400);
      }
      if (buffer.length > TEN_MB) {
        throw gqlError('VALIDATION_ERROR', 'cover image exceeds 10MB', 400);
      }

      try {
        const { book } = await bookClient.addBook(
          {
            owner_id: ctx.userId,
            title: input.title,
            author: input.author,
            year_published: input.year_published,
            cover_image_bytes: buffer,
            cover_content_type: input.cover_content_type,
          },
          makeMetadata(ctx.userId),
        );
        return book;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },
  },
};
