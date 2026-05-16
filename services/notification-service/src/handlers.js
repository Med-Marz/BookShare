const grpc = require('@grpc/grpc-js');

function makeHandlers({ db, logger }) {
  return {
    async ListNotifications(call, callback) {
      const recipientId = call.request?.recipient_actor_id;
      if (!recipientId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'recipient_actor_id is required',
        });
      }
      try {
        const notifications = await db.listByRecipient({
          recipient_actor_id: recipientId,
          limit: call.request.limit,
          since: call.request.since,
        });
        return callback(null, { notifications });
      } catch (err) {
        logger.error({ err: err?.message || err, recipient_id: recipientId }, 'ListNotifications failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to list notifications' });
      }
    },

    async MarkNotificationRead(call, callback) {
      const id = call.request?.notification_id;
      const requesterId = call.request?.requester_id;
      if (!id || !requesterId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'notification_id and requester_id are required',
        });
      }
      try {
        const existing = await db.getNotification(id);
        if (!existing) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'notification not found' });
        }
        if (existing.recipient_actor_id !== requesterId) {
          return callback({
            code: grpc.status.PERMISSION_DENIED,
            message: 'only the recipient can mark this notification read',
          });
        }
        const notification = await db.markRead(id);
        return callback(null, { notification });
      } catch (err) {
        logger.error({ err: err?.message || err, id }, 'MarkNotificationRead failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to mark notification read' });
      }
    },

    async MarkAllNotificationsRead(call, callback) {
      const requesterId = call.request?.requester_id;
      if (!requesterId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'requester_id is required',
        });
      }
      try {
        const updated = await db.markAllReadByRecipient(requesterId);
        return callback(null, { updated_count: updated });
      } catch (err) {
        logger.error({ err: err?.message || err, requester_id: requesterId }, 'MarkAllNotificationsRead failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to mark notifications read' });
      }
    },

    async CountUnreadNotifications(call, callback) {
      const recipientId = call.request?.recipient_actor_id;
      if (!recipientId) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'recipient_actor_id is required',
        });
      }
      try {
        const count = await db.countUnread(recipientId);
        return callback(null, { count });
      } catch (err) {
        logger.error({ err: err?.message || err, recipient_id: recipientId }, 'CountUnreadNotifications failed');
        return callback({ code: grpc.status.INTERNAL, message: 'failed to count notifications' });
      }
    },
  };
}

module.exports = { makeHandlers };
