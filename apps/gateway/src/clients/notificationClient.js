const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '..', '..', '..', '..', 'proto', 'notification.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const notificationProto = grpc.loadPackageDefinition(packageDefinition).notification;

const NOTIFICATION_GRPC_HOST = process.env.NOTIFICATION_GRPC_HOST || 'notification-service';
const NOTIFICATION_GRPC_PORT = process.env.NOTIFICATION_GRPC_PORT || '50054';

const client = new notificationProto.NotificationService(
  `${NOTIFICATION_GRPC_HOST}:${NOTIFICATION_GRPC_PORT}`,
  grpc.credentials.createInsecure(),
);

function unary(method) {
  return (request, metadata) =>
    new Promise((resolve, reject) => {
      client[method](request, metadata || new grpc.Metadata(), (err, response) => {
        if (err) return reject(err);
        resolve(response);
      });
    });
}

module.exports = {
  client,
  listNotifications: unary('ListNotifications'),
  markNotificationRead: unary('MarkNotificationRead'),
  markAllNotificationsRead: unary('MarkAllNotificationsRead'),
  countUnreadNotifications: unary('CountUnreadNotifications'),
};
