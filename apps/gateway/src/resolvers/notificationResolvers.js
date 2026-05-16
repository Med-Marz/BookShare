const grpc = require('@grpc/grpc-js');
const { GraphQLError } = require('graphql');

const notificationClient = require('../clients/notificationClient');
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
    notifications: async (_parent, { limit, since }, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { notifications } = await notificationClient.listNotifications(
          {
            recipient_actor_id: ctx.userId,
            limit: Number.isFinite(limit) ? limit : 20,
            since: since || '',
          },
          makeMetadata(ctx.userId),
        );
        return notifications || [];
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },

    unreadNotificationCount: async (_parent, _args, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { count } = await notificationClient.countUnreadNotifications(
          { recipient_actor_id: ctx.userId },
          makeMetadata(ctx.userId),
        );
        return count || 0;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },
  },

  Mutation: {
    markNotificationRead: async (_parent, { id }, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { notification } = await notificationClient.markNotificationRead(
          { notification_id: id, requester_id: ctx.userId },
          makeMetadata(ctx.userId),
        );
        return notification;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },

    markAllNotificationsRead: async (_parent, _args, ctx) => {
      if (!ctx?.userId) throw unauthenticated();
      try {
        const { updated_count } = await notificationClient.markAllNotificationsRead(
          { requester_id: ctx.userId },
          makeMetadata(ctx.userId),
        );
        return updated_count || 0;
      } catch (err) {
        throw grpcErrorToGraphQL(err);
      }
    },
  },
};
