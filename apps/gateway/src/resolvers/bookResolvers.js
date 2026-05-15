const grpc = require('@grpc/grpc-js');
const { GraphQLError } = require('graphql');

const bookClient = require('../clients/bookClient');
const userClient = require('../clients/userClient');
const { makeMetadata } = require('../clients/grpcMetadata');

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TEN_MB = 10 * 1024 * 1024;

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
    book: async (_parent, { id }) => {
      try {
        const { book } = await bookClient.getBook({ book_id: id });
        return book;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },
  },

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

  Book: {
    // The flagship cross-service join — fans out to user-service for the
    // owner record. Anonymous viewers see contact fields nulled per the
    // contact-info gating rule already used by Query.user.
    owner: async (parent, _args, ctx) => {
      if (!parent?.owner_id) return null;
      try {
        const { user } = await userClient.getUser({ user_id: parent.owner_id });
        if (!ctx?.userId) {
          return {
            id: user.id,
            display_name: user.display_name,
            email: null,
            phone: null,
            address: null,
            created_at: null,
          };
        }
        return user;
      } catch {
        // user-service failures should not break book(id) — return a stub.
        return {
          id: parent.owner_id,
          display_name: 'Unknown',
          email: null,
          phone: null,
          address: null,
          created_at: null,
        };
      }
    },
  },

  Mutation: {
    deleteBook: async (_parent, { id }, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        await bookClient.deleteBook({ book_id: id }, makeMetadata(ctx.userId));
        return true;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },

    editBook: async (_parent, { id, input }, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { book } = await bookClient.editBook(
          { book_id: id, ...input },
          makeMetadata(ctx.userId),
        );
        return book;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },

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
