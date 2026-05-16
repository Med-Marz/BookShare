const path = require('node:path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, '..', '..', '..', 'proto', 'user.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const userProto = grpc.loadPackageDefinition(packageDefinition).user;

const USER_GRPC_HOST = process.env.USER_GRPC_HOST || 'user-service';
const USER_GRPC_PORT = process.env.USER_GRPC_PORT || '50051';

// Singleton client. Notification-service calls GetUser at consumption time
// to render the actor's display_name in the notification message string.
const client = new userProto.UserService(
  `${USER_GRPC_HOST}:${USER_GRPC_PORT}`,
  grpc.credentials.createInsecure(),
);

function unary(method) {
  return (request) =>
    new Promise((resolve, reject) => {
      client[method](request, new grpc.Metadata(), (err, response) => {
        if (err) return reject(err);
        resolve(response);
      });
    });
}

module.exports = {
  client,
  getUser: unary('GetUser'),
};
